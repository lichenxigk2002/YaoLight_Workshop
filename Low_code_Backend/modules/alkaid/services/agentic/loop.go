package agentic

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
	"yaolight-workshop/backend/modules/alkaid/services/tools"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// RunStreamRequest 新流式接口请求
type RunStreamRequest struct {
	SessionID uint
	UserID    uint
	Message   string
	Interrupt bool
	Context   map[string]interface{} // 前端传入的上下文（如 currentWorkflow）
}

// RunStream 执行 Agentic 流：保存用户消息、推送进度事件、执行工具链、调用 LLM 生成、校验并 propose
// 当前为「固定管道」实现（get_capabilities → get_workflow → 生成 → validate → propose），后续可改为 LLM tool_calls
// 若请求 context 被取消（如客户端断开或打断），会发送 interrupted 事件并退出
func RunStream(ctx *gin.Context, req RunStreamRequest) error {
	reqCtx := ctx.Request.Context()
	repo := alkaidRepos.NewAlkaidRepository()
	session, err := repo.GetSessionByID(req.SessionID)
	if err != nil {
		return err
	}
	if session.UserID != req.UserID {
		return fmt.Errorf("无权访问该会话")
	}
	if reqCtx.Err() != nil {
		return reqCtx.Err()
	}

	// 保存用户消息
	userMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "user",
		Content:   req.Message,
		Type:      "text",
	}
	if err := repo.CreateMessage(userMsg); err != nil {
		return err
	}

	// 创建 SSEWriter，传入用户消息ID和内容（用于工具步分组）
	sw := NewSSEWriter(ctx, req.SessionID, userMsg.ID, req.Message)
	defer sw.Close()

	// Hook: BeforeGenerate - 生成前检查
	allow, reason, hookErr := CallBeforeGenerate(req.SessionID, req.UserID, req.Message)
	if hookErr != nil {
		_ = sw.WriteError(fmt.Sprintf("Hook 调用失败: %s", hookErr.Error()))
		return hookErr
	}
	if !allow {
		_ = sw.WriteError(fmt.Sprintf("操作被拒绝: %s", reason))
		_ = sw.WriteDone()
		return fmt.Errorf("BeforeGenerate Hook 拒绝: %s", reason)
	}

	checkCancel := func() bool {
		if reqCtx.Err() != nil {
			_ = sw.WriteInterrupted()
			return true
		}
		return false
	}

	// 依赖：能力、工作流服务、执行器
	capSvc := alkaidServices.NewCapabilitiesService()
	workflowRepo := workflowRepos.NewWorkflowRepository(database.DB)
	workflowNodeRepo := workflowRepos.NewWorkflowNodeRepository(database.DB)
	commentCardRepo := workflowRepos.NewWorkflowCommentCardRepository(database.DB)
	workflowService := workflowSvc.NewWorkflowService(workflowRepo, workflowNodeRepo, commentCardRepo)
	executor := workflowSvc.NewWorkflowExecutor()
	workflowProvider := &workflowServiceAdapter{workflowService}

	// CapabilitiesService 返回 (*WorkflowCapabilities, error)，用适配器满足 (interface{}, error)
	capAdapter := &capabilitiesProviderAdapter{capSvc}
	runner := &tools.Runner{
		CapabilitiesService: capAdapter,
		Repo:                repo,
		WorkflowService:     workflowProvider,
		Executor:            executor,
		RequestContext:      req.Context, // 供 get_workflow 等工具按需读取当前画布
		NodeSpecByType: func(nodeType string) (interface{}, error) {
			cap, err := capSvc.GetCapabilities()
			if err != nil {
				return nil, err
			}
			for _, nt := range cap.NodeTypes {
				if nt.Type == nodeType {
					return nt, nil
				}
			}
			return nil, nil
		},
	}
	registry := tools.NewRegistry(runner)

	// 解析请求上下文中的 currentWorkflow，用于最后 propose_patch 的 diff
	var currentWorkflowForDiff *workflowSvc.SaveWorkflowNodesRequest
	if cw, ok := req.Context["currentWorkflow"]; ok && cw != nil {
		if jsonBytes, err := json.Marshal(cw); err == nil {
			var w workflowSvc.SaveWorkflowNodesRequest
			if err := json.Unmarshal(jsonBytes, &w); err == nil {
				currentWorkflowForDiff = &w
			}
		}
	}

	alkaidSvc := alkaidServices.NewAlkaidService()
	relevantKnowledge, _ := alkaidSvc.GetRelevantKnowledgeForAgentic(req.UserID, req.Message, 8)
	// 系统提示词不再注入当前画布，由 LLM 按需调用 get_workflow
	systemPrompt, err := alkaidSvc.BuildSystemPromptForAgenticWithKnowledge(req.UserID, req.Message, relevantKnowledge, nil)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	contentForLLM := req.Message
	if historyStr, histErr := alkaidSvc.GetConversationHistoryForAgentic(req.SessionID, 20); histErr == nil && historyStr != "" && strings.Contains(historyStr, "助手：") {
		contentForLLM = historyStr + "\n\n请根据以上对话历史，回复最后一条用户消息。\n\n**工具调用建议**（请根据实际需求智能选择）：\n1. 如需了解最佳实践、示例或技巧 → 优先调用 search_knowledge\n2. 如需了解技术规范（节点类型、JSON格式等）→ 调用 get_capabilities\n3. 如需查看或修改现有工作流 → 调用 get_workflow\n4. 如需生成全新工作流 → 无需调用 get_workflow，直接基于 get_capabilities 和 search_knowledge 生成"
	}

	aiConfig, err := buildAIConfig(req.UserID)
	if err != nil {
		_ = sw.WriteError(err.Error())
		return err
	}
	toolDefs := GetToolDefsForLLM()
	aiProvider := deepseek.NewDeepSeekProvider()

	messages := []providers.ChatMessage{{Role: "user", Content: contentForLLM}}
	const maxTurns = 15
	var assistantContent string

	for turn := 0; turn < maxTurns; turn++ {
		if checkCancel() {
			return nil
		}
		_ = sw.WritePhaseChanged(alkaidModels.PhasePlanning)
		resp, err := aiProvider.ChatWithTools(reqCtx, aiConfig, systemPrompt, messages, toolDefs, map[string]interface{}{"thinking": false})
		if err != nil {
			_ = sw.WriteError(err.Error())
			return err
		}
		if reqCtx.Err() != nil {
			_ = sw.WriteInterrupted()
			return nil
		}

		if len(resp.ToolCalls) == 0 {
			assistantContent = resp.Content
			break
		}

		// 追加 assistant 消息（含 tool_calls）
		messages = append(messages, providers.ChatMessage{
			Role:      "assistant",
			Content:   resp.Content,
			ToolCalls: resp.ToolCalls,
		})

		for _, tc := range resp.ToolCalls {
			if checkCancel() {
				return nil
			}
			stepID := fmt.Sprintf("step-%d-%s", time.Now().UnixNano(), tc.Function.Name)
			_ = sw.WriteToolStepStarted(stepID, tc.Function.Name, alkaidModels.PhasePlanning)
			args := tc.Function.Arguments
			if args == "" {
				args = "{}"
			}
			result, resultSummary, toolErr := registry.ExecuteTool(tc.Function.Name, args, req.SessionID)
			status := alkaidModels.ToolStepSuccess
			errMsg := ""
			if toolErr != nil {
				status = alkaidModels.ToolStepError
				errMsg = toolErr.Error()
				resultSummary = errMsg
			}
			_ = sw.WriteToolStepFinished(stepID, status, resultSummary, errMsg)

			toolContent := resultSummary
			if result != nil {
				if b, e := json.Marshal(result); e == nil && len(b) < 8000 {
					toolContent = string(b)
				}
			}
			messages = append(messages, providers.ChatMessage{
				Role:       "tool",
				ToolCallID: tc.ID,
				Content:    toolContent,
			})
		}
	}

	// 若循环结束仍无最终回复（理论上不应发生），用空字符串
	if assistantContent == "" && len(messages) > 0 {
		for i := len(messages) - 1; i >= 0; i-- {
			if messages[i].Role == "assistant" && messages[i].Content != "" {
				assistantContent = messages[i].Content
				break
			}
		}
	}

	// 将最终回复「伪流式」推送给前端：
	// - 正文部分（含 JSON 前后的解释文字）：按小块流式输出，模拟打字；
	// - 工作流 JSON 本体：一次性输出，避免长 JSON 慢慢「打字」影响体验。
	if assistantContent != "" {
		_ = sw.WritePhaseChanged(alkaidModels.PhaseGenerating)

		// 尝试从回复中抽取工作流 JSON，用于拆分「普通文本」和「工作流文件」部分
		streamWorkflowJSON := extractWorkflowJSON(assistantContent)
		prefix := assistantContent
		jsonPart := ""
		textAfter := ""
		if streamWorkflowJSON != "" {
			if idx := strings.Index(assistantContent, streamWorkflowJSON); idx >= 0 {
				prefix = assistantContent[:idx]
				jsonPart = assistantContent[idx : idx+len(streamWorkflowJSON)]
				if idx+len(streamWorkflowJSON) < len(assistantContent) {
					textAfter = assistantContent[idx+len(streamWorkflowJSON):]
				}
			}
		}

		// 文本块统一按中等速度流式输出（一次 3 个字符左右）
		streamText := func(text string) {
			if text == "" {
				return
			}
			const chunkSize = 3
			const sleepPerChunk = 18 * time.Millisecond
			runes := []rune(text)
			for i := 0; i < len(runes); i += chunkSize {
				end := i + chunkSize
				if end > len(runes) {
					end = len(runes)
				}
				_ = sw.WriteContent(string(runes[i:end]))
				time.Sleep(sleepPerChunk)
			}
		}

		// 1）先流式输出 JSON 之前的解释文字
		streamText(prefix)
		// 2）JSON 本体一次性输出
		if jsonPart != "" {
			_ = sw.WriteContent(jsonPart)
		}
		// 3）JSON 之后的说明文字继续流式输出
		streamText(textAfter)
	}

	// 保存助手消息
	assistantMsg := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "assistant",
		Content:   assistantContent,
		Type:      "text",
	}
	_ = repo.CreateMessage(assistantMsg)

	if checkCancel() {
		return nil
	}
	// 从回复中抽取工作流 JSON，执行完整的"校验 → 优化 → 试跑 → 确认交付"流程
	workflowJSON := extractWorkflowJSON(assistantContent)
	if workflowJSON != "" {
		// 先验证提取的 JSON 是否有效
		var workflowMap map[string]interface{}
		if err := json.Unmarshal([]byte(workflowJSON), &workflowMap); err != nil {
			// JSON 格式无效，跳过工作流处理
			_ = sw.WriteContent("\n\n⚠️ 提取的工作流 JSON 格式有误，无法处理\n")
			_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
			_ = sw.WriteDone()
			return nil
		}

		// Hook: AfterGenerate - 生成后审计
		allow, reason, hookErr := CallAfterGenerate(req.SessionID, req.UserID, workflowMap)
		if hookErr != nil {
			_ = sw.WriteError(fmt.Sprintf("Hook 调用失败: %s", hookErr.Error()))
		} else if !allow {
			_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
			_ = sw.WriteError(fmt.Sprintf("工作流被拒绝: %s", reason))
			_ = sw.WriteDone()
			return fmt.Errorf("AfterGenerate Hook 拒绝: %s", reason)
		}

		// 阶段 1: 校验工作流结构
		_ = sw.WritePhaseChanged(alkaidModels.PhaseValidating)
		_ = sw.WriteToolStepStarted("step-validate", "validate_workflow", alkaidModels.PhaseValidating)
		params := fmt.Sprintf(`{"workflow":%s}`, workflowJSON)
		valResult, valSummary, valErr := registry.ExecuteTool("validate_workflow", params, req.SessionID)

		var valid bool
		var validationErrors []interface{}
		if m, ok := valResult.(map[string]interface{}); ok {
			valid, _ = m["valid"].(bool)
			validationErrors, _ = m["errors"].([]interface{})
		}

		if valErr != nil || !valid {
			errMsg := valSummary
			if valErr != nil {
				errMsg = valErr.Error()
			}
			_ = sw.WriteToolStepFinished("step-validate", alkaidModels.ToolStepError, valSummary, errMsg)
			_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
			_ = sw.WriteError(fmt.Sprintf("工作流校验失败: %s", errMsg))
			_ = sw.WriteDone()
			return nil
		}
		_ = sw.WriteToolStepFinished("step-validate", alkaidModels.ToolStepSuccess, valSummary, "")

		// 阶段 2: 试跑工作流（预演执行，固定执行）
		if checkCancel() {
			return nil
		}
		_ = sw.WritePhaseChanged(alkaidModels.PhaseRunningTrial)
		_ = sw.WriteToolStepStarted("step-trial", "run_workflow_trial", alkaidModels.PhaseRunningTrial)
		trialResult, trialSummary, trialErr := registry.ExecuteTool("run_workflow_trial", params, req.SessionID)

		var trialSuccess bool
		var trialErrorMsg string
		if m, ok := trialResult.(map[string]interface{}); ok {
			trialSuccess, _ = m["success"].(bool)
			if errField, hasErr := m["error"]; hasErr && errField != nil {
				trialErrorMsg = fmt.Sprintf("%v", errField)
			}
		}

		// 试跑失败时的处理
		if trialErr != nil || !trialSuccess {
			errMsg := trialSummary
			if trialErr != nil {
				errMsg = trialErr.Error()
			} else if trialErrorMsg != "" {
				errMsg = trialErrorMsg
			}
			_ = sw.WriteToolStepFinished("step-trial", alkaidModels.ToolStepError, trialSummary, errMsg)

			// Hook: OnWorkflowRunFailed - 工作流运行失败时
			workflowID := uint(0)
			if session.WorkflowID != nil {
				workflowID = *session.WorkflowID
			}
			executionError := map[string]interface{}{
				"message": errMsg,
				"summary": trialSummary,
			}
			if trialResult != nil {
				if m, ok := trialResult.(map[string]interface{}); ok {
					executionError["details"] = m
				}
			}
			// 调用 Hook（不阻塞流程，仅用于通知/审计）
			_, _, _ = CallOnWorkflowRunFailed(req.SessionID, req.UserID, workflowID, executionError)

			// 进入修复阶段：让 LLM 尝试修复问题
			if checkCancel() {
				return nil
			}
			_ = sw.WritePhaseChanged(alkaidModels.PhaseRepairing)
			_ = sw.WriteContent("\n\n⚠️ 工作流试跑失败，正在尝试自动修复...\n")

			// 构造修复提示，告知 LLM 错误信息
			repairPrompt := fmt.Sprintf("工作流试跑失败，错误信息：%s\n\n请分析错误原因并生成修复后的工作流。", errMsg)
			if len(validationErrors) > 0 {
				errBytes, _ := json.Marshal(validationErrors)
				repairPrompt = fmt.Sprintf("工作流试跑失败。校验错误：%s，执行错误：%s\n\n请修复这些问题并重新生成工作流。", string(errBytes), errMsg)
			}

			// 调用 LLM 进行修复（追加修复请求到消息历史）
			messages = append(messages, providers.ChatMessage{
				Role:    "user",
				Content: repairPrompt,
			})

			repairResp, repairErr := aiProvider.ChatWithTools(reqCtx, aiConfig, systemPrompt, messages, toolDefs, map[string]interface{}{"thinking": false})
			if repairErr != nil || reqCtx.Err() != nil {
				_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
				_ = sw.WriteError("自动修复失败，请手动调整工作流")
				_ = sw.WriteDone()
				return nil
			}

			// 输出修复后的回复
			_ = sw.WriteContent("\n修复建议：\n" + repairResp.Content)

			// 尝试从修复回复中提取新的工作流
			repairedWorkflowJSON := extractWorkflowJSON(repairResp.Content)
			if repairedWorkflowJSON != "" {
				// 先验证修复后的 JSON 是否有效
				var repairedMap map[string]interface{}
				if err := json.Unmarshal([]byte(repairedWorkflowJSON), &repairedMap); err != nil {
					_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
					_ = sw.WriteError("修复后的工作流 JSON 格式仍然有误")
					_ = sw.WriteDone()
					return nil
				}

				// 重新校验修复后的工作流
				_ = sw.WriteToolStepStarted("step-validate-repair", "validate_workflow", alkaidModels.PhaseRepairing)
				valResult2, valSummary2, valErr2 := registry.ExecuteTool("validate_workflow", fmt.Sprintf(`{"workflow":%s}`, repairedWorkflowJSON), req.SessionID)

				var validRepair bool
				if m, ok := valResult2.(map[string]interface{}); ok {
					validRepair, _ = m["valid"].(bool)
				}

				if valErr2 != nil || !validRepair {
					_ = sw.WriteToolStepFinished("step-validate-repair", alkaidModels.ToolStepError, valSummary2, "修复后仍存在问题")
					_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
					_ = sw.WriteError("自动修复未能完全解决问题，建议手动调整")
					_ = sw.WriteDone()
					return nil
				}
				_ = sw.WriteToolStepFinished("step-validate-repair", alkaidModels.ToolStepSuccess, valSummary2, "")

				// 使用修复后的工作流继续
				workflowJSON = repairedWorkflowJSON
				_ = sw.WriteContent("\n✅ 工作流已自动修复并通过校验\n")
			} else {
				// 无法提取修复后的工作流
				_ = sw.WritePhaseChanged(alkaidModels.PhaseError)
				_ = sw.WriteError("无法从修复建议中提取有效工作流")
				_ = sw.WriteDone()
				return nil
			}
		} else {
			// 试跑成功
			_ = sw.WriteToolStepFinished("step-trial", alkaidModels.ToolStepSuccess, trialSummary, "")
		}

		// 阶段 3: 确认与交付 - 提出工作流供用户确认
		if checkCancel() {
			return nil
		}
		_ = sw.WritePhaseChanged(alkaidModels.PhaseWaitingApproval)
		_ = sw.WriteToolStepStarted("step-propose", "propose_workflow", alkaidModels.PhaseWaitingApproval)
		_, propSummary, _ := registry.ExecuteTool("propose_workflow", fmt.Sprintf(`{"workflow":%s}`, workflowJSON), req.SessionID)
		_ = sw.WriteToolStepFinished("step-propose", alkaidModels.ToolStepSuccess, propSummary, "")

		var nodeCount, edgeCount int
		var wf map[string]interface{}
		_ = json.Unmarshal([]byte(workflowJSON), &wf)
		proposedNodes, _ := wf["nodes"].([]interface{})
		proposedEdges, _ := wf["edges"].([]interface{})
		if proposedNodes != nil {
			nodeCount = len(proposedNodes)
		}
		if proposedEdges != nil {
			edgeCount = len(proposedEdges)
		}
		_ = sw.WritePendingWorkflow(nodeCount, edgeCount)

		// 生成并提出补丁：当前画布与提议工作流的 diff，便于用户选择「应用补丁」而非整图替换
		if proposedNodes != nil && currentWorkflowForDiff != nil {
			patch, patchErr := ComputeWorkflowDiff(currentWorkflowForDiff, proposedNodes, proposedEdges)
			if patchErr == nil && len(patch) > 0 {
				patchJSON, _ := json.Marshal(map[string]interface{}{"patch": patch})
				_ = sw.WriteToolStepStarted("step-patch", "propose_patch", alkaidModels.PhaseWaitingApproval)
				_, _, _ = registry.ExecuteTool("propose_patch", string(patchJSON), req.SessionID)
				_ = sw.WriteToolStepFinished("step-patch", alkaidModels.ToolStepSuccess, fmt.Sprintf("已生成 %d 项补丁", len(patch)), "")
				_ = sw.WritePendingPatch(len(patch))
			}
		}
	}

	_ = sw.WritePhaseChanged(alkaidModels.PhaseIdle)
	_ = sw.WriteDone()
	return nil
}

func buildAIConfig(userID uint) (*providers.AIModelConfig, error) {
	if config.DeepSeekAPIKey == "" {
		return nil, fmt.Errorf("未配置 DEEPSEEK_API_KEY")
	}
	return &providers.AIModelConfig{
		Provider:    "deepseek",
		ModelName:   "deepseek-chat",
		APIKey:      config.DeepSeekAPIKey,
		BaseURL:     "https://api.deepseek.com",
		Temperature: floatPtr(0.7),
		MaxTokens:   intPtr(4000),
	}, nil
}

func floatPtr(f float64) *float64 { return &f }
func intPtr(i int) *int           { return &i }

var workflowJSONBlockRe = regexp.MustCompile("(?s)```(?:json)?\\s*({[\\s\\S]*?})\\s*```")
var workflowJSONObjectRe = regexp.MustCompile("(?s)(\\{\\s*\"(?:version|nodes|edges)\"[^}]*(?:\\{[^{}]*\\}|[^{}])*\\})")

// capabilitiesProviderAdapter 使 CapabilitiesService 满足 tools.CapabilitiesProvider (interface{}, error)
type capabilitiesProviderAdapter struct {
	*alkaidServices.CapabilitiesService
}

func (c *capabilitiesProviderAdapter) GetCapabilities() (interface{}, error) {
	return c.CapabilitiesService.GetCapabilities()
}

// workflowServiceAdapter 适配 workflow 服务以实现 tools.WorkflowServiceProvider
type workflowServiceAdapter struct {
	*workflowSvc.WorkflowService
}

func (a *workflowServiceAdapter) GetWorkflowNodes(workflowID uint) (interface{}, error) {
	return a.WorkflowService.GetWorkflowNodes(workflowID)
}

func (a *workflowServiceAdapter) SaveWorkflowNodes(workflowID uint, req interface{}) error {
	r, ok := req.(*workflowSvc.SaveWorkflowNodesRequest)
	if !ok {
		return fmt.Errorf("invalid request type")
	}
	return a.WorkflowService.SaveWorkflowNodes(workflowID, r)
}

func extractWorkflowJSON(content string) string {
	// 优先从代码块中提取
	if matches := workflowJSONBlockRe.FindStringSubmatch(content); len(matches) > 1 {
		jsonStr := strings.TrimSpace(matches[1])
		// 验证是否是有效的 JSON
		if isValidWorkflowJSON(jsonStr) {
			return jsonStr
		}
	}

	// 尝试查找完整的 JSON 对象（使用括号计数确保完整性）
	jsonStr := extractCompleteJSON(content)
	if jsonStr != "" && isValidWorkflowJSON(jsonStr) {
		return jsonStr
	}

	return ""
}

// isValidWorkflowJSON 检查是否是有效的工作流 JSON
func isValidWorkflowJSON(jsonStr string) bool {
	var obj map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &obj); err != nil {
		return false
	}
	// 必须包含 nodes 字段
	_, hasNodes := obj["nodes"]
	return hasNodes
}

// extractCompleteJSON 使用括号匹配提取完整的 JSON
func extractCompleteJSON(content string) string {
	// 查找第一个 { 开始
	start := -1
	for i, ch := range content {
		if ch == '{' {
			// 检查前面是否有 version、nodes 等关键字
			if i > 0 {
				before := content[max(0, i-50):i]
				if !strings.Contains(before, "version") && !strings.Contains(before, "nodes") {
					// 在 { 后面查找是否有这些关键字
					after := content[i:min(len(content), i+200)]
					if !strings.Contains(after, "\"version\"") && !strings.Contains(after, "\"nodes\"") {
						continue
					}
				}
			}
			start = i
			break
		}
	}

	if start == -1 {
		return ""
	}

	// 使用括号计数找到匹配的 }
	depth := 0
	inString := false
	escape := false

	for i := start; i < len(content); i++ {
		ch := content[i]

		if escape {
			escape = false
			continue
		}

		if ch == '\\' {
			escape = true
			continue
		}

		if ch == '"' {
			inString = !inString
			continue
		}

		if !inString {
			if ch == '{' {
				depth++
			} else if ch == '}' {
				depth--
				if depth == 0 {
					return content[start : i+1]
				}
			}
		}
	}

	return ""
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

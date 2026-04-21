package services

import (
	"encoding/json"
	"fmt"
	"strings"
	log "yaolight-workshop/backend/infrastructure/logx"

	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/email"
	artifactRepos "yaolight-workshop/backend/modules/artifact/repositories"
	artifactServices "yaolight-workshop/backend/modules/artifact/services"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	"yaolight-workshop/backend/modules/workflow/services/export"
)

// tryExtractJSONFromFencedCodeBlock 尝试从 ```json ...``` 或 ``` ...``` 中提取 JSON 内容
func tryExtractJSONFromFencedCodeBlock(s string) string {
	ss := strings.TrimSpace(s)
	if !strings.HasPrefix(ss, "```") {
		return ss
	}
	// 找第一行结束（支持 \n 或 \r\n）
	nl := strings.Index(ss, "\n")
	if nl > 0 {
		body := ss[nl+1:]
		if end := strings.LastIndex(body, "```"); end >= 0 {
			body = body[:end]
		}
		return strings.TrimSpace(body)
	}
	// 无换行时（如 "```json{..."）：跳过开头的 ``` 和可选的 json，从第一个 { 或 [ 开始取到对应闭合或末尾 ```
	rest := strings.TrimPrefix(ss, "```")
	rest = strings.TrimSpace(rest)
	if strings.HasPrefix(rest, "json") {
		rest = strings.TrimSpace(rest[4:])
	}
	start := strings.Index(rest, "{")
	if start < 0 {
		start = strings.Index(rest, "[")
	}
	if start >= 0 {
		body := rest[start:]
		if end := strings.LastIndex(body, "```"); end >= 0 {
			body = body[:end]
		}
		return strings.TrimSpace(body)
	}
	return ss
}

const maxStructuredPayloadDepth = 12 // 防止嵌套过深导致栈溢出

// isStructuredPayload 判断对象是否已是可用的 timeline/network 结构（含 needKey 且对应数组非空）
func isStructuredPayload(m map[string]interface{}, needKey string) bool {
	v, ok := m[needKey]
	if !ok || v == nil {
		return false
	}
	arr, ok := v.([]interface{})
	return ok && len(arr) > 0
}

// findStructuredPayloadDeep 在 payload 中递归查找第一个包含 events/edges 的有效对象，兼容嵌套与 JSON 字符串
func findStructuredPayloadDeep(payload interface{}, needKey string, depth int) interface{} {
	if depth > maxStructuredPayloadDepth {
		return nil
	}
	if payload == nil {
		return nil
	}
	switch v := payload.(type) {
	case map[string]interface{}:
		if isStructuredPayload(v, needKey) {
			return v
		}
		for _, val := range v {
			if found := findStructuredPayloadDeep(val, needKey, depth+1); found != nil {
				return found
			}
		}
		return nil
	case []interface{}:
		for _, item := range v {
			if found := findStructuredPayloadDeep(item, needKey, depth+1); found != nil {
				return found
			}
		}
		return nil
	case string:
		s := strings.TrimSpace(v)
		if s == "" {
			return nil
		}
		// 可能是 ```json ... ``` 或裸 JSON，解析后继续在子树中查找
		raw := s
		if strings.HasPrefix(s, "```") {
			raw = tryExtractJSONFromFencedCodeBlock(s)
		} else if !strings.HasPrefix(s, "{") && !strings.HasPrefix(s, "[") {
			return nil
		}
		var decoded interface{}
		if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
			return nil
		}
		return findStructuredPayloadDeep(decoded, needKey, depth+1)
	default:
		return nil
	}
}

// tryResolveStructuredPayload 从 payload 中解析出 timeline/network/sankey 所需结构；优先用顶层，否则在整棵树中深度查找
func tryResolveStructuredPayload(payload interface{}, format string) interface{} {
	needKey := "events" // timeline
	switch strings.ToLower(format) {
	case "network":
		needKey = "edges"
	case "sankey":
		needKey = "flows"
	}
	// 1) 顶层已是合格结构，直接沿用（不覆盖 exportInput）
	if m, ok := payload.(map[string]interface{}); ok && m != nil && isStructuredPayload(m, needKey) {
		return nil
	}
	// 2) 在整棵 payload 树中深度查找第一个含 events/edges 且数组非空的对象
	return findStructuredPayloadDeep(payload, needKey, 0)
}

// isChartPayload 判断对象是否已是 chart 可消费的结构：
// 1) 完整 chart 输入：{type,title,data}
// 2) 直接的数据对象：categories+series / points / items / traits / xLabels+yLabels+values / values
func isChartPayload(m map[string]interface{}) bool {
	if m == nil {
		return false
	}
	if typ, ok := m["type"].(string); ok && strings.TrimSpace(typ) != "" {
		return true
	}
	if _, hasCats := m["categories"]; hasCats && m["series"] != nil {
		return true
	}
	if _, ok := m["points"]; ok {
		return true
	}
	if _, ok := m["items"]; ok {
		return true
	}
	if _, ok := m["traits"]; ok {
		return true
	}
	if _, ok := m["series"]; ok {
		return true
	}
	if _, hasX := m["xLabels"]; hasX {
		if _, hasY := m["yLabels"]; hasY && m["values"] != nil {
			return true
		}
	}
	if _, ok := m["values"]; ok {
		return true
	}
	return false
}

// findChartPayloadDeep 在 payload 中递归查找第一个 chart 结构对象，兼容嵌套与 JSON 字符串
func findChartPayloadDeep(payload interface{}, depth int) interface{} {
	if depth > maxStructuredPayloadDepth {
		return nil
	}
	if payload == nil {
		return nil
	}

	switch v := payload.(type) {
	case map[string]interface{}:
		if isChartPayload(v) {
			return v
		}
		for _, val := range v {
			if found := findChartPayloadDeep(val, depth+1); found != nil {
				return found
			}
		}
		return nil
	case []interface{}:
		for _, item := range v {
			if found := findChartPayloadDeep(item, depth+1); found != nil {
				return found
			}
		}
		return nil
	case string:
		s := strings.TrimSpace(v)
		if s == "" {
			return nil
		}
		raw := s
		if strings.HasPrefix(s, "```") {
			raw = tryExtractJSONFromFencedCodeBlock(s)
		} else if !strings.HasPrefix(s, "{") && !strings.HasPrefix(s, "[") {
			return nil
		}
		var decoded interface{}
		if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
			return nil
		}
		return findChartPayloadDeep(decoded, depth+1)
	default:
		return nil
	}
}

// tryResolveChartPayload 从 payload 中解析出 chart 可消费的结构；优先顶层，否则深度查找
func tryResolveChartPayload(payload interface{}) interface{} {
	if m, ok := payload.(map[string]interface{}); ok && m != nil && isChartPayload(m) {
		return m
	}
	return findChartPayloadDeep(payload, 0)
}

// executeOutputNode 执行输出节点
func (e *WorkflowExecutor) executeOutputNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext, meta ExecutionMeta) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	sendEmail := getBool(node.Config, "sendEmail", false)

	format := getString(node.Config, "format", "json")
	destination := getString(node.Config, "destination", "file")
	fileName := getString(node.Config, "fileName", "")
	outputMode := getString(node.Config, "outputMode", "artifact_export")
	responsePath := getString(node.Config, "responsePath", "")
	effectiveResponsePath := effectiveOutputResponsePath(outputMode, responsePath)
	if strings.Contains(fileName, "{{") {
		resolved, err := variableContext.ResolveTemplate(fileName)
		if err != nil {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "output",
				Success: false,
				Error:   fmt.Sprintf("解析 fileName 变量失败: %v", err),
				Data: map[string]interface{}{
					"fileName": fileName,
				},
			}
		}
		if strings.TrimSpace(resolved) == "" {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "output",
				Success: false,
				Error:   "解析 fileName 变量失败: 结果为空",
				Data: map[string]interface{}{
					"fileName": fileName,
				},
			}
		}
		fileName = resolved
	}

	// destination=api 依赖 taskId，便于外部系统通过 /tasks/:id/artifacts 查询
	if strings.EqualFold(destination, "api") && (meta.TaskID == nil || *meta.TaskID == 0) {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   "任务未创建成功，无法使用导出API（请检查任务表写入是否正常）",
			Data:    ExtractPayload(inputData),
		}
	}

	// 统一导出：将输入数据通过 provider 生成文件，再落为 artifact
	payload := ExtractPayload(inputData)
	responsePayload, responseErr := resolveOutputResponsePayload(payload, effectiveResponsePath)
	if responseErr != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   responseErr.Error(),
			Data: map[string]interface{}{
				"outputMode":   outputMode,
				"responsePath": effectiveResponsePath,
			},
		}
	}
	exportInput := payload

	// 文本类导出：优先从对象结构里抽取正文（避免导出成整包 JSON）
	switch strings.ToLower(format) {
	case "markdown", "md", "text", "txt":
		if pm, ok := payload.(map[string]interface{}); ok && pm != nil {
			if s, ok := pm["content"].(string); ok && strings.TrimSpace(s) != "" {
				exportInput = tryExtractJSONFromFencedCodeBlock(s)
			} else if s, ok := pm["result"].(string); ok && strings.TrimSpace(s) != "" {
				exportInput = tryExtractJSONFromFencedCodeBlock(s)
			} else if s, ok := pm["data"].(string); ok && strings.TrimSpace(s) != "" {
				exportInput = tryExtractJSONFromFencedCodeBlock(s)
			}
		} else if s, ok := payload.(string); ok && strings.TrimSpace(s) != "" {
			exportInput = tryExtractJSONFromFencedCodeBlock(s)
		}
	}

	// timeline/network/sankey：在整棵 payload 中深度查找 events/edges/flows，兼容 AI 嵌套或 JSON 字符串
	if strings.EqualFold(format, "timeline") || strings.EqualFold(format, "network") || strings.EqualFold(format, "sankey") {
		if resolved := tryResolveStructuredPayload(payload, format); resolved != nil {
			exportInput = resolved
		}
	}

	// 便捷配置：当选择 chart 且未在 payload 中提供 type/data 时，自动包装成 chart provider 期望的结构
	if strings.EqualFold(format, "chart") {
		chartType := getString(node.Config, "chartType", "")
		chartTitle := getString(node.Config, "chartTitle", "")
		if chartType != "" {
			// 1) 先尝试在整棵 payload 树中递归找 chart 结构，兼容 transformed/result/content/fenced-json
			if resolved := tryResolveChartPayload(payload); resolved != nil {
				if mm, ok := resolved.(map[string]interface{}); ok && mm != nil {
					if _, hasType := mm["type"].(string); hasType {
						exportInput = mm
					} else {
						exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": mm}
					}
				} else {
					exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": resolved}
				}
			} else {
				// 2) 找不到结构化 chart 数据时兜底包装
				exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": payload}
			}
		}
	}
	factory := export.DefaultFactory()
	provider, pErr := factory.Get(strings.ToLower(format))
	if pErr != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   fmt.Sprintf("不支持的导出格式: %s", format),
			Data: map[string]interface{}{
				"format":      format,
				"destination": destination,
				"data":        payload,
			},
		}
	}

	files, expErr := provider.Export(exportInput, node.Config)
	if expErr != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "output",
			Success: false,
			Error:   fmt.Sprintf("导出失败: %v", expErr),
			Data: map[string]interface{}{
				"format":      format,
				"destination": destination,
			},
		}
	}

	// 可选：用户指定 fileName 且只有一个文件时覆盖名称
	if fileName != "" && len(files) == 1 {
		files[0].Name = fileName
	}

	artifactRepo := artifactRepos.NewArtifactRepository(database.DB)
	artifactSvc := artifactServices.NewArtifactService(artifactRepo)

	artifacts := make([]map[string]interface{}, 0, len(files))
	emailAttachments := make([]email.Attachment, 0, len(files))

	for _, f := range files {
		a, aErr := artifactSvc.CreateArtifact(artifactServices.CreateArtifactInput{
			UserID:     meta.UserID,
			WorkflowID: meta.WorkflowID,
			TaskID:     meta.TaskID,
			NodeID:     node.ID,
			Kind:       f.Kind,
			MimeType:   f.MimeType,
			Name:       f.Name,
			Bytes:      f.Bytes,
			Metadata: map[string]interface{}{
				"format":      format,
				"destination": destination,
				"provider":    provider.Name(),
			},
		})
		if aErr != nil {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "output",
				Success: false,
				Error:   fmt.Sprintf("保存导出文件失败: %v", aErr),
				Data: map[string]interface{}{
					"format":      format,
					"destination": destination,
				},
			}
		}
		artifacts = append(artifacts, map[string]interface{}{
			"id":          a.ID,
			"name":        a.Name,
			"kind":        a.Kind,
			"mimeType":    a.MimeType,
			"size":        a.Size,
			"downloadUrl": fmt.Sprintf("/api/artifacts/%d/download", a.ID),
		})

		emailAttachments = append(emailAttachments, email.Attachment{
			Filename: f.Name,
			MimeType: f.MimeType,
			Data:     f.Bytes,
		})
	}

	if sendEmail && meta.UserID > 0 && len(emailAttachments) > 0 {
		go func(userID uint, nodeID string, fmtStr string, files []email.Attachment, payload interface{}, workflowID *uint) {
			if err := sendOutputEmailForUser(userID, nodeID, fmtStr, files, payload, workflowID); err != nil {
				log.Printf("发送输出节点邮件失败: %v", err)
			}
		}(meta.UserID, node.ID, format, emailAttachments, payload, meta.WorkflowID)
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "output",
		Success: true,
		Data: map[string]interface{}{
			"outputMode":   outputMode,
			"responsePath": effectiveResponsePath,
			"format":       format,
			"destination":  destination,
			"artifacts":    artifacts,
			"taskId":       meta.TaskID,
			"workflowId":   meta.WorkflowID,
			"response":     responsePayload,
			// 保留 data：便于站内调试/预览；未来可通过 config 控制是否返回
			"data": payload,
		},
	}
}

func effectiveOutputResponsePath(outputMode string, responsePath string) string {
	if getNormalizedOutputMode(outputMode) != "api_output" {
		return ""
	}
	return strings.TrimSpace(responsePath)
}

func getNormalizedOutputMode(outputMode string) string {
	if strings.TrimSpace(outputMode) == "api_output" {
		return "api_output"
	}
	return "artifact_export"
}

func resolveOutputResponsePayload(payload interface{}, responsePath string) (interface{}, error) {
	if strings.TrimSpace(responsePath) == "" {
		return payload, nil
	}
	value, found, err := TryGetDataByPath(payload, responsePath)
	if err != nil {
		return nil, fmt.Errorf("解析 API 返回路径失败: %v", err)
	}
	if !found {
		return nil, fmt.Errorf("API 返回路径未命中: %s", responsePath)
	}
	return value, nil
}

func sendOutputEmailForUser(userID uint, nodeID, format string, attachments []email.Attachment, payload interface{}, workflowID *uint) error {
	var user userModels.User
	if err := database.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return err
	}
	emailAddr := strings.TrimSpace(user.Email)
	if emailAddr == "" || strings.HasPrefix(emailAddr, "unbound_") {
		return nil
	}

	markdownBody := ""
	if pm, ok := payload.(map[string]interface{}); ok && pm != nil {
		if s, ok := pm["content"].(string); ok && strings.TrimSpace(s) != "" {
			markdownBody = s
		} else if s, ok := pm["result"].(string); ok && strings.TrimSpace(s) != "" {
			markdownBody = s
		}
	} else if s, ok := payload.(string); ok && strings.TrimSpace(s) != "" {
		markdownBody = s
	}

	var workflowName string
	if workflowID != nil && *workflowID > 0 {
		var workflow workflowModels.Workflow
		if err := database.DB.Select("name").Where("id = ?", *workflowID).First(&workflow).Error; err == nil {
			workflowName = strings.TrimSpace(workflow.Name)
		}
	}

	if strings.TrimSpace(markdownBody) == "" {
		if workflowName != "" {
			markdownBody = fmt.Sprintf("工作流「%s」的输出已生成附件，请查收。", workflowName)
		} else {
			markdownBody = fmt.Sprintf("工作流输出节点 %s 已生成附件，请查收。", nodeID)
		}
	}

	subject := "工作流输出结果"
	title := ""
	if workflowName != "" {
		title = fmt.Sprintf("工作流「%s」的执行结果（格式：%s）", workflowName, format)
	} else {
		title = fmt.Sprintf("输出节点 %s 的结果（格式：%s）", nodeID, format)
	}

	return email.SendWorkflowOutputEmail(emailAddr, subject, title, markdownBody, attachments)
}

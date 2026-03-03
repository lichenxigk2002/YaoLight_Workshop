package services

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

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
	// 找第一行结束
	nl := strings.Index(ss, "\n")
	if nl <= 0 {
		return ss
	}
	// 去掉首行 ```json / ```
	body := ss[nl+1:]
	// 去掉末尾 ```
	if end := strings.LastIndex(body, "```"); end >= 0 {
		body = body[:end]
	}
	return strings.TrimSpace(body)
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

	// 便捷配置：当选择 chart 且未在 payload 中提供 type/data 时，自动包装成 chart provider 期望的结构
	if strings.EqualFold(format, "chart") {
		chartType := getString(node.Config, "chartType", "")
		chartTitle := getString(node.Config, "chartTitle", "")
		if chartType != "" {
			// 1) 若上游已经是对象且包含 type，则认为已经是 chart 输入结构，不再二次包装
			if pm, ok := payload.(map[string]interface{}); ok && pm != nil {
				if _, hasType := pm["type"].(string); hasType {
					// 已经是 chart 输入结构
					exportInput = pm
				} else if _, hasCats := pm["categories"]; hasCats || pm["series"] != nil || pm["traits"] != nil {
					// 已经是 bar/line 等需要的 data（或 traits），直接作为 data
					exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": pm}
				} else if rs, ok := pm["result"].(string); ok && strings.TrimSpace(rs) != "" {
					// AI 节点常见输出：{ content, result, tokensUsed... }，其中 result 为 JSON 字符串（可能 fenced）
					raw := tryExtractJSONFromFencedCodeBlock(rs)
					var mm map[string]interface{}
					if err := json.Unmarshal([]byte(raw), &mm); err == nil && mm != nil {
						if _, hasType := mm["type"].(string); hasType {
							exportInput = mm
						} else {
							exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": mm}
						}
					} else {
						// 解析失败：兜底把 result 当 data
						exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": rs}
					}
				} else {
					// 无法识别：兜底包装整个 payload
					exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": payload}
				}
			} else if s, ok := payload.(string); ok && strings.TrimSpace(s) != "" {
				// 2) 上游常见是 AI 节点输出 JSON 字符串：优先尝试解析
				// 兼容：AI 可能输出 ```json ...``` 代码块
				raw := tryExtractJSONFromFencedCodeBlock(s)
				var mm map[string]interface{}
				if err := json.Unmarshal([]byte(raw), &mm); err == nil && mm != nil {
					if _, hasType := mm["type"].(string); hasType {
						// 已经是 {type,title,data} 结构：直接用解析后的对象
						exportInput = mm
					} else {
						// 仅是 data：自动包装
						exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": mm}
					}
				} else {
					// 解析失败：兜底包装（data 为原始字符串）
					exportInput = map[string]interface{}{"type": chartType, "title": chartTitle, "data": payload}
				}
			} else {
				// 3) 其它类型：兜底包装
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
		a, aErr := artifactSvc.CreateLocalFileArtifact(artifactServices.CreateArtifactInput{
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
			"format":      format,
			"destination": destination,
			"artifacts":   artifacts,
			"taskId":      meta.TaskID,
			"workflowId":  meta.WorkflowID,
			// 保留 data：便于站内调试/预览；未来可通过 config 控制是否返回
			"data": payload,
		},
	}
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

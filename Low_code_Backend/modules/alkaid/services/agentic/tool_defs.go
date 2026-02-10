package agentic

import "yaolight-workshop/backend/modules/ai/services/providers"

// GetToolDefsForLLM 返回供 LLM 使用的工具定义（OpenAI 兼容格式），瑶光星按需调用
// 注意：propose_workflow 和 propose_patch 不在此列表中，它们由固定管道在最后阶段调用
func GetToolDefsForLLM() []providers.ToolDef {
	return []providers.ToolDef{
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "search_knowledge",
				Description: "从知识库中检索相关信息：最佳实践、常见问题解答、示例工作流、节点使用技巧等。建议优先调用此工具了解背景知识和最佳实践，再决定是否需要生成工作流。参数 query 为查询内容。",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"query": map[string]interface{}{
							"type":        "string",
							"description": "搜索关键词或问题，如：数据清洗最佳实践、如何使用 AI 节点、示例爬虫工作流",
						},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_capabilities",
				Description: "获取工作流能力说明：支持的节点类型、工作流 JSON 格式规范、连接规则、变量引用语法等。在需要生成工作流前调用以了解技术规范。",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_workflow",
				Description: "获取当前画布上的工作流（节点与边）。仅在以下场景调用：1) 用户明确要求查看当前工作流；2) 用户要求修改/优化**已有**工作流。如果是生成全新工作流，无需调用此工具。",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_node_spec",
				Description: "根据节点类型获取该类型的详细规格（输入输出变量、必填配置、枚举值等）。参数 nodeType 如：start, crawler, dataclean, ai, condition, transform, loop, merge, delay, output, end。",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"nodeType": map[string]interface{}{
							"type":        "string",
							"description": "节点类型，如 crawler, ai, dataclean",
						},
					},
					"required": []string{"nodeType"},
				},
			},
		},
		// 注意：validate_workflow 工具已移除，因为它会在固定管道中自动执行
		// 注意：run_workflow_trial 工具已移除，因为它会在固定管道中自动执行
		// 注意：propose_workflow 和 propose_patch 已移除，它们只能由固定管道调用
	}
}

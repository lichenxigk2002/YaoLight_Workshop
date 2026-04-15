package agentic

import "yaolight-workshop/backend/modules/ai/services/providers"

// GetToolDefsForLLM returns the tool list exposed to the model.
func GetToolDefsForLLM() []providers.ToolDef {
	return []providers.ToolDef{
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "search_knowledge",
				Description: "Search the Alkaid knowledge base for best practices, error fixes, scene templates, or node usage guides. You may call this tool multiple times. If the first search is still uncertain, narrow the search with a more specific query, target, or category and search again before finalizing the workflow.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"query": map[string]interface{}{
							"type":        "string",
							"description": "Search keywords or question. Start broad, then refine if needed.",
						},
						"maxResults": map[string]interface{}{
							"type":        "integer",
							"description": "Optional. Number of results to return. Default 5, max 10.",
							"minimum":     1,
							"maximum":     10,
						},
						"target": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Narrow the search to a target node or theme, such as crawler, ai, or dataclean.",
						},
						"category": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Narrow the search to node_usage, best_practice, error_repair, or scene_template.",
						},
						"includeGeneralFallback": map[string]interface{}{
							"type":        "boolean",
							"description": "Optional. Whether to append general best-practice/error-repair items if scoped results are not enough. Default true.",
						},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "list_project_website_sources",
				Description: "List the current project's website sources so you can reuse real project-specific site metadata when generating crawler workflows. Prefer this tool when the user mentions a known project site, source site, entry page, or asks to generate a crawler from existing website-source assets.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"projectId": map[string]interface{}{
							"type":        "integer",
							"description": "Optional. Project ID. If omitted, the tool tries to infer the current project from the session workflow.",
						},
						"keyword": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Filter website sources by name, base URL, entry URL, or crawl tips.",
						},
						"status": map[string]interface{}{
							"type":        "string",
							"description": "Optional. Filter by source status, such as active, paused, or invalid.",
						},
						"page": map[string]interface{}{
							"type":        "integer",
							"description": "Optional. Page number starting from 1. Default 1.",
							"minimum":     1,
						},
						"pageSize": map[string]interface{}{
							"type":        "integer",
							"description": "Optional. Items per page. Default 20, max 50.",
							"minimum":     1,
							"maximum":     50,
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "check_url_accessibility",
				Description: "Check whether a URL is suitable as a crawler data source. Use this before finalizing a crawler node when the workflow depends on external websites.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"url": map[string]interface{}{
							"type":        "string",
							"description": "The full http/https URL to inspect.",
						},
						"timeoutMs": map[string]interface{}{
							"type":        "integer",
							"description": "Optional timeout in milliseconds. Default 8000.",
							"minimum":     1000,
							"maximum":     15000,
						},
					},
					"required": []string{"url"},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_capabilities",
				Description: "Get supported node types, workflow JSON rules, connection constraints, and variable syntax. Call this before generating a workflow when you need technical constraints.",
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
				Description: "Get the current canvas workflow. Only call this when the user asks to inspect or modify an existing workflow. Do not call it for brand new workflows.",
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
				Description: "Get the detailed specification of a node type, including required config and IO structure.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"nodeType": map[string]interface{}{
							"type":        "string",
							"description": "Node type, such as crawler, ai, dataclean, merge, delay, output, or condition.",
						},
					},
					"required": []string{"nodeType"},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "list_workflows",
				Description: "List the user's workflows with summary fields. Use this when the user refers to a previously created workflow but does not specify the workflow ID.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"page": map[string]interface{}{
							"type":        "number",
							"description": "Page number starting from 1. Default 1.",
						},
						"pageSize": map[string]interface{}{
							"type":        "number",
							"description": "Items per page. Default 20, max 100.",
						},
					},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_available_models",
				Description: "Get the currently available AI models. Use this when configuring or repairing AI nodes so you do not invent a model name.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		},
		{
			Type: "function",
			Function: &providers.ToolDefFunc{
				Name:        "get_user_constraints",
				Description: "Get workflow generation preferences and constraints, such as keeping node count minimal when possible, avoiding certain node types, and whether there is any hard upper limit.",
				Parameters: map[string]interface{}{
					"type":       "object",
					"properties": map[string]interface{}{},
				},
			},
		},
	}
}

func FilterToolDefsByName(toolDefs []providers.ToolDef, allowed map[string]struct{}) []providers.ToolDef {
	if len(toolDefs) == 0 || len(allowed) == 0 {
		return nil
	}

	filtered := make([]providers.ToolDef, 0, len(toolDefs))
	for _, toolDef := range toolDefs {
		if toolDef.Function == nil {
			continue
		}
		if _, ok := allowed[toolDef.Function.Name]; !ok {
			continue
		}
		filtered = append(filtered, toolDef)
	}
	return filtered
}

package agentic

import "yaolight-workshop/backend/modules/ai/services/providers"

func taskModeFromRequest(req RunStreamRequest, fallback TaskMode) TaskMode {
	if req.Context == nil {
		return fallback
	}
	if raw, ok := req.Context["taskMode"].(string); ok && raw != "" {
		return TaskMode(raw)
	}
	return fallback
}

func isKnowledgeToolEnabled(ctx map[string]interface{}) bool {
	return boolFromRequestContext(ctx, "allowKnowledgeTools", true)
}

func isWebsiteSourceToolEnabled(ctx map[string]interface{}) bool {
	return boolFromRequestContext(ctx, "allowWebsiteSourceTools", true)
}

func boolFromRequestContext(ctx map[string]interface{}, key string, defaultValue bool) bool {
	if ctx == nil {
		return defaultValue
	}
	raw, exists := ctx[key]
	if !exists {
		return defaultValue
	}
	switch value := raw.(type) {
	case bool:
		return value
	default:
		return defaultValue
	}
}

func isToolEnabledForRequest(ctx map[string]interface{}, toolName string) bool {
	switch toolName {
	case "search_knowledge":
		return isKnowledgeToolEnabled(ctx)
	case "list_project_website_sources":
		return isWebsiteSourceToolEnabled(ctx)
	default:
		return true
	}
}

func FilterToolDefsForRequest(toolDefs []providers.ToolDef, requestContext map[string]interface{}) []providers.ToolDef {
	if len(toolDefs) == 0 {
		return nil
	}
	filtered := make([]providers.ToolDef, 0, len(toolDefs))
	for _, toolDef := range toolDefs {
		if toolDef.Function == nil {
			continue
		}
		if !isToolEnabledForRequest(requestContext, toolDef.Function.Name) {
			continue
		}
		filtered = append(filtered, toolDef)
	}
	return filtered
}

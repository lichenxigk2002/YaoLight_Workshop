package tools

import (
	"fmt"
	"strings"

	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

// toolSearchKnowledge is used when no runner is attached.
func toolSearchKnowledge(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	summary := "知识检索不可用：未初始化工具运行环境"
	return map[string]interface{}{"unavailable": true, "summary": summary, "results": []interface{}{}}, summary, nil
}

// runSearchKnowledge retrieves knowledge snippets for the current session/user.
func (r *Registry) runSearchKnowledge(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	query := strings.TrimSpace(stringParam(params, "query"))
	if query == "" {
		return nil, "", fmt.Errorf("query 参数不能为空")
	}

	maxResults := intParam(params, "maxResults")
	if maxResults <= 0 {
		maxResults = 5
	}
	if maxResults > 10 {
		maxResults = 10
	}

	target := strings.TrimSpace(stringParam(params, "target"))
	category := strings.TrimSpace(stringParam(params, "category"))
	includeGeneralFallback := boolParam(params, "includeGeneralFallback", true)
	projectID := uint(intParam(params, "projectId"))
	workflowID := uint(intParam(params, "workflowId"))

	retriever := alkaidServices.NewKnowledgeRetriever()
	userID := uint(0)
	if r.runner != nil && r.runner.Repo != nil {
		if session, err := r.runner.Repo.GetSessionByID(sessionID); err == nil && session != nil {
			userID = session.UserID
		}
	}

	knowledge, err := retriever.RetrieveRelevantKnowledgeWithOptions(alkaidServices.KnowledgeRetrieveOptions{
		Query:          query,
		Target:         target,
		Category:       category,
		MaxResults:     maxResults,
		IncludeGeneral: includeGeneralFallback,
		ProjectID:      projectID,
		WorkflowID:     workflowID,
	}, userID)
	if err != nil {
		return nil, "", fmt.Errorf("知识检索失败: %w", err)
	}

	results := make([]map[string]interface{}, len(knowledge))
	for i, k := range knowledge {
		results[i] = map[string]interface{}{
			"title":    k.Title,
			"category": k.Category,
			"target":   k.Target,
			"content":  k.Content,
		}
	}

	summary := fmt.Sprintf("找到 %d 条相关知识", len(knowledge))
	if len(knowledge) == 0 {
		summary = "未找到相关知识"
	}

	return map[string]interface{}{
		"query":                     query,
		"target":                    target,
		"category":                  category,
		"projectId":                 projectID,
		"workflowId":                workflowID,
		"includeGeneralFallback":    includeGeneralFallback,
		"resultCount":               len(knowledge),
		"results":                   results,
		"searchSuggestionIfUnclear": buildKnowledgeSearchSuggestion(query, target, category),
	}, summary, nil
}

func stringParam(params map[string]interface{}, key string) string {
	if value, ok := params[key].(string); ok {
		return value
	}
	return ""
}

func boolParam(params map[string]interface{}, key string, defaultValue bool) bool {
	value, ok := params[key]
	if !ok {
		return defaultValue
	}
	switch v := value.(type) {
	case bool:
		return v
	case string:
		trimmed := strings.TrimSpace(strings.ToLower(v))
		if trimmed == "true" {
			return true
		}
		if trimmed == "false" {
			return false
		}
	}
	return defaultValue
}

func buildKnowledgeSearchSuggestion(query string, target string, category string) string {
	switch {
	case target == "" && category == "":
		return fmt.Sprintf("如果结果仍不确定，可以继续缩小范围，例如指定 target 或 category 再搜索一次：query=%q", query)
	case target != "" && category == "":
		return fmt.Sprintf("如果结果仍不确定，可以保留 target=%q，并进一步指定 category（如 best_practice 或 error_repair）再次搜索", target)
	case target == "" && category != "":
		return fmt.Sprintf("如果结果仍不确定，可以保留 category=%q，并补充 target 再搜索一次", category)
	default:
		return "如果结果仍不确定，可以换一个更具体的 query 再搜索一次"
	}
}

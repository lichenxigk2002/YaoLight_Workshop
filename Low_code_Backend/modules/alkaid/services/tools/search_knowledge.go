package tools

import (
	"fmt"
	alkaidServices "yaolight-workshop/backend/modules/alkaid/services"
)

// toolSearchKnowledge 占位（无 Runner 时使用）
func toolSearchKnowledge(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"placeholder": true}, "知识检索占位", nil
}

// runSearchKnowledge 真实实现：从知识库检索相关信息
func (r *Registry) runSearchKnowledge(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	query, ok := params["query"].(string)
	if !ok || query == "" {
		return nil, "", fmt.Errorf("query 参数不能为空")
	}

	// 使用知识检索服务
	retriever := alkaidServices.NewKnowledgeRetriever()
	userID := uint(0) // TODO: 从 RequestContext 中获取 userID
	if r.runner != nil && r.runner.Repo != nil {
		// 尝试从 session 获取 userID
		if session, err := r.runner.Repo.GetSessionByID(sessionID); err == nil && session != nil {
			userID = session.UserID
		}
	}

	knowledge, err := retriever.RetrieveRelevantKnowledge(query, userID, 5)
	if err != nil {
		return nil, "", fmt.Errorf("知识检索失败: %w", err)
	}

	if len(knowledge) == 0 {
		return map[string]interface{}{
			"query":   query,
			"results": []interface{}{},
		}, "未找到相关知识", nil
	}

	// 格式化返回结果
	results := make([]map[string]interface{}, len(knowledge))
	for i, k := range knowledge {
		results[i] = map[string]interface{}{
			"title":    k.Title,
			"category": k.Category,
			"content":  k.Content,
		}
	}

	summary := fmt.Sprintf("找到 %d 条相关知识", len(knowledge))
	return map[string]interface{}{
		"query":   query,
		"results": results,
	}, summary, nil
}

package services

import (
	"strings"
	"yaolight-workshop/backend/infrastructure/database"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

// KnowledgeRetriever 知识库智能检索器
// 负责根据用户问题按需检索相关知识库条目，避免全量注入
type KnowledgeRetriever struct {
	knowledgeService *KnowledgeService
}

// NewKnowledgeRetriever 创建知识库检索器
func NewKnowledgeRetriever() *KnowledgeRetriever {
	return &KnowledgeRetriever{
		knowledgeService: &KnowledgeService{},
	}
}

// RetrieveRelevantKnowledge 根据用户消息智能检索相关知识库条目
// 返回最相关的知识条目，最多返回 maxResults 条
func (kr *KnowledgeRetriever) RetrieveRelevantKnowledge(userMessage string, userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	if maxResults <= 0 {
		maxResults = 5 // 默认最多5条
	}
	if maxResults > 10 {
		maxResults = 10 // 限制最多10条，避免token过多
	}

	// 1. 提取关键词
	keywords := kr.extractKeywords(userMessage)

	// 2. 如果没有关键词，返回通用的最佳实践和错误修复（限制数量）
	if len(keywords) == 0 {
		return kr.getGeneralKnowledge(userID, maxResults)
	}

	// 3. 根据关键词检索
	results, err := kr.searchByKeywords(keywords, userID, maxResults)
	if err != nil {
		return nil, err
	}

	// 4. 如果检索结果不足，补充通用知识
	if len(results) < maxResults {
		general, _ := kr.getGeneralKnowledge(userID, maxResults-len(results))
		results = append(results, general...)
	}

	return results, nil
}

// extractKeywords 从用户消息中提取关键词
// 返回节点类型、操作类型等关键词
func (kr *KnowledgeRetriever) extractKeywords(userMessage string) []string {
	keywords := []string{}
	userMessageLower := strings.ToLower(userMessage)

	// 节点类型关键词映射（英文 -> 节点类型）
	nodeTypeMap := map[string]string{
		"start":     "start",
		"开始":        "start",
		"crawler":   "crawler",
		"爬虫":        "crawler",
		"dataclean": "dataclean",
		"数据清洗":      "dataclean",
		"清洗":        "dataclean",
		"ai":        "ai",
		"人工智能":      "ai",
		"output":    "output",
		"输出":        "output",
		"condition": "condition",
		"条件":        "condition",
		"分支":        "condition",
		"transform": "transform",
		"转换":        "transform",
		"loop":      "loop",
		"循环":        "loop",
		"merge":     "merge",
		"合并":        "merge",
		"delay":     "delay",
		"延迟":        "delay",
		"等待":        "delay",
		"end":       "end",
		"结束":        "end",
	}

	// 检查是否提到节点类型
	matchedTypes := make(map[string]bool)
	for keyword, nodeType := range nodeTypeMap {
		if strings.Contains(userMessageLower, keyword) {
			if !matchedTypes[nodeType] {
				keywords = append(keywords, nodeType)
				matchedTypes[nodeType] = true
			}
		}
	}

	// 操作类型关键词
	operationKeywords := []string{
		"错误", "修复", "失败", "超时", "问题", "报错",
		"最佳实践", "推荐", "建议", "如何", "怎么",
		"配置", "设置", "使用", "示例", "模板",
		"变量", "引用", "连接", "连线",
	}

	for _, keyword := range operationKeywords {
		if strings.Contains(userMessage, keyword) {
			keywords = append(keywords, keyword)
		}
	}

	return keywords
}

// searchByKeywords 根据关键词搜索相关知识
func (kr *KnowledgeRetriever) searchByKeywords(keywords []string, userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	// 1. 优先按节点类型（target）检索
	var results []alkaidModels.AlkaidKnowledge
	nodeTypeKeywords := []string{}
	operationKeywords := []string{}

	for _, keyword := range keywords {
		// 判断是否为节点类型
		nodeTypes := []string{"start", "crawler", "dataclean", "ai", "output", "condition", "transform", "loop", "merge", "delay", "end"}
		isNodeType := false
		for _, nt := range nodeTypes {
			if keyword == nt {
				isNodeType = true
				break
			}
		}

		if isNodeType {
			nodeTypeKeywords = append(nodeTypeKeywords, keyword)
		} else {
			operationKeywords = append(operationKeywords, keyword)
		}
	}

	// 2. 如果有关键节点类型，优先检索该节点的使用说明和最佳实践
	if len(nodeTypeKeywords) > 0 {
		for _, nodeType := range nodeTypeKeywords {
			// 检索该节点的所有相关知识（使用说明、最佳实践、错误修复）
			nodeKnowledge, err := kr.knowledgeService.GetKnowledgeByTarget(nodeType, userID)
			if err == nil && len(nodeKnowledge) > 0 {
				// 限制每种类型最多2条
				if len(nodeKnowledge) > 2 {
					nodeKnowledge = nodeKnowledge[:2]
				}
				results = append(results, nodeKnowledge...)
			}
		}
	}

	// 3. 如果还有空间，根据操作关键词检索
	if len(results) < maxResults && len(operationKeywords) > 0 {
		searchQuery := strings.Join(operationKeywords, " ")
		searchResults, err := kr.knowledgeService.SearchKnowledge(searchQuery)
		if err == nil {
			// 去重并限制数量
			existingTitles := make(map[string]bool)
			for _, r := range results {
				existingTitles[r.Title] = true
			}

			for _, r := range searchResults {
				if len(results) >= maxResults {
					break
				}
				if !existingTitles[r.Title] {
					results = append(results, r)
					existingTitles[r.Title] = true
				}
			}
		}
	}

	// 4. 限制返回数量
	if len(results) > maxResults {
		results = results[:maxResults]
	}

	return results, nil
}

// getGeneralKnowledge 获取通用知识（最佳实践和错误修复）
func (kr *KnowledgeRetriever) getGeneralKnowledge(userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	var results []alkaidModels.AlkaidKnowledge

	// 优先获取最佳实践和错误修复
	err := database.DB.Where(
		"is_active = ? AND category IN (?) AND (user_id IS NULL OR user_id = ?)",
		true, []string{"best_practice", "error_repair"}, userID,
	).Order("category ASC").Limit(maxResults).Find(&results).Error

	return results, err
}

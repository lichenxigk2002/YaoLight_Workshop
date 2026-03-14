package services

import (
	"strings"
	"time"

	"yaolight-workshop/backend/infrastructure/database"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

// KnowledgeRetriever retrieves relevant knowledge snippets for Alkaid.
type KnowledgeRetriever struct {
	knowledgeService *KnowledgeService
}

type KnowledgeRetrieveOptions struct {
	Query          string
	Target         string
	Category       string
	MaxResults     int
	IncludeGeneral bool
}

func NewKnowledgeRetriever() *KnowledgeRetriever {
	return &KnowledgeRetriever{
		knowledgeService: &KnowledgeService{},
	}
}

// RetrieveRelevantKnowledge keeps backward-compatible behavior for general retrieval.
func (kr *KnowledgeRetriever) RetrieveRelevantKnowledge(userMessage string, userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	return kr.RetrieveRelevantKnowledgeWithOptions(KnowledgeRetrieveOptions{
		Query:          userMessage,
		MaxResults:     maxResults,
		IncludeGeneral: true,
	}, userID)
}

// RetrieveRelevantKnowledgeWithOptions supports narrower retrieval for a target/category.
func (kr *KnowledgeRetriever) RetrieveRelevantKnowledgeWithOptions(opts KnowledgeRetrieveOptions, userID uint) ([]alkaidModels.AlkaidKnowledge, error) {
	maxResults := opts.MaxResults
	if maxResults <= 0 {
		maxResults = 5
	}
	if maxResults > 10 {
		maxResults = 10
	}

	if strings.TrimSpace(opts.Target) != "" || strings.TrimSpace(opts.Category) != "" {
		return kr.retrieveScopedKnowledge(opts, userID, maxResults)
	}

	keywords := kr.extractKeywords(opts.Query)
	if len(keywords) == 0 {
		return kr.getGeneralKnowledge(userID, maxResults)
	}

	results, err := kr.searchByKeywords(keywords, userID, maxResults)
	if err != nil {
		return nil, err
	}

	if len(results) < maxResults {
		general, _ := kr.getGeneralKnowledge(userID, maxResults-len(results))
		results = appendDedupKnowledge(results, general, maxResults)
	}

	if len(results) == 0 {
		results = getBuiltinFallbackKnowledge(maxResults)
	}

	return results, nil
}

func (kr *KnowledgeRetriever) retrieveScopedKnowledge(opts KnowledgeRetrieveOptions, userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	results := make([]alkaidModels.AlkaidKnowledge, 0, maxResults)
	target := strings.TrimSpace(opts.Target)
	category := strings.TrimSpace(opts.Category)
	query := strings.TrimSpace(opts.Query)
	includeGeneral := opts.IncludeGeneral

	if target != "" {
		items, err := kr.knowledgeService.GetKnowledgeByTargetAndCategory(target, category, userID, maxResults)
		if err != nil {
			return nil, err
		}
		results = appendDedupKnowledge(results, items, maxResults)
	} else if category != "" {
		items, err := kr.knowledgeService.GetKnowledgeByCategory(category, userID, maxResults)
		if err != nil {
			return nil, err
		}
		results = appendDedupKnowledge(results, items, maxResults)
	}

	if len(results) < maxResults && query != "" {
		items, err := kr.knowledgeService.SearchKnowledgeScoped(KnowledgeSearchOptions{
			Query:    query,
			UserID:   userID,
			Limit:    maxResults - len(results),
			Category: category,
			Target:   target,
		})
		if err != nil {
			return nil, err
		}
		results = appendDedupKnowledge(results, items, maxResults)
	}

	if len(results) < maxResults && includeGeneral {
		general, _ := kr.getGeneralKnowledge(userID, maxResults-len(results))
		results = appendDedupKnowledge(results, general, maxResults)
	}

	if len(results) == 0 {
		results = getBuiltinFallbackKnowledge(maxResults)
	}

	return results, nil
}

func (kr *KnowledgeRetriever) extractKeywords(userMessage string) []string {
	keywords := []string{}
	userMessageLower := strings.ToLower(userMessage)

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

	matchedTypes := make(map[string]bool)
	for keyword, nodeType := range nodeTypeMap {
		if strings.Contains(userMessageLower, strings.ToLower(keyword)) && !matchedTypes[nodeType] {
			keywords = append(keywords, nodeType)
			matchedTypes[nodeType] = true
		}
	}

	operationKeywords := []string{
		"错误", "修复", "失败", "超时", "问题", "报错",
		"最佳实践", "推荐", "建议", "如何", "怎么",
		"配置", "设置", "使用", "示例", "模板",
		"变量", "引用", "连接", "连线",
		"链接", "网址", "网站", "抓取", "正文",
	}

	for _, keyword := range operationKeywords {
		if strings.Contains(userMessage, keyword) {
			keywords = append(keywords, keyword)
		}
	}

	return keywords
}

func (kr *KnowledgeRetriever) searchByKeywords(keywords []string, userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	results := make([]alkaidModels.AlkaidKnowledge, 0, maxResults)
	nodeTypeKeywords := []string{}
	operationKeywords := []string{}
	nodeTypes := map[string]bool{
		"start": true, "crawler": true, "dataclean": true, "ai": true, "output": true,
		"condition": true, "transform": true, "loop": true, "merge": true, "delay": true, "end": true,
	}

	for _, keyword := range keywords {
		if nodeTypes[keyword] {
			nodeTypeKeywords = append(nodeTypeKeywords, keyword)
		} else {
			operationKeywords = append(operationKeywords, keyword)
		}
	}

	for _, nodeType := range nodeTypeKeywords {
		if len(results) >= maxResults {
			break
		}
		nodeKnowledge, err := kr.knowledgeService.GetKnowledgeByTarget(nodeType, userID)
		if err == nil && len(nodeKnowledge) > 0 {
			if len(nodeKnowledge) > 2 {
				nodeKnowledge = nodeKnowledge[:2]
			}
			results = appendDedupKnowledge(results, nodeKnowledge, maxResults)
		}
	}

	if len(results) < maxResults && len(operationKeywords) > 0 {
		searchQuery := strings.Join(operationKeywords, " ")
		searchResults, err := kr.knowledgeService.SearchKnowledge(searchQuery, userID, maxResults-len(results))
		if err == nil {
			results = appendDedupKnowledge(results, searchResults, maxResults)
		}
	}

	if len(results) > maxResults {
		results = results[:maxResults]
	}

	return results, nil
}

func (kr *KnowledgeRetriever) getGeneralKnowledge(userID uint, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	var results []alkaidModels.AlkaidKnowledge
	err := database.DB.Model(&alkaidModels.AlkaidKnowledge{}).Where(
		"is_active = ? AND category IN (?) AND (user_id IS NULL OR user_id = ?)",
		true, []string{"best_practice", "error_repair"}, userID,
	).Order("category ASC").Limit(maxResults).Find(&results).Error

	return results, err
}

func appendDedupKnowledge(base []alkaidModels.AlkaidKnowledge, incoming []alkaidModels.AlkaidKnowledge, maxResults int) []alkaidModels.AlkaidKnowledge {
	seen := make(map[uint]bool, len(base))
	seenTitle := make(map[string]bool, len(base))
	for _, item := range base {
		if item.ID != 0 {
			seen[item.ID] = true
		}
		seenTitle[item.Title] = true
	}
	for _, item := range incoming {
		if len(base) >= maxResults {
			break
		}
		if item.ID != 0 && seen[item.ID] {
			continue
		}
		if seenTitle[item.Title] {
			continue
		}
		base = append(base, item)
		if item.ID != 0 {
			seen[item.ID] = true
		}
		seenTitle[item.Title] = true
	}
	return base
}

func getBuiltinFallbackKnowledge(maxResults int) []alkaidModels.AlkaidKnowledge {
	if maxResults <= 0 {
		maxResults = 2
	}
	now := time.Now()
	all := []alkaidModels.AlkaidKnowledge{
		{
			Category:  "best_practice",
			Target:    "",
			Title:     "工作流通用建议",
			Content:   "1. 节点间使用变量引用：{{nodeId.outputVar}}，如 {{node-1.data.url}}。\n2. 典型链路：开始 -> 爬虫 -> 数据清洗 -> AI处理 -> 输出 -> 结束。\n3. crawler 节点优先用 urlVariable 引用开始节点的 URL，AI 节点用 contentVariable 引用上游文本。",
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		},
		{
			Category:  "error_repair",
			Target:    "",
			Title:     "常见问题与排查",
			Content:   "变量引用错误：检查上游节点是否已输出对应变量名（如 data、text、cleaned）。\n超时：为 crawler 节点增加 timeout 或重试配置。\nJSON 格式：工作流导出需包含 version、nodes、edges，节点需含 id、type、data、position。",
			IsActive:  true,
			CreatedAt: now,
			UpdatedAt: now,
		},
	}
	if len(all) > maxResults {
		all = all[:maxResults]
	}
	return all
}

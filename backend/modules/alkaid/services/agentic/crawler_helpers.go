package agentic

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"yaolight-workshop/backend/modules/alkaid/services/tools"
)

var absoluteURLRe = regexp.MustCompile(`https?://[^\s"'<>]+`)

func collectWorkflowURLCandidates(workflow map[string]interface{}) []string {
	nodes, _ := workflow["nodes"].([]interface{})
	if len(nodes) == 0 {
		return nil
	}

	seen := make(map[string]struct{})
	urls := make([]string, 0, 8)
	addURL := func(raw string) {
		raw = strings.TrimSpace(raw)
		raw = strings.TrimRight(raw, ".,);]")
		if raw == "" || strings.Contains(raw, "{{") {
			return
		}
		if _, exists := seen[raw]; exists {
			return
		}
		seen[raw] = struct{}{}
		urls = append(urls, raw)
	}

	var walk func(v interface{})
	walk = func(v interface{}) {
		switch value := v.(type) {
		case map[string]interface{}:
			for _, child := range value {
				walk(child)
			}
		case []interface{}:
			for _, child := range value {
				walk(child)
			}
		case string:
			text := strings.TrimSpace(value)
			if text == "" || strings.Contains(text, "{{") {
				return
			}
			if (strings.HasPrefix(text, "{") || strings.HasPrefix(text, "[")) && json.Valid([]byte(text)) {
				var decoded interface{}
				if err := json.Unmarshal([]byte(text), &decoded); err == nil {
					walk(decoded)
					return
				}
			}
			for _, match := range absoluteURLRe.FindAllString(text, -1) {
				addURL(match)
			}
		}
	}

	for _, rawNode := range nodes {
		nodeMap, ok := rawNode.(map[string]interface{})
		if !ok {
			continue
		}
		nodeType, _ := nodeMap["type"].(string)
		if nodeType == "" {
			if dataMap, ok := nodeMap["data"].(map[string]interface{}); ok {
				nodeType, _ = dataMap["type"].(string)
			}
		}
		if nodeType != "start" && nodeType != "crawler" {
			continue
		}

		dataMap, ok := nodeMap["data"].(map[string]interface{})
		if !ok {
			continue
		}
		configMap, ok := dataMap["config"].(map[string]interface{})
		if !ok {
			continue
		}
		walk(configMap)
	}

	return urls
}

func validateWorkflowSourceURLs(registry *tools.Registry, urls []string, sessionID uint) (interface{}, string, error) {
	results := make([]map[string]interface{}, 0, len(urls))
	failureReasons := make([]string, 0)
	okCount := 0

	for _, rawURL := range urls {
		result, _, err := registry.ExecuteToolForMode(string(TaskGenerate), "check_url_accessibility", fmt.Sprintf(`{"url":%q}`, rawURL), sessionID)
		if err != nil {
			return nil, "", err
		}

		resultMap, ok := result.(map[string]interface{})
		if !ok {
			return nil, "", fmt.Errorf("链接预检结果类型异常: %T", result)
		}

		checkOK, _ := resultMap["ok"].(bool)
		if checkOK {
			okCount++
		} else {
			reason, _ := resultMap["reason"].(string)
			if reason == "" {
				reason = "链接不可直接抓取"
			}
			failureReasons = append(failureReasons, fmt.Sprintf("%s (%s)", rawURL, reason))
		}
		results = append(results, resultMap)
	}

	failedCount := len(urls) - okCount
	summary := fmt.Sprintf("已校验 %d 个数据源，%d 个可直接抓取", len(urls), okCount)
	return map[string]interface{}{
		"checked_count":   len(urls),
		"ok_count":        okCount,
		"failed_count":    failedCount,
		"results":         results,
		"failure_reasons": failureReasons,
	}, summary, nil
}

func shouldForceCrawlerPreparation(message string) bool {
	normalized := strings.ToLower(strings.TrimSpace(message))
	if normalized == "" {
		return false
	}

	keywords := []string{
		"crawler", "scrape", "scraper", "crawl", "spider",
		"爬虫", "抓取", "采集", "网页", "网站", "正文页", "详情页",
	}
	for _, keyword := range keywords {
		if strings.Contains(normalized, keyword) {
			return true
		}
	}

	return len(absoluteURLRe.FindAllString(normalized, -1)) > 0
}

func extractAbsoluteURLsFromText(text string) []string {
	matches := absoluteURLRe.FindAllString(text, -1)
	if len(matches) == 0 {
		return nil
	}

	seen := make(map[string]struct{}, len(matches))
	result := make([]string, 0, len(matches))
	for _, match := range matches {
		raw := strings.TrimSpace(match)
		if raw == "" {
			continue
		}
		if _, exists := seen[raw]; exists {
			continue
		}
		seen[raw] = struct{}{}
		result = append(result, raw)
	}
	return result
}

func workflowHasNodeType(workflow map[string]interface{}, nodeType string) bool {
	nodes, _ := workflow["nodes"].([]interface{})
	for _, rawNode := range nodes {
		nodeMap, ok := rawNode.(map[string]interface{})
		if !ok {
			continue
		}
		currentType, _ := nodeMap["type"].(string)
		if currentType == "" {
			if dataMap, ok := nodeMap["data"].(map[string]interface{}); ok {
				currentType, _ = dataMap["type"].(string)
			}
		}
		if currentType == nodeType {
			return true
		}
	}
	return false
}

func ensureCrawlerNodeDefaults(workflow map[string]interface{}) bool {
	nodes, _ := workflow["nodes"].([]interface{})
	changed := false

	for _, rawNode := range nodes {
		nodeMap, ok := rawNode.(map[string]interface{})
		if !ok {
			continue
		}
		nodeType, _ := nodeMap["type"].(string)
		if nodeType == "" {
			if dataMap, ok := nodeMap["data"].(map[string]interface{}); ok {
				nodeType, _ = dataMap["type"].(string)
			}
		}
		if nodeType != "crawler" {
			continue
		}

		dataMap, ok := nodeMap["data"].(map[string]interface{})
		if !ok {
			continue
		}
		configMap, ok := dataMap["config"].(map[string]interface{})
		if !ok || configMap == nil {
			configMap = map[string]interface{}{}
			dataMap["config"] = configMap
			changed = true
		}

		if stringFieldValue(configMap["method"]) == "" {
			configMap["method"] = "GET"
			changed = true
		}
		if stringFieldValue(configMap["extractMode"]) == "" {
			configMap["extractMode"] = "smart"
			changed = true
		}
		if stringFieldValue(configMap["extractType"]) == "" {
			configMap["extractType"] = "text"
			changed = true
		}
		if _, exists := configMap["timeout"]; !exists {
			configMap["timeout"] = 30
			changed = true
		}
		if _, exists := configMap["retryCount"]; !exists {
			configMap["retryCount"] = 3
			changed = true
		}
		if _, exists := configMap["useHeadless"]; !exists {
			configMap["useHeadless"] = false
			changed = true
		}
	}

	return changed
}

func validateCrawlerNodeConfigs(workflow map[string]interface{}) []string {
	nodes, _ := workflow["nodes"].([]interface{})
	errors := make([]string, 0)

	for _, rawNode := range nodes {
		nodeMap, ok := rawNode.(map[string]interface{})
		if !ok {
			continue
		}
		nodeID, _ := nodeMap["id"].(string)
		nodeType, _ := nodeMap["type"].(string)
		if nodeType == "" {
			if dataMap, ok := nodeMap["data"].(map[string]interface{}); ok {
				nodeType, _ = dataMap["type"].(string)
			}
		}
		if nodeType != "crawler" {
			continue
		}

		dataMap, _ := nodeMap["data"].(map[string]interface{})
		configMap, _ := dataMap["config"].(map[string]interface{})
		if configMap == nil {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 缺少 config", nodeID))
			continue
		}

		urlValue := stringFieldValue(configMap["url"])
		urlVariable := stringFieldValue(configMap["urlVariable"])
		if urlValue == "" && urlVariable == "" {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 必须配置 url 或 urlVariable", nodeID))
		}

		extractMode := stringFieldValue(configMap["extractMode"])
		if extractMode == "" {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 缺少 extractMode", nodeID))
		}
		extractType := stringFieldValue(configMap["extractType"])
		if extractType == "" {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 缺少 extractType", nodeID))
		}
		method := stringFieldValue(configMap["method"])
		if method == "" {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 缺少 method", nodeID))
		}

		if extractMode == "custom" && stringFieldValue(configMap["selector"]) == "" {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 在 custom 模式下必须配置 selector", nodeID))
		}
		if extractType == "attr" && stringFieldValue(configMap["extractAttr"]) == "" {
			errors = append(errors, fmt.Sprintf("crawler 节点 %s 在 attr 提取下必须配置 extractAttr", nodeID))
		}
	}

	return errors
}

func stringFieldValue(value interface{}) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(fmt.Sprintf("%v", value))
}

package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"yaolight-workshop/backend/infrastructure/database"
	crawlerRepos "yaolight-workshop/backend/modules/crawler/repositories"
	crawlerService "yaolight-workshop/backend/modules/crawler/services"
)

func getCrawlerRuleID(config map[string]interface{}) uint {
	switch v := config["ruleId"].(type) {
	case float64:
		return uint(v)
	case int:
		return uint(v)
	case int64:
		return uint(v)
	case uint:
		return v
	case string:
		var id uint
		if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &id); err == nil {
			return id
		}
	}

	switch v := config["rule_id"].(type) {
	case float64:
		return uint(v)
	case int:
		return uint(v)
	case int64:
		return uint(v)
	case uint:
		return v
	case string:
		var id uint
		if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &id); err == nil {
			return id
		}
	}

	return 0
}

func (e *WorkflowExecutor) resolveCrawlerNodeURL(node NodeConfig, inputData *NodeData, variableContext *VariableContext) (string, *NodeExecutionResult) {
	urlConfig := getString(node.Config, "url", "")
	urlVariable := getString(node.Config, "urlVariable", "")

	var finalURL string

	if urlVariable != "" {
		varPath := strings.Trim(urlVariable, "{{}}")
		varPath = strings.TrimSpace(varPath)

		urlVar, err := variableContext.GetVariable(varPath)
		if err == nil && urlVar != nil {
			if urlStr, ok := urlVar.(string); ok {
				finalURL = urlStr
			} else if urlMap, ok := urlVar.(map[string]interface{}); ok {
				finalURL = extractURLFromMap(urlMap)
				if finalURL == "" {
					finalURL = fmt.Sprintf("%v", urlVar)
				}
			} else {
				finalURL = fmt.Sprintf("%v", urlVar)
			}
		} else {
			resolved, err := variableContext.ResolveTemplateToInterface(urlVariable)
			if err == nil && resolved != nil {
				if urlStr, ok := resolved.(string); ok {
					if !strings.Contains(urlStr, "{{") {
						finalURL = urlStr
					}
				} else if urlMap, ok := resolved.(map[string]interface{}); ok {
					finalURL = extractURLFromMap(urlMap)
				} else {
					finalURL = fmt.Sprintf("%v", resolved)
				}
			}

			if finalURL == "" {
				resolved, err := variableContext.ResolveTemplate(urlVariable)
				if err == nil && resolved != "" && !strings.Contains(resolved, "{{") {
					finalURL = resolved
				}
			}

			if finalURL == "" && inputData != nil && inputData.Payload != nil {
				varPath := strings.Trim(urlVariable, "{{}}")
				varPath = strings.TrimSpace(varPath)
				parts := strings.Split(varPath, ".")
				if len(parts) >= 2 {
					variablePath := strings.Join(parts[1:], ".")
					urlValue, err := GetDataByPath(inputData.Payload, variablePath)
					if err == nil && urlValue != nil {
						if urlStr, ok := urlValue.(string); ok && urlStr != "" {
							finalURL = urlStr
						} else if urlMap, ok := urlValue.(map[string]interface{}); ok {
							finalURL = extractURLFromMap(urlMap)
						}
					}

					if finalURL == "" && len(parts) >= 3 && parts[1] == "data" {
						dataValue, err := GetDataByPath(inputData.Payload, "data")
						if err == nil && dataValue != nil {
							if dataMap, ok := dataValue.(map[string]interface{}); ok {
								finalURL = extractURLFromMapWithFallback(dataMap, parts[2])
							}
						}
					}

					if finalURL == "" {
						if payloadMap, ok := inputData.Payload.(map[string]interface{}); ok {
							finalURL = extractURLFromMap(payloadMap)
						}
					}
				}
			}
		}

		if finalURL != "" && strings.Contains(finalURL, "{{") {
			result := NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "crawler",
				Success: false,
				Error:   fmt.Sprintf("URL变量解析失败: %s，请检查变量是否存在", urlVariable),
			}
			return "", &result
		}

		if finalURL == "" {
			result := NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "crawler",
				Success: false,
				Error:   fmt.Sprintf("URL变量 %s 解析后为空值，请检查变量路径是否正确或变量是否存在", urlVariable),
			}
			return "", &result
		}
	}

	if finalURL == "" && urlConfig != "" {
		if strings.Contains(urlConfig, "{{") {
			resolved, err := variableContext.ResolveTemplate(urlConfig)
			if err == nil && resolved != "" {
				finalURL = resolved
			} else {
				finalURL = urlConfig
			}
		} else {
			finalURL = urlConfig
		}
	}

	if finalURL == "" {
		if inputData != nil && inputData.Payload != nil {
			if urlMap, ok := inputData.Payload.(map[string]interface{}); ok {
				if url, exists := urlMap["url"]; exists {
					finalURL = fmt.Sprintf("%v", url)
				}
			}
		}
		if finalURL == "" {
			if urlVar, err := variableContext.GetVariable("url"); err == nil {
				finalURL = fmt.Sprintf("%v", urlVar)
			}
		}
	}

	return finalURL, nil
}

func (e *WorkflowExecutor) buildCrawlerConfigFromNode(node NodeConfig, finalURL string, variableContext *VariableContext) (crawlerService.CrawlerConfig, error) {
	extractMode := getString(node.Config, "extractMode", "smart")
	config := crawlerService.CrawlerConfig{
		URL:            finalURL,
		Method:         getString(node.Config, "method", "GET"),
		Selector:       getString(node.Config, "selector", ""),
		UserAgent:      getString(node.Config, "userAgent", ""),
		Timeout:        getInt(node.Config, "timeout", 30),
		Headers:        map[string]string{},
		Body:           getString(node.Config, "body", ""),
		BodyType:       getString(node.Config, "bodyType", "json"),
		Cookies:        map[string]string{},
		Proxy:          getString(node.Config, "proxy", ""),
		RetryCount:     getInt(node.Config, "retryCount", 3),
		RetryDelay:     getInt(node.Config, "retryDelay", 1),
		WaitTime:       getInt(node.Config, "waitTime", 0),
		ExtractType:    getString(node.Config, "extractType", "text"),
		ExtractAttr:    getString(node.Config, "extractAttr", ""),
		Encoding:       getString(node.Config, "encoding", "auto"),
		ExtractMode:    extractMode,
		SmartMode:      extractMode != "custom",
		JavaScriptWait: getInt(node.Config, "javascriptWait", 5),
	}

	if headers, exists := resolveCrawlerNodeStringMap(node.Config, "headers", variableContext); exists {
		config.Headers = headers
	}
	if cookies, exists := resolveCrawlerNodeStringMap(node.Config, "cookies", variableContext); exists {
		config.Cookies = cookies
	}
	if pagination := buildCrawlerPaginationConfig(node.Config); pagination != nil {
		config.Pagination = pagination
	}

	config.FollowRedirect = getBool(node.Config, "followRedirect", true)
	config.VerifySSL = getBool(node.Config, "verifySSL", true)
	config.UseHeadless = getBool(node.Config, "useHeadless", false)
	config.WaitForSelector = getString(node.Config, "waitForSelector", "")
	config.DisableImages = getBool(node.Config, "disableImages", false)

	return config, nil
}

func (e *WorkflowExecutor) buildCrawlerConfigFromRule(node NodeConfig, ruleID uint, finalURL string, variableContext *VariableContext) (crawlerService.CrawlerConfig, error) {
	repo := crawlerRepos.NewCrawlerRuleRepository(database.DB)
	rule, err := repo.FindByID(ruleID)
	if err != nil {
		return crawlerService.CrawlerConfig{}, err
	}
	if !rule.IsActive {
		return crawlerService.CrawlerConfig{}, fmt.Errorf("crawler rule %d is inactive", ruleID)
	}

	baseConfig, err := crawlerService.MapRuleToCrawlerConfig(rule)
	if err != nil {
		return crawlerService.CrawlerConfig{}, err
	}

	override := cloneCrawlerNodeConfig(node.Config)
	delete(override, "ruleId")
	delete(override, "rule_id")
	delete(override, "urlVariable")

	if finalURL != "" {
		override["url"] = finalURL
	}
	if headers, exists := resolveCrawlerNodeStringMap(node.Config, "headers", variableContext); exists {
		override["headers"] = headers
	}
	if cookies, exists := resolveCrawlerNodeStringMap(node.Config, "cookies", variableContext); exists {
		override["cookies"] = cookies
	}

	return crawlerService.MergeCrawlerConfig(baseConfig, override)
}

func resolveCrawlerNodeStringMap(config map[string]interface{}, key string, variableContext *VariableContext) (map[string]string, bool) {
	value, ok := config[key]
	if !ok {
		return nil, false
	}

	result := map[string]string{}
	if raw, ok := value.(string); ok {
		if strings.Contains(raw, "{{") {
			resolved, err := variableContext.ResolveTemplate(raw)
			if err == nil {
				raw = resolved
			}
		}
		var parsed map[string]interface{}
		if err := json.Unmarshal([]byte(raw), &parsed); err == nil {
			for k, v := range parsed {
				result[k] = fmt.Sprintf("%v", v)
			}
		}
		return result, true
	}

	if parsed, ok := value.(map[string]interface{}); ok {
		for k, v := range parsed {
			if strValue, ok := v.(string); ok && strings.Contains(strValue, "{{") {
				resolved, err := variableContext.ResolveTemplate(strValue)
				if err == nil {
					result[k] = resolved
				} else {
					result[k] = strValue
				}
				continue
			}
			result[k] = fmt.Sprintf("%v", v)
		}
		return result, true
	}

	return result, true
}

func buildCrawlerPaginationConfig(config map[string]interface{}) *crawlerService.PaginationConfig {
	paginationMap, ok := config["pagination"].(map[string]interface{})
	if !ok {
		return nil
	}

	pagination := &crawlerService.PaginationConfig{
		Enabled:   getBool(paginationMap, "enabled", false),
		Selector:  getString(paginationMap, "selector", ""),
		MaxPages:  getInt(paginationMap, "maxPages", 10),
		PageParam: getString(paginationMap, "pageParam", "page"),
		StartPage: getInt(paginationMap, "startPage", 1),
		Increment: getInt(paginationMap, "increment", 1),
	}
	if !pagination.Enabled {
		return nil
	}
	return pagination
}

func cloneCrawlerNodeConfig(config map[string]interface{}) map[string]interface{} {
	cloned := make(map[string]interface{}, len(config))
	for key, value := range config {
		cloned[key] = value
	}
	return cloned
}

func extractURLFromMap(value map[string]interface{}) string {
	return extractURLFromMapWithFallback(value, "")
}

func extractURLFromMapWithFallback(value map[string]interface{}, extra string) string {
	fields := []string{"url", "link", "href", "src", "data"}
	if extra != "" {
		fields = append(fields, extra)
	}
	for _, field := range fields {
		if raw, exists := value[field]; exists {
			if str, ok := raw.(string); ok && strings.TrimSpace(str) != "" {
				return str
			}
		}
	}
	return ""
}

package services

import (
	"encoding/json"
	"fmt"
	"strings"

	crawlerService "yaolight-workshop/backend/modules/crawler/services"
)

// executeCrawlerNode 执行爬虫节点
func (e *WorkflowExecutor) executeCrawlerNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据（可选，可用于动态URL等）
	inputData, _ := dataFlow.GetNodeInputData(node.ID)

	// 获取提取模式
	extractMode := getString(node.Config, "extractMode", "smart")

	// 获取URL配置
	urlConfig := getString(node.Config, "url", "")
	// 获取URL变量（独立字段）
	urlVariable := getString(node.Config, "urlVariable", "")

	// 解析URL
	var finalURL string

	// 优先使用 urlVariable（如果设置了）
	if urlVariable != "" {
		// 提取变量路径（去除 {{}}）
		varPath := strings.Trim(urlVariable, "{{}}")
		varPath = strings.TrimSpace(varPath)

		// 获取变量值
		urlVar, err := variableContext.GetVariable(varPath)
		if err == nil && urlVar != nil {
			// 如果变量值是字符串，直接使用
			if urlStr, ok := urlVar.(string); ok {
				// 检查是否是有效的URL
				if strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://") {
					finalURL = urlStr
				} else {
					// 如果不是完整URL，尝试作为相对路径或拼接
					finalURL = urlStr
				}
			} else if urlMap, ok := urlVar.(map[string]interface{}); ok {
				// 如果变量值是对象，尝试提取常见的URL字段
				// 按优先级尝试：url, link, href, src, data
				urlFields := []string{"url", "link", "href", "src", "data"}
				for _, field := range urlFields {
					if val, exists := urlMap[field]; exists {
						if urlStr, ok := val.(string); ok && urlStr != "" {
							finalURL = urlStr
							break
						}
					}
				}
				// 如果还是没找到，转换为字符串（可能不是有效URL，但至少不会报错）
				if finalURL == "" {
					finalURL = fmt.Sprintf("%v", urlVar)
				}
			} else {
				// 其他类型，转换为字符串
				finalURL = fmt.Sprintf("%v", urlVar)
			}
		} else {
			// 如果直接获取失败，尝试使用 ResolveTemplateToInterface（支持路径访问）
			resolved, err := variableContext.ResolveTemplateToInterface(urlVariable)
			if err == nil && resolved != nil {
				// 如果解析结果是字符串，直接使用
				if urlStr, ok := resolved.(string); ok {
					if strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://") {
						finalURL = urlStr
					} else if !strings.Contains(urlStr, "{{") {
						// 确保不是未解析的模板字符串
						finalURL = urlStr
					}
				} else if urlMap, ok := resolved.(map[string]interface{}); ok {
					// 如果是对象，尝试提取URL字段
					urlFields := []string{"url", "link", "href", "src", "data"}
					for _, field := range urlFields {
						if val, exists := urlMap[field]; exists {
							if urlStr, ok := val.(string); ok && urlStr != "" {
								finalURL = urlStr
								break
							}
						}
					}
				} else {
					// 其他类型，转换为字符串
					finalURL = fmt.Sprintf("%v", resolved)
				}
			}

			// 如果 ResolveTemplateToInterface 也失败，尝试 ResolveTemplate（字符串模板）
			if finalURL == "" {
				resolved, err := variableContext.ResolveTemplate(urlVariable)
				if err == nil && resolved != "" {
					// 检查是否是未解析的模板字符串（仍然包含 {{}}）
					if !strings.Contains(resolved, "{{") {
						finalURL = resolved
					}
				}
			}

			// 如果变量解析失败，尝试从输入数据中获取URL
			if finalURL == "" && inputData != nil && inputData.Payload != nil {
				// 提取变量路径（去除 {{}} 和节点ID）
				varPath := strings.Trim(urlVariable, "{{}}")
				varPath = strings.TrimSpace(varPath)
				parts := strings.Split(varPath, ".")
				// 如果路径格式是 nodeId.variable.field，提取 variable.field
				if len(parts) >= 2 {
					variablePath := strings.Join(parts[1:], ".")
					urlValue, err := GetDataByPath(inputData.Payload, variablePath)
					if err == nil && urlValue != nil {
						if urlStr, ok := urlValue.(string); ok && urlStr != "" {
							finalURL = urlStr
						} else if urlMap, ok := urlValue.(map[string]interface{}); ok {
							// 如果是对象，尝试提取URL字段
							urlFields := []string{"url", "link", "href", "src", "data"}
							for _, field := range urlFields {
								if val, exists := urlMap[field]; exists {
									if urlStr, ok := val.(string); ok && urlStr != "" {
										finalURL = urlStr
										break
									}
								}
							}
						}
					}
					// 如果路径是 data.field 格式，但字段不存在，尝试从 data 对象中查找所有可能的URL字段
					if finalURL == "" && len(parts) >= 3 && parts[1] == "data" {
						dataValue, err := GetDataByPath(inputData.Payload, "data")
						if err == nil && dataValue != nil {
							if dataMap, ok := dataValue.(map[string]interface{}); ok {
								// 尝试查找常见的URL字段
								urlFields := []string{"url", "link", "href", "src", parts[2]} // 包含原始字段名
								for _, field := range urlFields {
									if val, exists := dataMap[field]; exists {
										if urlStr, ok := val.(string); ok && urlStr != "" {
											finalURL = urlStr
											break
										}
									}
								}
							}
						}
					}
					// 如果还是没找到，尝试直接查找常见的URL字段
					if finalURL == "" {
						if payloadMap, ok := inputData.Payload.(map[string]interface{}); ok {
							urlFields := []string{"url", "link", "href", "src", "data"}
							for _, field := range urlFields {
								if val, exists := payloadMap[field]; exists {
									if urlStr, ok := val.(string); ok && urlStr != "" {
										finalURL = urlStr
										break
									}
								}
							}
						}
					}
				}
			}
		}

		// 如果最终URL仍然包含模板字符串，说明解析失败
		if finalURL != "" && strings.Contains(finalURL, "{{") {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "crawler",
				Success: false,
				Error:   fmt.Sprintf("URL变量解析失败: %s，请检查变量是否存在", urlVariable),
			}
		}

		// 如果用户选择了urlVariable但解析失败（finalURL为空），不应该回退到urlConfig，应该报错
		if finalURL == "" {
			return NodeExecutionResult{
				NodeID:  node.ID,
				Type:    "crawler",
				Success: false,
				Error:   fmt.Sprintf("URL变量 %s 解析后为空值，请检查变量路径是否正确或变量是否存在", urlVariable),
			}
		}
	}

	// 如果 urlVariable 没有提供URL（用户没有选择urlVariable），使用 url 字段
	if finalURL == "" && urlConfig != "" {
		// 如果包含 {{ 说明是模板，需要解析
		if strings.Contains(urlConfig, "{{") {
			resolved, err := variableContext.ResolveTemplate(urlConfig)
			if err == nil && resolved != "" {
				finalURL = resolved
			} else {
				finalURL = urlConfig // 解析失败，使用原值
			}
		} else {
			finalURL = urlConfig
		}
	}

	// 如果URL仍为空，尝试从输入数据中获取
	if finalURL == "" {
		// 尝试从输入数据获取
		if inputData.Payload != nil {
			if urlMap, ok := inputData.Payload.(map[string]interface{}); ok {
				if url, exists := urlMap["url"]; exists {
					finalURL = fmt.Sprintf("%v", url)
				}
			}
		}
		// 尝试从变量上下文获取
		if finalURL == "" {
			if urlVar, err := variableContext.GetVariable("url"); err == nil {
				finalURL = fmt.Sprintf("%v", urlVar)
			}
		}
	}

	// 构建爬虫配置
	config := crawlerService.CrawlerConfig{
		URL:            finalURL,
		Method:         getString(node.Config, "method", "GET"),
		Selector:       getString(node.Config, "selector", ""),
		UserAgent:      getString(node.Config, "userAgent", ""),
		Timeout:        getInt(node.Config, "timeout", 30),
		Headers:        make(map[string]string),
		Body:           getString(node.Config, "body", ""),
		BodyType:       getString(node.Config, "bodyType", "json"),
		Cookies:        make(map[string]string),
		Proxy:          getString(node.Config, "proxy", ""),
		RetryCount:     getInt(node.Config, "retryCount", 3),
		RetryDelay:     getInt(node.Config, "retryDelay", 1),
		WaitTime:       getInt(node.Config, "waitTime", 0),
		ExtractType:    getString(node.Config, "extractType", "text"),
		ExtractAttr:    getString(node.Config, "extractAttr", ""),
		Encoding:       getString(node.Config, "encoding", "auto"),
		ExtractMode:    extractMode,
		SmartMode:      extractMode != "custom",                  // 非自定义模式时启用智能模式
		JavaScriptWait: getInt(node.Config, "javascriptWait", 5), // JavaScript等待时间
	}

	// 处理动态URL（如果URL包含变量，从上游数据中获取）
	if config.URL == "" && inputData.Payload != nil {
		if urlMap, ok := inputData.Payload.(map[string]interface{}); ok {
			if url, exists := urlMap["url"]; exists {
				config.URL = fmt.Sprintf("%v", url)
			}
		}
	}

	// 设置自定义Headers（支持变量解析）
	if headersValue, ok := node.Config["headers"]; ok {
		// 如果是字符串，可能是JSON格式，需要解析
		if headersStr, ok := headersValue.(string); ok {
			// 先解析变量
			if strings.Contains(headersStr, "{{") {
				resolved, err := variableContext.ResolveTemplate(headersStr)
				if err == nil {
					headersStr = resolved
				}
			}
			// 尝试解析JSON
			var headersMap map[string]interface{}
			if err := json.Unmarshal([]byte(headersStr), &headersMap); err == nil {
				for key, value := range headersMap {
					config.Headers[key] = fmt.Sprintf("%v", value)
				}
			}
		} else if headersMap, ok := headersValue.(map[string]interface{}); ok {
			// 如果是对象，直接使用
			for key, value := range headersMap {
				// 如果值是字符串且包含变量，解析它
				if strValue, ok := value.(string); ok {
					if strings.Contains(strValue, "{{") {
						resolved, err := variableContext.ResolveTemplate(strValue)
						if err == nil {
							config.Headers[key] = resolved
						} else {
							config.Headers[key] = strValue
						}
					} else {
						config.Headers[key] = strValue
					}
				} else {
					config.Headers[key] = fmt.Sprintf("%v", value)
				}
			}
		}
	}

	// 设置Cookies（支持变量解析）
	if cookiesValue, ok := node.Config["cookies"]; ok {
		// 如果是字符串，可能是JSON格式
		if cookiesStr, ok := cookiesValue.(string); ok {
			// 先解析变量
			if strings.Contains(cookiesStr, "{{") {
				resolved, err := variableContext.ResolveTemplate(cookiesStr)
				if err == nil {
					cookiesStr = resolved
				}
			}
			// 尝试解析JSON
			var cookiesMap map[string]interface{}
			if err := json.Unmarshal([]byte(cookiesStr), &cookiesMap); err == nil {
				for key, value := range cookiesMap {
					config.Cookies[key] = fmt.Sprintf("%v", value)
				}
			}
		} else if cookiesMap, ok := cookiesValue.(map[string]interface{}); ok {
			// 如果是对象，直接使用
			for key, value := range cookiesMap {
				if strValue, ok := value.(string); ok {
					// 如果包含变量，解析它
					if strings.Contains(strValue, "{{") {
						resolved, err := variableContext.ResolveTemplate(strValue)
						if err == nil {
							config.Cookies[key] = resolved
						} else {
							config.Cookies[key] = strValue
						}
					} else {
						config.Cookies[key] = strValue
					}
				} else {
					config.Cookies[key] = fmt.Sprintf("%v", value)
				}
			}
		}
	}

	// 设置分页配置
	if paginationMap, ok := node.Config["pagination"].(map[string]interface{}); ok {
		pagination := &crawlerService.PaginationConfig{
			Enabled:   getBool(paginationMap, "enabled", false),
			Selector:  getString(paginationMap, "selector", ""),
			MaxPages:  getInt(paginationMap, "maxPages", 10),
			PageParam: getString(paginationMap, "pageParam", "page"),
			StartPage: getInt(paginationMap, "startPage", 1),
			Increment: getInt(paginationMap, "increment", 1),
		}
		if pagination.Enabled {
			config.Pagination = pagination
		}
	}

	// 设置重定向和SSL验证
	config.FollowRedirect = getBool(node.Config, "followRedirect", true)
	config.VerifySSL = getBool(node.Config, "verifySSL", true)

	// 设置无头浏览器相关配置（用于SPA应用）
	config.UseHeadless = getBool(node.Config, "useHeadless", false)
	config.WaitForSelector = getString(node.Config, "waitForSelector", "")
	config.DisableImages = getBool(node.Config, "disableImages", false)

	// 执行爬虫
	result, err := e.crawlerService.Execute(config)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   err.Error(),
		}
	}

	if !result.Success {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "crawler",
			Success: false,
			Error:   result.Error,
		}
	}

	// 标准化输出格式（按照节点输出定义）
	outputData := make(map[string]interface{})
	if resultData, ok := result.Data.(map[string]interface{}); ok {
		// 提取标准输出变量
		if data, exists := resultData["data"]; exists {
			outputData["data"] = data
		} else {
			outputData["data"] = resultData
		}
		if html, exists := resultData["html"]; exists {
			outputData["html"] = html
		} else if rawHTML, exists := resultData["raw_html"]; exists {
			outputData["html"] = rawHTML
		}
		if text, exists := resultData["text"]; exists {
			outputData["text"] = text
		} else if extracted, ok := resultData["extracted"].(map[string]interface{}); ok {
			if text, exists := extracted["text"]; exists {
				outputData["text"] = text
			}
		}
	} else {
		outputData["data"] = result.Data
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "crawler",
		Success: true,
		Data:    outputData,
	}
}

package services

import (
	"encoding/json"
	"fmt"
	"strings"

	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/crawler/models"
)

func MapRuleToCrawlerConfig(rule *models.CrawlerRule) (CrawlerConfig, error) {
	if rule == nil {
		return CrawlerConfig{}, fmt.Errorf("crawler rule is nil")
	}

	config := CrawlerConfig{
		Method:         strings.ToUpper(strings.TrimSpace(rule.Method)),
		Headers:        jsonValueToStringMap(rule.Headers.Data),
		Cookies:        jsonValueToStringMap(jsonbPtrValue(rule.Cookies)),
		Timeout:        rule.Timeout,
		RetryCount:     rule.RetryCount,
		RetryDelay:     rule.RetryDelay,
		WaitTime:       rule.WaitTime,
		FollowRedirect: rule.FollowRedirects,
		VerifySSL:      rule.VerifySSL,
		UseHeadless:    rule.JavaScriptEnabled,
	}

	if config.Method == "" {
		config.Method = "GET"
	}
	if config.Headers == nil {
		config.Headers = map[string]string{}
	}
	if config.Cookies == nil {
		config.Cookies = map[string]string{}
	}

	if rule.UserAgent != nil {
		config.UserAgent = strings.TrimSpace(*rule.UserAgent)
	}

	if selectorConfig, ok := jsonObject(rule.Selectors.Data); ok {
		config.Selector = getStringFromMap(selectorConfig, "primary", "selector")
		if config.Selector == "" {
			if fallback, ok := selectorConfig["fallback"].([]interface{}); ok {
				for _, item := range fallback {
					if s, ok := item.(string); ok && strings.TrimSpace(s) != "" {
						config.Selector = strings.TrimSpace(s)
						break
					}
				}
			}
		}
		config.WaitForSelector = getStringFromMap(selectorConfig, "wait_for_selector", "waitForSelector")
	}

	if dataExtraction, ok := jsonObject(jsonbPtrValue(rule.DataExtraction)); ok {
		config.ExtractMode = getStringFromMap(dataExtraction, "mode", "extractMode")
		config.ExtractType = getStringFromMap(dataExtraction, "extract_type", "extractType")
		config.ExtractAttr = getStringFromMap(dataExtraction, "extract_attr", "extractAttr")
		config.SmartMode = getBoolFromMap(dataExtraction, false, "smart_mode", "smartMode")
		if config.ExtractMode == "smart" {
			config.SmartMode = true
		}
	}

	if config.ExtractType == "" {
		config.ExtractType = "text"
	}

	if proxyConfig, ok := jsonObject(jsonbPtrValue(rule.ProxyConfig)); ok {
		enabled := getBoolFromMap(proxyConfig, true, "enabled")
		if enabled {
			config.Proxy = getStringFromMap(proxyConfig, "url", "proxy")
		}
	}

	if paginationMap, ok := jsonObject(jsonbPtrValue(rule.Pagination)); ok {
		pagination := &PaginationConfig{
			Enabled:   getBoolFromMap(paginationMap, false, "enabled"),
			Selector:  getStringFromMap(paginationMap, "selector"),
			MaxPages:  getIntFromMap(paginationMap, 0, "max_pages", "maxPages"),
			PageParam: getStringFromMap(paginationMap, "page_param", "pageParam"),
			StartPage: getIntFromMap(paginationMap, 0, "start_page", "startPage"),
			Increment: getIntFromMap(paginationMap, 0, "increment"),
		}
		if pagination.Enabled {
			config.Pagination = pagination
		}
	}

	if body := jsonbPtrValue(rule.Body); body != nil {
		switch v := body.(type) {
		case string:
			config.Body = v
		default:
			bodyBytes, err := json.Marshal(v)
			if err != nil {
				return CrawlerConfig{}, err
			}
			config.Body = string(bodyBytes)
			config.BodyType = "json"
		}
	}

	if config.UseHeadless && config.JavaScriptWait == 0 {
		config.JavaScriptWait = rule.WaitTime
	}

	return config, nil
}

func MergeCrawlerConfig(base CrawlerConfig, override map[string]interface{}) (CrawlerConfig, error) {
	config := ensureCrawlerConfigMaps(base)
	if override == nil {
		return config, nil
	}

	if url, ok := getAnyString(override["url"]); ok {
		config.URL = url
	}
	if method, ok := getAnyStringByKeys(override, "method"); ok {
		config.Method = strings.ToUpper(method)
	}
	if selector, ok := getAnyStringByKeys(override, "selector"); ok {
		config.Selector = selector
	}
	if ua, ok := getAnyStringByKeys(override, "userAgent", "user_agent"); ok {
		config.UserAgent = ua
	}
	if body, ok := getAnyStringByKeys(override, "body"); ok {
		config.Body = body
	}
	if bodyType, ok := getAnyStringByKeys(override, "bodyType", "body_type"); ok {
		config.BodyType = bodyType
	}
	if proxy, ok := getAnyStringByKeys(override, "proxy"); ok {
		config.Proxy = proxy
	}
	if extractType, ok := getAnyStringByKeys(override, "extractType", "extract_type"); ok {
		config.ExtractType = extractType
	}
	if extractAttr, ok := getAnyStringByKeys(override, "extractAttr", "extract_attr"); ok {
		config.ExtractAttr = extractAttr
	}
	if encoding, ok := getAnyStringByKeys(override, "encoding"); ok {
		config.Encoding = encoding
	}
	if extractMode, ok := getAnyStringByKeys(override, "extractMode", "extract_mode"); ok {
		config.ExtractMode = extractMode
	}
	if waitForSelector, ok := getAnyStringByKeys(override, "waitForSelector", "wait_for_selector"); ok {
		config.WaitForSelector = waitForSelector
	}

	if timeout, ok := getAnyIntByKeys(override, "timeout"); ok {
		config.Timeout = timeout
	}
	if retryCount, ok := getAnyIntByKeys(override, "retryCount", "retry_count"); ok {
		config.RetryCount = retryCount
	}
	if retryDelay, ok := getAnyIntByKeys(override, "retryDelay", "retry_delay"); ok {
		config.RetryDelay = retryDelay
	}
	if waitTime, ok := getAnyIntByKeys(override, "waitTime", "wait_time"); ok {
		config.WaitTime = waitTime
	}
	if jsWait, ok := getAnyIntByKeys(override, "javascriptWait", "javascript_wait"); ok {
		config.JavaScriptWait = jsWait
	}

	if smartMode, ok := getAnyBoolByKeys(override, "smartMode", "smart_mode"); ok {
		config.SmartMode = smartMode
	}
	if followRedirect, ok := getAnyBoolByKeys(override, "followRedirect", "follow_redirect", "follow_redirects"); ok {
		config.FollowRedirect = followRedirect
	}
	if verifySSL, ok := getAnyBoolByKeys(override, "verifySSL", "verify_ssl"); ok {
		config.VerifySSL = verifySSL
	}
	if useHeadless, ok := getAnyBoolByKeys(override, "useHeadless", "use_headless", "javascript_enabled"); ok {
		config.UseHeadless = useHeadless
	}
	if disableImages, ok := getAnyBoolByKeys(override, "disableImages", "disable_images"); ok {
		config.DisableImages = disableImages
	}

	if headersRaw, exists := getAnyValueByKeys(override, "headers"); exists {
		config.Headers = mergeStringMaps(config.Headers, jsonValueToStringMap(headersRaw))
	}
	if cookiesRaw, exists := getAnyValueByKeys(override, "cookies"); exists {
		config.Cookies = mergeStringMaps(config.Cookies, jsonValueToStringMap(cookiesRaw))
	}
	if selectorsRaw, exists := getAnyValueByKeys(override, "selectors"); exists {
		if selectors, ok := jsonObject(selectorsRaw); ok {
			if selector := getStringFromMap(selectors, "primary", "selector"); selector != "" {
				config.Selector = selector
			}
			if waitForSelector := getStringFromMap(selectors, "wait_for_selector", "waitForSelector"); waitForSelector != "" {
				config.WaitForSelector = waitForSelector
			}
		}
	}
	if extractionRaw, exists := getAnyValueByKeys(override, "data_extraction", "dataExtraction"); exists {
		if extraction, ok := jsonObject(extractionRaw); ok {
			if mode := getStringFromMap(extraction, "mode", "extractMode"); mode != "" {
				config.ExtractMode = mode
			}
			if extractType := getStringFromMap(extraction, "extract_type", "extractType"); extractType != "" {
				config.ExtractType = extractType
			}
			if extractAttr := getStringFromMap(extraction, "extract_attr", "extractAttr"); extractAttr != "" {
				config.ExtractAttr = extractAttr
			}
			if smartMode, ok := getBoolByKeys(extraction, "smart_mode", "smartMode"); ok {
				config.SmartMode = smartMode
			}
		}
	}
	if proxyRaw, exists := getAnyValueByKeys(override, "proxy_config", "proxyConfig"); exists {
		if proxyConfig, ok := jsonObject(proxyRaw); ok {
			enabled := getBoolFromMap(proxyConfig, true, "enabled")
			if enabled {
				if proxy := getStringFromMap(proxyConfig, "url", "proxy"); proxy != "" {
					config.Proxy = proxy
				}
			} else {
				config.Proxy = ""
			}
		}
	}
	if paginationRaw, exists := getAnyValueByKeys(override, "pagination"); exists {
		if paginationMap, ok := jsonObject(paginationRaw); ok {
			if config.Pagination == nil {
				config.Pagination = &PaginationConfig{}
			}
			if enabled, ok := getBoolByKeys(paginationMap, "enabled"); ok {
				config.Pagination.Enabled = enabled
			}
			if selector := getStringFromMap(paginationMap, "selector"); selector != "" {
				config.Pagination.Selector = selector
			}
			if maxPages, ok := getIntByKeys(paginationMap, "max_pages", "maxPages"); ok {
				config.Pagination.MaxPages = maxPages
			}
			if pageParam := getStringFromMap(paginationMap, "page_param", "pageParam"); pageParam != "" {
				config.Pagination.PageParam = pageParam
			}
			if startPage, ok := getIntByKeys(paginationMap, "start_page", "startPage"); ok {
				config.Pagination.StartPage = startPage
			}
			if increment, ok := getIntByKeys(paginationMap, "increment"); ok {
				config.Pagination.Increment = increment
			}
		}
	}

	return config, nil
}

func ensureCrawlerConfigMaps(config CrawlerConfig) CrawlerConfig {
	if config.Headers == nil {
		config.Headers = map[string]string{}
	}
	if config.Cookies == nil {
		config.Cookies = map[string]string{}
	}
	return config
}

func mergeStringMaps(base map[string]string, override map[string]string) map[string]string {
	if base == nil {
		base = map[string]string{}
	}
	for key, value := range override {
		base[key] = value
	}
	return base
}

func jsonbPtrValue(value *shared.JSONB) interface{} {
	if value == nil {
		return nil
	}
	return value.Data
}

func jsonObject(value interface{}) (map[string]interface{}, bool) {
	if value == nil {
		return nil, false
	}
	switch v := value.(type) {
	case map[string]interface{}:
		return v, true
	case shared.JSONB:
		return jsonObject(v.Data)
	case *shared.JSONB:
		if v == nil {
			return nil, false
		}
		return jsonObject(v.Data)
	default:
		bytes, err := json.Marshal(v)
		if err != nil {
			return nil, false
		}
		var out map[string]interface{}
		if err := json.Unmarshal(bytes, &out); err != nil {
			return nil, false
		}
		return out, true
	}
}

func jsonValueToStringMap(value interface{}) map[string]string {
	obj, ok := jsonObject(value)
	if !ok {
		return map[string]string{}
	}
	out := make(map[string]string, len(obj))
	for key, raw := range obj {
		out[key] = fmt.Sprintf("%v", raw)
	}
	return out
}

func getStringFromMap(m map[string]interface{}, keys ...string) string {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			if str, ok := getAnyString(value); ok {
				return str
			}
		}
	}
	return ""
}

func getAnyStringByKeys(m map[string]interface{}, keys ...string) (string, bool) {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return getAnyString(value)
		}
	}
	return "", false
}

func getAnyString(value interface{}) (string, bool) {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v), true
	case fmt.Stringer:
		return strings.TrimSpace(v.String()), true
	default:
		if value == nil {
			return "", false
		}
		return strings.TrimSpace(fmt.Sprintf("%v", value)), true
	}
}

func getAnyIntByKeys(m map[string]interface{}, keys ...string) (int, bool) {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return getAnyInt(value)
		}
	}
	return 0, false
}

func getIntFromMap(m map[string]interface{}, defaultValue int, keys ...string) int {
	if value, ok := getIntByKeys(m, keys...); ok {
		return value
	}
	return defaultValue
}

func getIntByKeys(m map[string]interface{}, keys ...string) (int, bool) {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return getAnyInt(value)
		}
	}
	return 0, false
}

func getAnyInt(value interface{}) (int, bool) {
	switch v := value.(type) {
	case int:
		return v, true
	case int32:
		return int(v), true
	case int64:
		return int(v), true
	case uint:
		return int(v), true
	case uint32:
		return int(v), true
	case uint64:
		return int(v), true
	case float32:
		return int(v), true
	case float64:
		return int(v), true
	case json.Number:
		i, err := v.Int64()
		if err != nil {
			return 0, false
		}
		return int(i), true
	case string:
		if strings.TrimSpace(v) == "" {
			return 0, false
		}
		var i int
		_, err := fmt.Sscanf(v, "%d", &i)
		return i, err == nil
	default:
		return 0, false
	}
}

func getAnyBoolByKeys(m map[string]interface{}, keys ...string) (bool, bool) {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return getAnyBool(value)
		}
	}
	return false, false
}

func getBoolFromMap(m map[string]interface{}, defaultValue bool, keys ...string) bool {
	if value, ok := getBoolByKeys(m, keys...); ok {
		return value
	}
	return defaultValue
}

func getBoolByKeys(m map[string]interface{}, keys ...string) (bool, bool) {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return getAnyBool(value)
		}
	}
	return false, false
}

func getAnyBool(value interface{}) (bool, bool) {
	switch v := value.(type) {
	case bool:
		return v, true
	case string:
		switch strings.ToLower(strings.TrimSpace(v)) {
		case "true", "1", "yes":
			return true, true
		case "false", "0", "no":
			return false, true
		default:
			return false, false
		}
	case int:
		return v != 0, true
	case int64:
		return v != 0, true
	case float64:
		return v != 0, true
	default:
		return false, false
	}
}

func getAnyValueByKeys(m map[string]interface{}, keys ...string) (interface{}, bool) {
	for _, key := range keys {
		if value, ok := m[key]; ok {
			return value, true
		}
	}
	return nil, false
}

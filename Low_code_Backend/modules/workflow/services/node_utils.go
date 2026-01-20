package services

import (
	"fmt"
	"strconv"
	"strings"
)

// getString 从配置中获取字符串值
func getString(m map[string]interface{}, key string, defaultValue string) string {
	if val, ok := m[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultValue
}

// getInt 从配置中获取整数值
func getInt(m map[string]interface{}, key string, defaultValue int) int {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case int:
			return v
		case float64:
			return int(v)
		case string:
			i, err := strconv.Atoi(v)
			if err == nil {
				return i
			}
		}
	}
	return defaultValue
}

// getBool 从配置中获取布尔值
func getBool(m map[string]interface{}, key string, defaultValue bool) bool {
	if val, ok := m[key]; ok {
		switch v := val.(type) {
		case bool:
			return v
		case string:
			return v == "true" || v == "1" || v == "yes"
		case int:
			return v != 0
		case float64:
			return v != 0
		}
	}
	return defaultValue
}

// getUint 从配置中获取uint值
func getUint(m map[string]interface{}, key string, defaultValue uint) uint {
	if v, ok := m[key].(float64); ok {
		return uint(v)
	}
	return defaultValue
}

// evaluateCondition 评估条件表达式
func evaluateCondition(fieldValue interface{}, operator, compareValue string) bool {
	switch operator {
	case "==":
		return fmt.Sprintf("%v", fieldValue) == compareValue
	case "!=":
		return fmt.Sprintf("%v", fieldValue) != compareValue
	case ">":
		return compareNumbers(fieldValue, compareValue) > 0
	case "<":
		return compareNumbers(fieldValue, compareValue) < 0
	case ">=":
		return compareNumbers(fieldValue, compareValue) >= 0
	case "<=":
		return compareNumbers(fieldValue, compareValue) <= 0
	case "contains":
		fieldStr := fmt.Sprintf("%v", fieldValue)
		return strings.Contains(fieldStr, compareValue)
	default:
		return false
	}
}

// compareNumbers 比较数字
func compareNumbers(a interface{}, b string) int {
	var numA, numB float64
	var ok bool

	// 转换 a 为数字
	switch v := a.(type) {
	case int:
		numA = float64(v)
		ok = true
	case float64:
		numA = v
		ok = true
	case string:
		if parsed, err := fmt.Sscanf(v, "%f", &numA); err == nil && parsed == 1 {
			ok = true
		}
	}

	if !ok {
		return 0
	}

	// 转换 b 为数字
	if _, err := fmt.Sscanf(b, "%f", &numB); err != nil {
		return 0
	}

	if numA > numB {
		return 1
	} else if numA < numB {
		return -1
	}
	return 0
}

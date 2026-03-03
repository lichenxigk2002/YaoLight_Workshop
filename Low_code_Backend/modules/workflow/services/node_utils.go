package services

import (
	"fmt"
	"reflect"
	"regexp"
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

func evaluateConditionAny(fieldValue interface{}, operator string, compareValue interface{}) bool {
	op := strings.TrimSpace(operator)
	if op == "" {
		op = "=="
	}

	switch op {
	case "==", "=":
		return looselyEqual(fieldValue, compareValue)
	case "!=":
		return !looselyEqual(fieldValue, compareValue)
	case ">", "<", ">=", "<=":
		cmp, ok := compareAsNumbers(fieldValue, compareValue)
		if !ok {
			return false
		}
		switch op {
		case ">":
			return cmp > 0
		case "<":
			return cmp < 0
		case ">=":
			return cmp >= 0
		case "<=":
			return cmp <= 0
		}
	case "contains":
		return containsValue(fieldValue, compareValue)
	case "startsWith":
		return strings.HasPrefix(fmt.Sprintf("%v", fieldValue), fmt.Sprintf("%v", compareValue))
	case "endsWith":
		return strings.HasSuffix(fmt.Sprintf("%v", fieldValue), fmt.Sprintf("%v", compareValue))
	case "regex":
		pattern := fmt.Sprintf("%v", compareValue)
		re, err := regexp.Compile(pattern)
		if err != nil {
			return false
		}
		return re.MatchString(fmt.Sprintf("%v", fieldValue))
	case "in", "notIn":
		list := normalizeToList(compareValue)
		in := false
		for _, v := range list {
			if looselyEqual(fieldValue, v) {
				in = true
				break
			}
		}
		if op == "in" {
			return in
		}
		return !in
	case "empty":
		return isEmptyValue(fieldValue)
	case "notEmpty":
		return !isEmptyValue(fieldValue)
	default:
		return false
	}

	return false
}

func isEmptyValue(v interface{}) bool {
	if v == nil {
		return true
	}
	switch vv := v.(type) {
	case string:
		return strings.TrimSpace(vv) == ""
	case []interface{}:
		return len(vv) == 0
	case map[string]interface{}:
		return len(vv) == 0
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array || rv.Kind() == reflect.Map {
		return rv.Len() == 0
	}
	return false
}

func looselyEqual(a interface{}, b interface{}) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	if af, okA := toFloat64(a); okA {
		if bf, okB := toFloat64(b); okB {
			return af == bf
		}
	}
	return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
}

func compareAsNumbers(a interface{}, b interface{}) (int, bool) {
	af, okA := toFloat64(a)
	bf, okB := toFloat64(b)
	if !okA || !okB {
		return 0, false
	}
	if af > bf {
		return 1, true
	}
	if af < bf {
		return -1, true
	}
	return 0, true
}

func toFloat64(v interface{}) (float64, bool) {
	switch vv := v.(type) {
	case int:
		return float64(vv), true
	case int32:
		return float64(vv), true
	case int64:
		return float64(vv), true
	case uint:
		return float64(vv), true
	case uint32:
		return float64(vv), true
	case uint64:
		return float64(vv), true
	case float32:
		return float64(vv), true
	case float64:
		return vv, true
	case string:
		s := strings.TrimSpace(vv)
		if s == "" {
			return 0, false
		}
		f, err := strconv.ParseFloat(s, 64)
		if err != nil {
			return 0, false
		}
		return f, true
	default:
		return 0, false
	}
}

func normalizeToList(v interface{}) []interface{} {
	if v == nil {
		return nil
	}
	if arr, ok := v.([]interface{}); ok {
		return arr
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
		out := make([]interface{}, 0, rv.Len())
		for i := 0; i < rv.Len(); i++ {
			out = append(out, rv.Index(i).Interface())
		}
		return out
	}
	if s, ok := v.(string); ok {
		ss := strings.TrimSpace(s)
		if ss == "" {
			return nil
		}
		if strings.HasPrefix(ss, "[") && strings.HasSuffix(ss, "]") {
			ss = strings.TrimPrefix(ss, "[")
			ss = strings.TrimSuffix(ss, "]")
		}
		parts := strings.Split(ss, ",")
		out := make([]interface{}, 0, len(parts))
		for _, p := range parts {
			pp := strings.TrimSpace(p)
			if pp == "" {
				continue
			}
			out = append(out, pp)
		}
		return out
	}
	return []interface{}{v}
}

func containsValue(container interface{}, target interface{}) bool {
	if container == nil {
		return false
	}
	if s, ok := container.(string); ok {
		return strings.Contains(s, fmt.Sprintf("%v", target))
	}
	if arr, ok := container.([]interface{}); ok {
		for _, v := range arr {
			if looselyEqual(v, target) {
				return true
			}
		}
		return false
	}
	rv := reflect.ValueOf(container)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
		for i := 0; i < rv.Len(); i++ {
			if looselyEqual(rv.Index(i).Interface(), target) {
				return true
			}
		}
		return false
	}
	return strings.Contains(fmt.Sprintf("%v", container), fmt.Sprintf("%v", target))
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

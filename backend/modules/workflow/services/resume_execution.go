package services

func conditionResultFromOutput(output interface{}) (bool, bool) {
	outputMap, ok := output.(map[string]interface{})
	if !ok {
		return false, false
	}
	raw, exists := outputMap["result"]
	if !exists {
		return false, false
	}
	value, ok := raw.(bool)
	return value, ok
}

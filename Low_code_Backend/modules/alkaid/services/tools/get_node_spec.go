package tools

// toolGetNodeSpec 占位（无 Runner 时使用）
func toolGetNodeSpec(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"placeholder": true}, "节点规格占位", nil
}

// runGetNodeSpec 从 Capabilities 的 nodeTypes 中按 nodeType 返回 spec
func (r *Registry) runGetNodeSpec(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.NodeSpecByType == nil {
		return toolGetNodeSpec(params, sessionID)
	}
	nodeType, _ := params["nodeType"].(string)
	if nodeType == "" {
		return nil, "", nil
	}
	spec, err := r.runner.NodeSpecByType(nodeType)
	if err != nil || spec == nil {
		return map[string]interface{}{"error": "未找到节点类型: " + nodeType}, "未找到该节点类型", nil
	}
	return spec, nodeType + " 节点规格", nil
}

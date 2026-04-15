package tools

// toolGetCapabilities 占位（无 Runner 时使用）
func toolGetCapabilities(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"placeholder": true}, "返回能力说明占位", nil
}

// runGetCapabilities 真实实现：从 CapabilitiesService 获取能力说明
func (r *Registry) runGetCapabilities(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.CapabilitiesService == nil {
		return toolGetCapabilities(params, sessionID)
	}
	cap, err := r.runner.CapabilitiesService.GetCapabilities()
	if err != nil {
		return nil, "", err
	}
	// 返回可 JSON 序列化的结构
	return cap, "已返回节点类型与工作流规范", nil
}

package tools

// 默认用户/会话约束（可与配置或用户画像对接后改为动态）
var defaultUserConstraints = map[string]interface{}{
	"maxNodes":       12,
	"avoidNodeTypes": []string{"loop", "transform"},
	"description":    "建议节点数 6～10；第一阶段避免使用 loop、transform 节点（后端实现为占位）。",
}

// toolGetUserConstraints 占位
func toolGetUserConstraints(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return defaultUserConstraints, "已返回当前约束", nil
}

// runGetUserConstraints 返回生成工作流时的约束（最大节点数、应避免的节点类型等）
func (r *Registry) runGetUserConstraints(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return toolGetUserConstraints(params, sessionID)
}

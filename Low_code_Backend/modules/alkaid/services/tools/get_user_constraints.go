package tools

// Default user/session constraints for workflow generation.
var defaultUserConstraints = map[string]interface{}{
	"maxNodes":        -1,
	"avoidNodeTypes":  []string{"loop", "transform"},
	"nodeCountPolicy": "prefer_minimal_but_complete",
	"description":     "Prefer fewer nodes when possible, but there is no hard upper limit. If a project genuinely needs 20 or more nodes, it is allowed to generate them.",
}

func toolGetUserConstraints(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return defaultUserConstraints, "returned workflow generation constraints", nil
}

func (r *Registry) runGetUserConstraints(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return toolGetUserConstraints(params, sessionID)
}

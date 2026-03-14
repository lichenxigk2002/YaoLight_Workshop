package tools

import (
	"fmt"
	"strings"
)

var nodeTypeAliases = map[string]string{
	"data-clean":   "dataclean",
	"data_clean":   "dataclean",
	"data clean":   "dataclean",
	"clean":        "dataclean",
	"ai_node":      "ai",
	"ai-node":      "ai",
	"output_node":  "output",
	"output-node":  "output",
	"start_node":   "start",
	"start-node":   "start",
	"end_node":     "end",
	"end-node":     "end",
	"merge_node":   "merge",
	"merge-node":   "merge",
	"loop_node":    "loop",
	"loop-node":    "loop",
	"delay_node":   "delay",
	"delay-node":   "delay",
	"crawler_node": "crawler",
	"crawler-node": "crawler",
}

var supportedNodeTypes = []string{
	"start",
	"crawler",
	"dataclean",
	"ai",
	"condition",
	"transform",
	"loop",
	"merge",
	"delay",
	"output",
	"end",
}

// toolGetNodeSpec 占位（无 Runner 时使用）
func toolGetNodeSpec(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"placeholder": true}, "节点规格占位", nil
}

// runGetNodeSpec 从 Capabilities 的 nodeTypes 中按 nodeType 返回 spec。
func (r *Registry) runGetNodeSpec(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.NodeSpecByType == nil {
		return toolGetNodeSpec(params, sessionID)
	}

	nodeType, _ := params["nodeType"].(string)
	nodeType = normalizeNodeType(nodeType)
	if nodeType == "" {
		return nil, "", fmt.Errorf("nodeType is required, supported values: %s", strings.Join(supportedNodeTypes, ", "))
	}

	spec, err := r.runner.NodeSpecByType(nodeType)
	if err != nil {
		return nil, "", err
	}
	if spec == nil {
		return nil, "", fmt.Errorf("unsupported nodeType %q, supported values: %s", nodeType, strings.Join(supportedNodeTypes, ", "))
	}

	return spec, nodeType + " 节点规格", nil
}

func normalizeNodeType(nodeType string) string {
	normalized := strings.ToLower(strings.TrimSpace(nodeType))
	if normalized == "" {
		return ""
	}

	if alias, ok := nodeTypeAliases[normalized]; ok {
		return alias
	}

	spaced := strings.Join(strings.Fields(strings.ReplaceAll(normalized, "_", " ")), " ")
	if alias, ok := nodeTypeAliases[spaced]; ok {
		return alias
	}

	dashed := strings.ReplaceAll(spaced, " ", "-")
	if alias, ok := nodeTypeAliases[dashed]; ok {
		return alias
	}

	compact := strings.ReplaceAll(dashed, "-", "")
	for _, supported := range supportedNodeTypes {
		if compact == supported {
			return supported
		}
	}

	return compact
}

package tools

import (
	"fmt"
)

// toolValidateWorkflow 占位（无 Runner 时使用）
func toolValidateWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"valid": true, "errors": []interface{}{}}, "校验通过（占位）", nil
}

// runValidateWorkflow 校验工作流结构：必填字段、节点/边格式
func (r *Registry) runValidateWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	workflow, ok := params["workflow"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{"valid": false, "errors": []map[string]interface{}{{"message": "缺少 workflow 参数"}}}, "参数错误", nil
	}
	errors := validateWorkflowStructure(workflow)
	if len(errors) > 0 {
		return map[string]interface{}{"valid": false, "errors": errors}, fmt.Sprintf("发现 %d 处错误", len(errors)), nil
	}
	return map[string]interface{}{"valid": true, "errors": []interface{}{}}, "校验通过", nil
}

func validateWorkflowStructure(workflow map[string]interface{}) (errors []map[string]interface{}) {
	if workflow["version"] == nil {
		errors = append(errors, map[string]interface{}{"path": "version", "message": "缺少 version"})
	}
	nodes, ok := workflow["nodes"].([]interface{})
	if !ok || len(nodes) == 0 {
		errors = append(errors, map[string]interface{}{"path": "nodes", "message": "nodes 必须为非空数组"})
	} else {
		for i, n := range nodes {
			if node, ok := n.(map[string]interface{}); ok {
				if node["id"] == nil {
					errors = append(errors, map[string]interface{}{"path": fmt.Sprintf("nodes[%d].id", i), "message": "节点缺少 id"})
				}
				if node["type"] == nil {
					errors = append(errors, map[string]interface{}{"path": fmt.Sprintf("nodes[%d].type", i), "message": "节点缺少 type"})
				}
			}
		}
	}
	edges, ok := workflow["edges"].([]interface{})
	if !ok {
		errors = append(errors, map[string]interface{}{"path": "edges", "message": "edges 必须为数组"})
	} else {
		for i, e := range edges {
			if edge, ok := e.(map[string]interface{}); ok {
				if edge["source"] == nil {
					errors = append(errors, map[string]interface{}{"path": fmt.Sprintf("edges[%d].source", i), "message": "边缺少 source"})
				}
				if edge["target"] == nil {
					errors = append(errors, map[string]interface{}{"path": fmt.Sprintf("edges[%d].target", i), "message": "边缺少 target"})
				}
			}
		}
	}
	return errors
}

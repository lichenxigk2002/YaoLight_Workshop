package agentic

import (
	"encoding/json"
	"fmt"

	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

// Patch 操作类型：与前端 PatchItem 对齐，propose_patch 存 []map
// op: add=新增节点, remove=删除节点, set=更新节点 data/position, set_edges=整体替换边
const (
	PatchOpAdd      = "add"
	PatchOpRemove   = "remove"
	PatchOpSet      = "set"
	PatchOpSetEdges = "set_edges"
)

// ComputeWorkflowDiff 根据当前画布与提议的工作流计算补丁（用于 propose_patch）
// 返回可序列化为 session.PendingPatchJSON 的 []map[string]interface{}
func ComputeWorkflowDiff(current *workflowSvc.SaveWorkflowNodesRequest, proposedNodes []interface{}, proposedEdges []interface{}) ([]map[string]interface{}, error) {
	if current == nil {
		// 无当前画布时，全部视为 add
		patch := make([]map[string]interface{}, 0)
		for _, n := range proposedNodes {
			nodeMap, ok := n.(map[string]interface{})
			if !ok {
				continue
			}
			patch = append(patch, map[string]interface{}{"op": PatchOpAdd, "node": nodeMap})
		}
		if len(proposedEdges) > 0 {
			patch = append(patch, map[string]interface{}{"op": PatchOpSetEdges, "value": proposedEdges})
		}
		return patch, nil
	}

	currentByID := make(map[string]workflowSvc.WorkflowNodeData)
	for _, n := range current.Nodes {
		currentByID[n.ID] = n
	}
	proposedByID := make(map[string]map[string]interface{})
	for _, n := range proposedNodes {
		nodeMap, ok := n.(map[string]interface{})
		if !ok {
			continue
		}
		id, _ := nodeMap["id"].(string)
		if id == "" {
			continue
		}
		proposedByID[id] = nodeMap
	}

	var patch []map[string]interface{}

	// 新增或更新节点
	for id, pNode := range proposedByID {
		pos := toMap(pNode["position"])
		if pos == nil {
			pos = map[string]interface{}{"x": float64(0), "y": float64(0)}
		}
		data := toMap(pNode["data"])
		if data == nil {
			data = map[string]interface{}{}
		}
		typ, _ := pNode["type"].(string)

		if cur, ok := currentByID[id]; ok {
			// 已存在：比较 data / position，有变化则 set
			needSetData := !mapsEqual(data, cur.Data)
			needSetPos := !mapsEqual(pos, cur.Position)
			if needSetData {
				patch = append(patch, map[string]interface{}{
					"op": PatchOpSet, "nodeId": id, "path": "data", "value": data,
				})
			}
			if needSetPos {
				patch = append(patch, map[string]interface{}{
					"op": PatchOpSet, "nodeId": id, "path": "position", "value": pos,
				})
			}
		} else {
			patch = append(patch, map[string]interface{}{
				"op": PatchOpAdd, "node": map[string]interface{}{
					"id": id, "type": typ, "position": pos, "data": data,
				},
			})
		}
	}

	// 删除仅在当前存在的节点
	for id := range currentByID {
		if _, inProposed := proposedByID[id]; !inProposed {
			patch = append(patch, map[string]interface{}{"op": PatchOpRemove, "nodeId": id})
		}
	}

	// 边：若提议边与当前边不同，则整体替换
	proposedEdgesMaps := edgesToMaps(proposedEdges)
	currentEdgesMaps := edgesToMapsFromData(current.Edges)
	if !edgesEqual(proposedEdgesMaps, currentEdgesMaps) && len(proposedEdges) > 0 {
		patch = append(patch, map[string]interface{}{"op": PatchOpSetEdges, "value": proposedEdges})
	}

	return patch, nil
}

func toMap(v interface{}) map[string]interface{} {
	if v == nil {
		return nil
	}
	m, _ := v.(map[string]interface{})
	return m
}

func mapsEqual(a, b map[string]interface{}) bool {
	if len(a) != len(b) {
		return false
	}
	aj, _ := json.Marshal(a)
	bj, _ := json.Marshal(b)
	return string(aj) == string(bj)
}

func edgesToMaps(edges []interface{}) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(edges))
	for _, e := range edges {
		if m, ok := e.(map[string]interface{}); ok {
			out = append(out, m)
		}
	}
	return out
}

func edgesToMapsFromData(edges []workflowSvc.EdgeData) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(edges))
	for _, e := range edges {
		out = append(out, map[string]interface{}{
			"id": e.ID, "source": e.Source, "target": e.Target,
			"sourceHandle": e.SourceHandle, "targetHandle": e.TargetHandle,
		})
	}
	return out
}

func edgesEqual(a, b []map[string]interface{}) bool {
	if len(a) != len(b) {
		return false
	}
	aj, _ := json.Marshal(a)
	bj, _ := json.Marshal(b)
	return string(aj) == string(bj)
}

// ApplyPatchToWorkflow 将补丁应用到当前节点/边，得到新的 SaveWorkflowNodesRequest（不写库）
func ApplyPatchToWorkflow(current *workflowSvc.SaveWorkflowNodesRequest, patchRaw []interface{}) (*workflowSvc.SaveWorkflowNodesRequest, error) {
	nodes := make([]workflowSvc.WorkflowNodeData, 0, len(current.Nodes)+8)
	nodesByID := make(map[string]int)
	for i, n := range current.Nodes {
		nodes = append(nodes, n)
		nodesByID[n.ID] = i
	}
	edges := make([]workflowSvc.EdgeData, 0, len(current.Edges)+8)
	for _, e := range current.Edges {
		edges = append(edges, e)
	}

	for _, item := range patchRaw {
		opMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		op, _ := opMap["op"].(string)
		switch op {
		case PatchOpAdd:
			nodeVal := opMap["node"]
			nodeMap, ok := nodeVal.(map[string]interface{})
			if !ok {
				continue
			}
			id, _ := nodeMap["id"].(string)
			typ, _ := nodeMap["type"].(string)
			pos := toMap(nodeMap["position"])
			if pos == nil {
				pos = map[string]interface{}{"x": float64(0), "y": float64(0)}
			}
			data := toMap(nodeMap["data"])
			if data == nil {
				data = map[string]interface{}{}
			}

			// 检查是否已存在同名 ID 节点，如果存在则替换，否则追加
			if idx, exists := nodesByID[id]; exists {
				nodes[idx] = workflowSvc.WorkflowNodeData{ID: id, Type: typ, Position: pos, Data: data}
			} else {
				nodes = append(nodes, workflowSvc.WorkflowNodeData{ID: id, Type: typ, Position: pos, Data: data})
				nodesByID[id] = len(nodes) - 1
			}

		case PatchOpRemove:
			nodeId, _ := opMap["nodeId"].(string)
			if nodeId == "" {
				continue
			}
			if idx, ok := nodesByID[nodeId]; ok {
				nodes = append(nodes[:idx], nodes[idx+1:]...)
				nodesByID = make(map[string]int)
				for i := range nodes {
					nodesByID[nodes[i].ID] = i
				}
			}
			newEdges := edges[:0]
			for _, e := range edges {
				if e.Source != nodeId && e.Target != nodeId {
					newEdges = append(newEdges, e)
				}
			}
			edges = newEdges

		case PatchOpSet:
			nodeId, _ := opMap["nodeId"].(string)
			path, _ := opMap["path"].(string)
			value := opMap["value"]
			if nodeId == "" || path == "" {
				continue
			}
			idx, ok := nodesByID[nodeId]
			if !ok {
				continue
			}
			if path == "data" {
				nodes[idx].Data = toMap(value)
				if nodes[idx].Data == nil {
					nodes[idx].Data = map[string]interface{}{}
				}
			} else if path == "position" {
				nodes[idx].Position = toMap(value)
				if nodes[idx].Position == nil {
					nodes[idx].Position = map[string]interface{}{"x": float64(0), "y": float64(0)}
				}
			}

		case PatchOpSetEdges:
			val := opMap["value"]
			slice, ok := val.([]interface{})
			if !ok {
				continue
			}
			edges = edges[:0]
			for _, e := range slice {
				em, ok := e.(map[string]interface{})
				if !ok {
					continue
				}
				id, _ := em["id"].(string)
				src, _ := em["source"].(string)
				tgt, _ := em["target"].(string)
				sh, _ := em["sourceHandle"].(string)
				th, _ := em["targetHandle"].(string)
				if id == "" && src != "" && tgt != "" {
					id = src + "-" + tgt
				}
				edges = append(edges, workflowSvc.EdgeData{ID: id, Source: src, Target: tgt, SourceHandle: sh, TargetHandle: th})
			}
		}
	}

	return &workflowSvc.SaveWorkflowNodesRequest{Nodes: nodes, Edges: edges}, nil
}

// PatchFromSession 从 session.PendingPatchJSON 解析出 []interface{} 供 ApplyPatchToWorkflow 使用
func PatchFromSession(data interface{}) ([]interface{}, error) {
	if data == nil {
		return nil, fmt.Errorf("无待应用的补丁")
	}
	slice, ok := data.([]interface{})
	if !ok {
		return nil, fmt.Errorf("待应用补丁格式错误")
	}
	return slice, nil
}

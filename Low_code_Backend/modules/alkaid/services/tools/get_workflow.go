package tools

import (
	"fmt"
	"sort"

	workflowModels "yaolight-workshop/backend/modules/workflow/models"
	workflowSvc "yaolight-workshop/backend/modules/workflow/services"
)

type workflowLLMView struct {
	WorkflowID          uint                    `json:"workflowId,omitempty"`
	Name                string                  `json:"name,omitempty"`
	Description         string                  `json:"description,omitempty"`
	Status              string                  `json:"status,omitempty"`
	Version             string                  `json:"version,omitempty"`
	NodeCount           int                     `json:"nodeCount"`
	EdgeCount           int                     `json:"edgeCount"`
	NodeTypeCounts      map[string]int          `json:"nodeTypeCounts,omitempty"`
	Nodes               []workflowLLMNodeView   `json:"nodes"`
	Edges               []workflowLLMEdgeView   `json:"edges"`
	CommentCards        []workflowLLMCardView   `json:"commentCards,omitempty"`
	TraversalHints      workflowTraversalHints  `json:"traversalHints"`
}

type workflowLLMNodeView struct {
	ID       string                   `json:"id"`
	Type     string                   `json:"type"`
	Label    string                   `json:"label,omitempty"`
	Position map[string]interface{}   `json:"position,omitempty"`
	Config   map[string]interface{}   `json:"config,omitempty"`
	Incoming []string                 `json:"incoming,omitempty"`
	Outgoing []workflowLLMConnection  `json:"outgoing,omitempty"`
}

type workflowLLMConnection struct {
	EdgeID       string `json:"edgeId,omitempty"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"`
	TargetHandle string `json:"targetHandle,omitempty"`
}

type workflowLLMEdgeView struct {
	ID           string `json:"id,omitempty"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"`
	TargetHandle string `json:"targetHandle,omitempty"`
}

type workflowLLMCardView struct {
	ID       string                 `json:"id"`
	Position map[string]interface{} `json:"position,omitempty"`
	Data     map[string]interface{} `json:"data,omitempty"`
}

type workflowTraversalHints struct {
	RootNodeIDs      []string `json:"rootNodeIds,omitempty"`
	LeafNodeIDs      []string `json:"leafNodeIds,omitempty"`
	StartNodeIDs     []string `json:"startNodeIds,omitempty"`
	EndNodeIDs       []string `json:"endNodeIds,omitempty"`
	BranchNodeIDs    []string `json:"branchNodeIds,omitempty"`
	MergeNodeIDs     []string `json:"mergeNodeIds,omitempty"`
	IsolatedNodeIDs  []string `json:"isolatedNodeIds,omitempty"`
}

type workflowSnapshotSummary struct {
	NodeCount      int            `json:"nodeCount"`
	EdgeCount      int            `json:"edgeCount"`
	NodeTypeCounts map[string]int `json:"nodeTypeCounts,omitempty"`
	RootNodeIDs    []string       `json:"rootNodeIds,omitempty"`
	LeafNodeIDs    []string       `json:"leafNodeIds,omitempty"`
	StartNodeIDs   []string       `json:"startNodeIds,omitempty"`
	EndNodeIDs     []string       `json:"endNodeIds,omitempty"`
	BranchNodeIDs  []string       `json:"branchNodeIds,omitempty"`
	MergeNodeIDs   []string       `json:"mergeNodeIds,omitempty"`
}

// toolGetWorkflow 占位（无 Runner 时使用）
func toolGetWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"workflow": nil}, "当前无可读取的工作流", nil
}

// runGetWorkflow 优先通过后端 workflow 服务获取完整工作流快照；仅在没有 workflowId 时才回退前端上下文。
func (r *Registry) runGetWorkflow(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Repo == nil {
		return toolGetWorkflow(params, sessionID)
	}

	session, err := r.runner.Repo.GetSessionByID(sessionID)
	if err != nil {
		return map[string]interface{}{"workflow": nil, "error": err.Error()}, "获取会话失败", nil
	}

	if session.WorkflowID != nil && *session.WorkflowID != 0 && r.runner.WorkflowService != nil {
		workflowResp, workflowErr := r.runner.WorkflowService.GetWorkflowByID(*session.WorkflowID)
		if workflowErr != nil {
			return map[string]interface{}{"workflow": nil, "error": workflowErr.Error()}, "获取工作流详情失败", nil
		}

		nodesResp, nodesErr := r.runner.WorkflowService.GetWorkflowNodes(*session.WorkflowID)
		if nodesErr != nil {
			return map[string]interface{}{"workflow": nil, "error": nodesErr.Error()}, "获取工作流节点失败", nil
		}

		workflowMeta, _ := workflowResp.(*workflowModels.Workflow)
		workflowGraph, ok := nodesResp.(*workflowSvc.SaveWorkflowNodesRequest)
		if !ok || workflowGraph == nil {
			return map[string]interface{}{
				"workflowId": *session.WorkflowID,
				"workflow":   nodesResp,
			}, "已获取工作流，但结构无法标准化", nil
		}

		llmView, summary := buildWorkflowLLMView(workflowMeta, workflowGraph)
		resultMap := map[string]interface{}{
			"source":   "workflow_service",
			"workflow": workflowGraph,
			"summary":  summary,
			"llmView":  llmView,
		}
		if workflowMeta != nil {
			resultMap["workflowMeta"] = map[string]interface{}{
				"id":          workflowMeta.ID,
				"name":        workflowMeta.Name,
				"description": workflowMeta.Description,
				"status":      workflowMeta.Status,
				"version":     workflowMeta.Version,
				"updatedAt":   workflowMeta.UpdatedAt,
			}
		}

		if requestSummary := summarizeWorkflowLike(r.getCurrentWorkflowFromContext()); requestSummary != nil {
			resultMap["requestContextSummary"] = requestSummary
			if requestSummary["nodeCount"] != summary.NodeCount || requestSummary["edgeCount"] != summary.EdgeCount {
				resultMap["consistencyNote"] = "requestContext 与后端工作流节点数不一致，已以后端完整工作流为准"
			}
		}

		name := ""
		if workflowMeta != nil {
			name = workflowMeta.Name
		}
		if name != "" {
			return resultMap, fmt.Sprintf("已获取当前工作流“%s”：%d 个节点，%d 条连线", name, summary.NodeCount, summary.EdgeCount), nil
		}
		return resultMap, fmt.Sprintf("已获取当前工作流：%d 个节点，%d 条连线", summary.NodeCount, summary.EdgeCount), nil
	}

	if cw := r.getCurrentWorkflowFromContext(); cw != nil {
		return map[string]interface{}{
			"source":   "request_context",
			"workflow": cw,
			"summary":  summarizeWorkflowLike(cw),
		}, "已获取当前画布上下文（来自前端请求）", nil
	}

	return map[string]interface{}{"workflow": nil}, "当前无画布", nil
}

func (r *Registry) getCurrentWorkflowFromContext() interface{} {
	if r.runner == nil || r.runner.RequestContext == nil {
		return nil
	}
	return r.runner.RequestContext["currentWorkflow"]
}

func buildWorkflowLLMView(meta *workflowModels.Workflow, workflow *workflowSvc.SaveWorkflowNodesRequest) (workflowLLMView, workflowSnapshotSummary) {
	outgoingByNode := make(map[string][]workflowLLMConnection, len(workflow.Nodes))
	incomingByNode := make(map[string][]string, len(workflow.Nodes))
	nodeTypeCounts := make(map[string]int)
	outDegree := make(map[string]int, len(workflow.Nodes))
	inDegree := make(map[string]int, len(workflow.Nodes))

	edgeViews := make([]workflowLLMEdgeView, 0, len(workflow.Edges))
	for _, edge := range workflow.Edges {
		edgeViews = append(edgeViews, workflowLLMEdgeView{
			ID:           edge.ID,
			Source:       edge.Source,
			Target:       edge.Target,
			SourceHandle: edge.SourceHandle,
			TargetHandle: edge.TargetHandle,
		})
		outgoingByNode[edge.Source] = append(outgoingByNode[edge.Source], workflowLLMConnection{
			EdgeID:       edge.ID,
			Target:       edge.Target,
			SourceHandle: edge.SourceHandle,
			TargetHandle: edge.TargetHandle,
		})
		incomingByNode[edge.Target] = append(incomingByNode[edge.Target], edge.Source)
		outDegree[edge.Source]++
		inDegree[edge.Target]++
	}

	nodeViews := make([]workflowLLMNodeView, 0, len(workflow.Nodes))
	rootNodeIDs := make([]string, 0)
	leafNodeIDs := make([]string, 0)
	startNodeIDs := make([]string, 0)
	endNodeIDs := make([]string, 0)
	branchNodeIDs := make([]string, 0)
	mergeNodeIDs := make([]string, 0)
	isolatedNodeIDs := make([]string, 0)

	for _, node := range workflow.Nodes {
		nodeTypeCounts[node.Type]++
		label, _ := node.Data["label"].(string)
		config := map[string]interface{}{}
		if rawConfig, ok := node.Data["config"].(map[string]interface{}); ok {
			config = rawConfig
		}

		incoming := append([]string(nil), incomingByNode[node.ID]...)
		outgoing := append([]workflowLLMConnection(nil), outgoingByNode[node.ID]...)
		sort.Strings(incoming)
		sort.Slice(outgoing, func(i, j int) bool {
			if outgoing[i].Target == outgoing[j].Target {
				return outgoing[i].EdgeID < outgoing[j].EdgeID
			}
			return outgoing[i].Target < outgoing[j].Target
		})

		nodeViews = append(nodeViews, workflowLLMNodeView{
			ID:       node.ID,
			Type:     node.Type,
			Label:    label,
			Position: node.Position,
			Config:   config,
			Incoming: incoming,
			Outgoing: outgoing,
		})

		if inDegree[node.ID] == 0 {
			rootNodeIDs = append(rootNodeIDs, node.ID)
		}
		if outDegree[node.ID] == 0 {
			leafNodeIDs = append(leafNodeIDs, node.ID)
		}
		if node.Type == "start" {
			startNodeIDs = append(startNodeIDs, node.ID)
		}
		if node.Type == "end" {
			endNodeIDs = append(endNodeIDs, node.ID)
		}
		if outDegree[node.ID] > 1 {
			branchNodeIDs = append(branchNodeIDs, node.ID)
		}
		if inDegree[node.ID] > 1 {
			mergeNodeIDs = append(mergeNodeIDs, node.ID)
		}
		if inDegree[node.ID] == 0 && outDegree[node.ID] == 0 {
			isolatedNodeIDs = append(isolatedNodeIDs, node.ID)
		}
	}

	sort.Slice(nodeViews, func(i, j int) bool { return nodeViews[i].ID < nodeViews[j].ID })
	sort.Slice(edgeViews, func(i, j int) bool {
		if edgeViews[i].Source == edgeViews[j].Source {
			if edgeViews[i].Target == edgeViews[j].Target {
				return edgeViews[i].ID < edgeViews[j].ID
			}
			return edgeViews[i].Target < edgeViews[j].Target
		}
		return edgeViews[i].Source < edgeViews[j].Source
	})
	sort.Strings(rootNodeIDs)
	sort.Strings(leafNodeIDs)
	sort.Strings(startNodeIDs)
	sort.Strings(endNodeIDs)
	sort.Strings(branchNodeIDs)
	sort.Strings(mergeNodeIDs)
	sort.Strings(isolatedNodeIDs)

	cardViews := make([]workflowLLMCardView, 0, len(workflow.CommentCards))
	for _, card := range workflow.CommentCards {
		cardViews = append(cardViews, workflowLLMCardView{
			ID:       card.ID,
			Position: card.Position,
			Data:     card.Data,
		})
	}
	sort.Slice(cardViews, func(i, j int) bool { return cardViews[i].ID < cardViews[j].ID })

	view := workflowLLMView{
		NodeCount:      len(workflow.Nodes),
		EdgeCount:      len(workflow.Edges),
		NodeTypeCounts: nodeTypeCounts,
		Nodes:          nodeViews,
		Edges:          edgeViews,
		CommentCards:   cardViews,
		TraversalHints: workflowTraversalHints{
			RootNodeIDs:     rootNodeIDs,
			LeafNodeIDs:     leafNodeIDs,
			StartNodeIDs:    startNodeIDs,
			EndNodeIDs:      endNodeIDs,
			BranchNodeIDs:   branchNodeIDs,
			MergeNodeIDs:    mergeNodeIDs,
			IsolatedNodeIDs: isolatedNodeIDs,
		},
	}
	if meta != nil {
		view.WorkflowID = meta.ID
		view.Name = meta.Name
		view.Description = derefString(meta.Description)
		view.Status = meta.Status
		view.Version = meta.Version
	}

	summary := workflowSnapshotSummary{
		NodeCount:      view.NodeCount,
		EdgeCount:      view.EdgeCount,
		NodeTypeCounts: nodeTypeCounts,
		RootNodeIDs:    rootNodeIDs,
		LeafNodeIDs:    leafNodeIDs,
		StartNodeIDs:   startNodeIDs,
		EndNodeIDs:     endNodeIDs,
		BranchNodeIDs:  branchNodeIDs,
		MergeNodeIDs:   mergeNodeIDs,
	}

	return view, summary
}

func summarizeWorkflowLike(workflow interface{}) map[string]interface{} {
	if workflow == nil {
		return nil
	}

	switch typed := workflow.(type) {
	case *workflowSvc.SaveWorkflowNodesRequest:
		return map[string]interface{}{
			"nodeCount": len(typed.Nodes),
			"edgeCount": len(typed.Edges),
		}
	case map[string]interface{}:
		nodeCount := 0
		edgeCount := 0
		if nodes, ok := typed["nodes"].([]interface{}); ok {
			nodeCount = len(nodes)
		}
		if edges, ok := typed["edges"].([]interface{}); ok {
			edgeCount = len(edges)
		}
		return map[string]interface{}{
			"nodeCount": nodeCount,
			"edgeCount": edgeCount,
		}
	default:
		return nil
	}
}

func derefString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

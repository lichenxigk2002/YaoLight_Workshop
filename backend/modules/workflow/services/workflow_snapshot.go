package services

type WorkflowSnapshot struct {
	Nodes        []NodeConfig           `json:"nodes"`
	Edges        []EdgeConfig           `json:"edges"`
	RuntimeInput interface{}            `json:"runtimeInput,omitempty"`
	RuntimeMeta  map[string]interface{} `json:"runtimeMeta,omitempty"`
}

func buildWorkflowSnapshot(req ExecutionRequest) map[string]interface{} {
	return map[string]interface{}{
		"workflow_snapshot": WorkflowSnapshot{
			Nodes:        req.Nodes,
			Edges:        req.Edges,
			RuntimeInput: req.RuntimeInput,
			RuntimeMeta:  req.RuntimeMeta,
		},
	}
}

package services

// isEdgeActive reports whether an incoming edge should participate in readiness checks.
// It filters out condition branches that were not selected in the current execution path.
func isEdgeActive(edge EdgeConfig, nodes []NodeConfig, edges []EdgeConfig, conditionResults map[string]bool, executed map[string]bool) bool {
	for _, sourceNode := range nodes {
		if sourceNode.ID == edge.Source && sourceNode.Type == "condition" {
			if conditionResult, exists := conditionResults[edge.Source]; exists {
				if edge.SourceHandle == "true" && !conditionResult {
					return false
				}
				if edge.SourceHandle == "false" && conditionResult {
					return false
				}
			}
		}
	}

	if executed[edge.Source] {
		return true
	}

	for _, upstreamEdge := range edges {
		if upstreamEdge.Target == edge.Source {
			if !isEdgeActive(upstreamEdge, nodes, edges, conditionResults, executed) {
				return false
			}
		}
	}

	return true
}

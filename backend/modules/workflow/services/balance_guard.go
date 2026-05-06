package services

import (
	"errors"
	"fmt"
	"strings"
)

var ErrInsufficientTokenBalance = errors.New("insufficient token balance for system ai execution")

const insufficientTokenBalanceMessage = "星尘余额不足，无法执行系统预设 AI 节点，请先充值"

func IsInsufficientTokenBalanceError(err error) bool {
	return errors.Is(err, ErrInsufficientTokenBalance)
}

func isSystemAINode(node NodeConfig) bool {
	if node.Type != "ai" {
		return false
	}

	modelMode := strings.TrimSpace(getString(node.Config, "modelMode", "system"))
	return modelMode == "" || modelMode == "system"
}

func workflowUsesSystemAI(nodes []NodeConfig) bool {
	for _, node := range nodes {
		if isSystemAINode(node) {
			return true
		}
	}
	return false
}

func (e *WorkflowExecutor) ValidateExecutionRequest(req ExecutionRequest) error {
	for _, node := range balanceCheckNodes(req) {
		if isSystemAINode(node) {
			return e.ensurePositiveTokenBalance(req.UserID)
		}
	}
	return nil
}

func balanceCheckNodes(req ExecutionRequest) []NodeConfig {
	if req.ResumeState == nil {
		return req.Nodes
	}

	nodeByID := make(map[string]NodeConfig, len(req.Nodes))
	outgoingEdges := make(map[string][]EdgeConfig, len(req.Nodes))
	executed := make(map[string]bool, len(req.Nodes))
	conditionResults := make(map[string]bool)
	for _, node := range req.Nodes {
		nodeByID[node.ID] = node
	}
	for _, edge := range req.Edges {
		outgoingEdges[edge.Source] = append(outgoingEdges[edge.Source], edge)
	}
	for nodeID, state := range req.ResumeState.ReusedNodes {
		executed[nodeID] = true
		node, ok := nodeByID[nodeID]
		if !ok || node.Type != "condition" {
			continue
		}
		if boolRes, ok := conditionResultFromOutput(state.OutputData); ok {
			conditionResults[nodeID] = boolRes
		}
	}

	potentiallyRunnable := make(map[string]bool, len(req.Nodes))
	readyQueue := make([]string, 0, len(req.Nodes))

	evaluateNodeState := func(nodeID string, reachable map[string]bool) string {
		hasIncoming := false
		for _, edge := range req.Edges {
			if edge.Target != nodeID {
				continue
			}
			hasIncoming = true
			if !isEdgeActive(edge, req.Nodes, req.Edges, conditionResults, reachable) {
				continue
			}
			if !reachable[edge.Source] {
				return "waiting"
			}
		}
		if !hasIncoming {
			return "ready"
		}
		return "ready"
	}

	enqueueReady := func(nodeID string) {
		if executed[nodeID] || potentiallyRunnable[nodeID] {
			return
		}
		reachable := make(map[string]bool, len(executed)+len(potentiallyRunnable))
		for id := range executed {
			reachable[id] = true
		}
		for id := range potentiallyRunnable {
			reachable[id] = true
		}
		if evaluateNodeState(nodeID, reachable) != "ready" {
			return
		}
		potentiallyRunnable[nodeID] = true
		readyQueue = append(readyQueue, nodeID)
	}

	for _, node := range req.Nodes {
		hasIncoming := false
		for _, edge := range req.Edges {
			if edge.Target == node.ID {
				hasIncoming = true
				break
			}
		}
		if !hasIncoming {
			enqueueReady(node.ID)
		}
	}

	for nodeID := range req.ResumeState.ReusedNodes {
		node, ok := nodeByID[nodeID]
		if !ok {
			continue
		}
		for _, edge := range outgoingEdges[node.ID] {
			if node.Type == "condition" && !shouldTraverseConditionEdge(edge, conditionResults[node.ID]) {
				continue
			}
			enqueueReady(edge.Target)
		}
	}

	for len(readyQueue) > 0 {
		nodeID := readyQueue[0]
		readyQueue = readyQueue[1:]
		node, ok := nodeByID[nodeID]
		if !ok {
			continue
		}
		executed[nodeID] = true
		for _, edge := range outgoingEdges[node.ID] {
			if node.Type == "condition" && req.ResumeState.IsReused(node.ID) && !shouldTraverseConditionEdge(edge, conditionResults[node.ID]) {
				continue
			}
			enqueueReady(edge.Target)
		}
	}

	nodes := make([]NodeConfig, 0, len(potentiallyRunnable))
	for _, node := range req.Nodes {
		if potentiallyRunnable[node.ID] {
			nodes = append(nodes, node)
		}
	}
	return nodes
}

func shouldTraverseConditionEdge(edge EdgeConfig, conditionResult bool) bool {
	if edge.SourceHandle == "true" {
		return conditionResult
	}
	if edge.SourceHandle == "false" {
		return !conditionResult
	}
	return true
}

func (e *WorkflowExecutor) ensureSystemAINodeBalance(userID uint, node NodeConfig) error {
	if !isSystemAINode(node) {
		return nil
	}
	return e.ensurePositiveTokenBalance(userID)
}

func (e *WorkflowExecutor) ensurePositiveTokenBalance(userID uint) error {
	if userID == 0 {
		return fmt.Errorf("无法校验系统预设 AI 节点余额: userID 为空")
	}

	balance, err := e.userRepo.GetTokenBalance(userID)
	if err != nil {
		return fmt.Errorf("查询用户星尘余额失败: %w", err)
	}
	if balance > 0 {
		return nil
	}

	return fmt.Errorf("%w: %s", ErrInsufficientTokenBalance, insufficientTokenBalanceMessage)
}

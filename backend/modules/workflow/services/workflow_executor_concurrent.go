package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"

	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/shared"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	notification "yaolight-workshop/backend/modules/notification"
	taskModels "yaolight-workshop/backend/modules/task/models"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

type concurrentRunOptions struct {
	ctx      context.Context
	callback StreamCallback
	task     *taskModels.Task
	taskRepo taskRepos.TaskRepository
	nodeRepo taskRepos.TaskNodeExecutionRepository
	logRepo  taskRepos.TaskLogRepository
}

type nodeExecutionOutcome struct {
	nodeID        string
	nodeType      string
	result        NodeExecutionResult
	executionTime int64
}

func (e *WorkflowExecutor) ExecuteWorkflowStreamConcurrent(
	ctx context.Context,
	req ExecutionRequest,
	callback StreamCallback,
) error {
	if ctx == nil {
		ctx = context.Background()
	}

	now := time.Now()
	task := &taskModels.Task{
		WorkflowID: req.WorkflowID,
		UserID:     req.UserID,
		Status:     "running",
		Priority:   5,
		Progress:   0,
		RetryCount: 0,
		MaxRetries: 3,
		Tags:       shared.JSONB{Data: []interface{}{}},
		StartedAt:  &now,
		CreatedAt:  now,
		UpdatedAt:  now,
		Metadata:   jsonbFromPayload(map[string]interface{}{"scheduler_mode": "concurrent"}),
	}

	taskRepo := taskRepos.NewTaskRepository(database.DB)
	nodeRepo := taskRepos.NewTaskNodeExecutionRepository(database.DB)
	logRepo := taskRepos.NewTaskLogRepository(database.DB)
	if err := taskRepo.CreateTask(task); err != nil {
		log.Printf("create task record failed: %v", err)
	}
	if task.ID > 0 && req.OnTaskCreated != nil {
		req.OnTaskCreated(task.ID)
	}

	_, err := e.executeConcurrentWorkflow(req, concurrentRunOptions{
		ctx:      ctx,
		callback: callback,
		task:     task,
		taskRepo: taskRepo,
		nodeRepo: nodeRepo,
		logRepo:  logRepo,
	})
	return err
}

func (e *WorkflowExecutor) executeConcurrentWorkflow(
	req ExecutionRequest,
	opts concurrentRunOptions,
) (*ExecutionResult, error) {
	ctx := opts.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	if len(req.Nodes) == 0 {
		return &ExecutionResult{Success: false, Error: "workflow has no nodes"}, fmt.Errorf("workflow has no nodes")
	}

	startNodes := e.findStartNodes(req.Nodes, req.Edges)
	if len(startNodes) == 0 {
		return &ExecutionResult{Success: false, Error: "未找到开始节点"}, fmt.Errorf("未找到开始节点")
	}

	maxConcurrency := extractMaxConcurrency(req.RuntimeMeta)
	dataFlow := NewDataFlow(req.Edges)
	variableContext := NewVariableContext()
	execMeta := ExecutionMeta{
		UserID:       req.UserID,
		RuntimeInput: req.RuntimeInput,
		RuntimeMeta:  req.RuntimeMeta,
	}
	if req.WorkflowID > 0 {
		wid := req.WorkflowID
		execMeta.WorkflowID = &wid
	}
	if opts.task != nil && opts.task.ID > 0 {
		tid := opts.task.ID
		execMeta.TaskID = &tid
	}

	nodeConfigs := make(map[string]NodeConfig, len(req.Nodes))
	outgoingEdges := make(map[string][]EdgeConfig)
	startNodeIDs := make(map[string]struct{}, len(startNodes))
	for _, node := range req.Nodes {
		nodeConfigs[node.ID] = node
		variableContext.SetNodeType(node.ID, node.Type)
	}
	for _, node := range startNodes {
		startNodeIDs[node.ID] = struct{}{}
	}
	for _, edge := range req.Edges {
		outgoingEdges[edge.Source] = append(outgoingEdges[edge.Source], edge)
	}
	terminalNodes := collectTerminalNodes(req.Nodes, req.Edges)

	var emitMu sync.Mutex
	emit := func(nodeID string, content string, done bool, contentType string, err error) {
		if opts.callback == nil {
			return
		}
		emitMu.Lock()
		defer emitMu.Unlock()
		opts.callback(nodeID, content, done, contentType, err)
	}

	nodeResultPayload := func(result NodeExecutionResult, status string) string {
		payload := map[string]interface{}{
			"node_id": result.NodeID,
			"type":    result.Type,
			"success": result.Success,
			"data":    result.Data,
			"error":   result.Error,
			"status":  status,
		}
		raw, _ := json.Marshal(payload)
		return string(raw)
	}

	saveNodeExecution := func(nodeID string, nodeType string, result NodeExecutionResult, executionTime int64, status string) {
		if opts.task == nil || opts.task.ID == 0 || opts.nodeRepo == nil {
			return
		}

		now := time.Now()
		var inputData *shared.JSONB
		var outputData *shared.JSONB
		if nodeInput, err := dataFlow.GetNodeInputData(nodeID); err == nil && nodeInput != nil && nodeInput.Payload != nil {
			inputData = jsonbFromPayload(nodeInput.Payload)
		}
		if result.Data != nil {
			outputData = jsonbFromPayload(result.Data)
		}
		if outputData != nil {
			if _, isStartNode := startNodeIDs[nodeID]; isStartNode && opts.task.InputData == nil {
				if len(startNodeIDs) == 1 {
					opts.task.InputData = outputData
				} else {
					opts.task.InputData = jsonbFromPayload(map[string]interface{}{nodeID: outputData.Data})
				}
			} else if _, isStartNode := startNodeIDs[nodeID]; isStartNode && len(startNodeIDs) > 1 {
				current, ok := map[string]interface{}{}, false
				if opts.task.InputData != nil {
					current, ok = opts.task.InputData.Data.(map[string]interface{})
				}
				if !ok {
					current = map[string]interface{}{}
				}
				current[nodeID] = outputData.Data
				opts.task.InputData = jsonbFromPayload(current)
			}
		}

		execTimeInt := int(executionTime)
		existingExecution, err := opts.nodeRepo.GetByTaskIDAndNodeID(opts.task.ID, nodeID)
		if err == nil && existingExecution != nil {
			existingExecution.Status = status
			existingExecution.InputData = inputData
			existingExecution.OutputData = outputData
			existingExecution.ExecutionTime = &execTimeInt
			existingExecution.CompletedAt = &now
			applyExecutionFailure(existingExecution, status, result)
			if err := opts.nodeRepo.Update(existingExecution); err != nil {
				log.Printf("update node execution failed: %v", err)
			}
			return
		}

		execution := &taskModels.TaskNodeExecution{
			TaskID:        opts.task.ID,
			NodeID:        nodeID,
			NodeType:      nodeType,
			Status:        status,
			InputData:     inputData,
			OutputData:    outputData,
			ExecutionTime: &execTimeInt,
			RetryCount:    0,
			CompletedAt:   &now,
			CreatedAt:     now,
		}
		if status == "running" {
			execution.StartedAt = &now
		}
		applyExecutionFailure(execution, status, result)
		if err := opts.nodeRepo.Create(execution); err != nil {
			log.Printf("create node execution failed: %v", err)
		}
	}

	createRunningExecution := func(nodeID string, nodeType string) {
		if opts.task == nil || opts.task.ID == 0 || opts.nodeRepo == nil {
			return
		}

		now := time.Now()
		existingExecution, err := opts.nodeRepo.GetByTaskIDAndNodeID(opts.task.ID, nodeID)
		if err == nil && existingExecution != nil {
			existingExecution.Status = "running"
			existingExecution.StartedAt = &now
			existingExecution.CompletedAt = nil
			existingExecution.ErrorMessage = nil
			existingExecution.ErrorStack = nil
			if err := opts.nodeRepo.Update(existingExecution); err != nil {
				log.Printf("update running node execution failed: %v", err)
			}
			return
		}

		runningExecution := &taskModels.TaskNodeExecution{
			TaskID:     opts.task.ID,
			NodeID:     nodeID,
			NodeType:   nodeType,
			Status:     "running",
			RetryCount: 0,
			StartedAt:  &now,
			CreatedAt:  now,
		}
		if err := opts.nodeRepo.Create(runningExecution); err != nil {
			log.Printf("create running node execution failed: %v", err)
		}
	}

	updateTaskProgress := func(finalizedCount int) {
		if opts.task == nil || opts.task.ID == 0 || opts.taskRepo == nil {
			return
		}
		opts.task.Progress = int(float64(finalizedCount) / float64(len(req.Nodes)) * 100)
		opts.task.UpdatedAt = time.Now()
		if err := opts.taskRepo.UpdateTask(opts.task); err != nil {
			log.Printf("update task progress failed: %v", err)
		}
	}

	type nodePhase string
	const (
		nodePending nodePhase = "pending"
		nodeQueued  nodePhase = "queued"
		nodeRunning nodePhase = "running"
		nodeDone    nodePhase = "done"
	)

	phase := make(map[string]nodePhase, len(req.Nodes))
	executed := make(map[string]bool, len(req.Nodes))
	nodeStatus := make(map[string]string, len(req.Nodes))
	conditionResults := make(map[string]bool)
	nodeResults := make(map[string]NodeExecutionResult, len(req.Nodes))
	readyQueue := make([]string, 0, len(startNodes))
	for _, node := range req.Nodes {
		phase[node.ID] = nodePending
	}

	findNodeConfig := func(nodeID string) *NodeConfig {
		node, ok := nodeConfigs[nodeID]
		if !ok {
			return nil
		}
		return &node
	}

	evaluateNodeState := func(nodeID string) (string, string) {
		hasIncoming := false
		for _, edge := range req.Edges {
			if edge.Target != nodeID {
				continue
			}
			hasIncoming = true
			if !isEdgeActive(edge, req.Nodes, req.Edges, conditionResults, executed) {
				continue
			}
			if !executed[edge.Source] {
				return "waiting", ""
			}
			if nodeStatus[edge.Source] != "completed" {
				return "blocked", fmt.Sprintf("上游节点 %s 未成功执行", edge.Source)
			}
		}
		if !hasIncoming {
			return "ready", ""
		}
		return "ready", ""
	}

	var enqueueReady func(nodeID string)
	enqueueReady = func(nodeID string) {
		if phase[nodeID] != nodePending || executed[nodeID] {
			return
		}
		state, reason := evaluateNodeState(nodeID)
		switch state {
		case "ready":
			phase[nodeID] = nodeQueued
			readyQueue = append(readyQueue, nodeID)
		case "blocked":
			nodeConfig := findNodeConfig(nodeID)
			if nodeConfig == nil {
				return
			}
			result := NodeExecutionResult{
				NodeID:  nodeID,
				Type:    nodeConfig.Type,
				Success: false,
				Error:   reason,
			}
			phase[nodeID] = nodeDone
			executed[nodeID] = true
			nodeStatus[nodeID] = "skipped"
			nodeResults[nodeID] = result
			saveNodeExecution(nodeID, nodeConfig.Type, result, 0, "skipped")
			emit(nodeID, nodeResultPayload(result, "skipped"), false, "node_result", nil)
			updateTaskProgress(len(nodeResults))
			for _, edge := range outgoingEdges[nodeID] {
				enqueueReady(edge.Target)
			}
		}
	}

	for _, node := range startNodes {
		enqueueReady(node.ID)
	}

	doneCh := make(chan nodeExecutionOutcome, len(req.Nodes))
	runningCount := 0
	workflowFailed := false
	workflowCancelled := false
	workflowFailureMessage := ""
	workflowFailureStack := ""

	dispatchNode := func(nodeID string) {
		nodeConfig := findNodeConfig(nodeID)
		if nodeConfig == nil {
			return
		}
		phase[nodeID] = nodeRunning
		runningCount++
		createRunningExecution(nodeID, nodeConfig.Type)

		go func(node NodeConfig) {
			startedAt := time.Now()
			result := NodeExecutionResult{
				NodeID:  node.ID,
				Type:    node.Type,
				Success: false,
			}
			if node.Type == "ai" && opts.callback != nil && e.shouldUseAINodeStream(req.UserID, node) {
				var streamSuccess bool
				var streamError error
				wrappedCallback := func(nodeID string, content string, done bool, contentType string, err error) {
					if done {
						streamSuccess = err == nil
						streamError = err
					}
					emit(nodeID, content, done, contentType, err)
				}
				e.ExecuteAINodeStream(ctx, node, dataFlow, variableContext, req.UserID, wrappedCallback)
				result.Success = streamSuccess
				if output := dataFlow.GetNodeOutput(node.ID); output != nil {
					result.Data = output.Payload
				}
				if streamError != nil {
					result.Error = streamError.Error()
					result.ErrorStack = currentErrorStack()
				}
			} else {
				result = e.executeNodeSafely(node, dataFlow, variableContext, execMeta)
			}

			doneCh <- nodeExecutionOutcome{
				nodeID:        node.ID,
				nodeType:      node.Type,
				result:        result,
				executionTime: time.Since(startedAt).Milliseconds(),
			}
		}(*nodeConfig)
	}

	finalizeTask := func() error {
		if opts.task == nil || opts.task.ID == 0 || opts.taskRepo == nil {
			return nil
		}

		completedAt := time.Now()
		opts.task.Progress = 100
		opts.task.CompletedAt = &completedAt
		opts.task.UpdatedAt = completedAt
		duration := int(completedAt.Sub(*opts.task.StartedAt).Milliseconds())
		opts.task.ActualDuration = &duration
		opts.task.Result = collectTaskResultPayload(dataFlow, terminalNodes)

		switch {
		case workflowCancelled:
			opts.task.Status = "cancelled"
		case workflowFailed:
			opts.task.Status = "failed"
			applyTaskFailure(opts.task, workflowFailureMessage, workflowFailureStack)
		default:
			opts.task.Status = "completed"
			opts.task.ErrorMessage = nil
			opts.task.ErrorStack = nil
		}

		if err := opts.taskRepo.UpdateTask(opts.task); err != nil {
			return err
		}

		if opts.task.Status == "completed" && req.WorkflowID > 0 {
			var workflow workflowModels.Workflow
			if err := database.DB.First(&workflow, req.WorkflowID).Error; err == nil {
				title := "工作流执行完成"
				content := "任务已执行完成，点击查看结果。"
				if strings.TrimSpace(workflow.Name) != "" {
					title = fmt.Sprintf("工作流「%s」执行完成", workflow.Name)
				}
				actionURL := fmt.Sprintf("/tasks/%d", opts.task.ID)
				notification.Notify(opts.task.UserID, "task_completed", title, content, actionURL)
			}
		}

		return nil
	}

	allDone := func() bool {
		return len(nodeResults) == len(req.Nodes)
	}

	markPendingNodesCancelled := func() {
		for _, node := range req.Nodes {
			if phase[node.ID] == nodeDone || phase[node.ID] == nodeRunning {
				continue
			}
			result := NodeExecutionResult{
				NodeID:  node.ID,
				Type:    node.Type,
				Success: false,
				Error:   "workflow cancelled",
			}
			phase[node.ID] = nodeDone
			executed[node.ID] = true
			nodeStatus[node.ID] = "cancelled"
			nodeResults[node.ID] = result
			saveNodeExecution(node.ID, node.Type, result, 0, "cancelled")
			emit(node.ID, nodeResultPayload(result, "cancelled"), false, "node_result", nil)
		}
		updateTaskProgress(len(nodeResults))
	}

	for !allDone() {
		for !workflowCancelled && runningCount < maxConcurrency && len(readyQueue) > 0 {
			nodeID := readyQueue[0]
			readyQueue = readyQueue[1:]
			if phase[nodeID] != nodeQueued {
				continue
			}
			dispatchNode(nodeID)
		}

		if allDone() {
			break
		}

		if workflowCancelled && runningCount == 0 {
			markPendingNodesCancelled()
			break
		}

		if runningCount == 0 && len(readyQueue) == 0 {
			changed := false
			for _, node := range req.Nodes {
				if phase[node.ID] != nodePending {
					continue
				}
				state, reason := evaluateNodeState(node.ID)
				if state == "blocked" {
					enqueueReady(node.ID)
					changed = true
				} else if state == "ready" && strings.TrimSpace(reason) != "" {
					enqueueReady(node.ID)
					changed = true
				}
			}
			if !changed {
				for _, node := range req.Nodes {
					if phase[node.ID] == nodeDone {
						continue
					}
					result := NodeExecutionResult{
						NodeID:  node.ID,
						Type:    node.Type,
						Success: false,
						Error:   "节点未满足执行条件，已跳过",
					}
					phase[node.ID] = nodeDone
					executed[node.ID] = true
					nodeStatus[node.ID] = "skipped"
					nodeResults[node.ID] = result
					saveNodeExecution(node.ID, node.Type, result, 0, "skipped")
					emit(node.ID, nodeResultPayload(result, "skipped"), false, "node_result", nil)
				}
				updateTaskProgress(len(nodeResults))
			}
			continue
		}

		select {
		case <-ctx.Done():
			workflowCancelled = true
		case outcome := <-doneCh:
			runningCount--
			nodeID := outcome.nodeID
			nodeConfig := findNodeConfig(nodeID)
			if nodeConfig == nil {
				continue
			}

			phase[nodeID] = nodeDone
			executed[nodeID] = true
			nodeResults[nodeID] = outcome.result
			if outcome.result.Success {
				nodeData := NewNodeData(outcome.result.Data)
				dataFlow.SetNodeOutput(nodeID, nodeData)
				variableContext.SetNodeOutput(nodeID, nodeData)
				nodeStatus[nodeID] = "completed"
				saveNodeExecution(nodeID, outcome.nodeType, outcome.result, outcome.executionTime, "completed")
				emit(nodeID, nodeResultPayload(outcome.result, "completed"), false, "node_result", nil)
			} else {
				status := "failed"
				if workflowCancelled || errorsContainContextCancellation(outcome.result.Error) {
					status = "cancelled"
				} else {
					workflowFailed = true
					if workflowFailureMessage == "" {
						workflowFailureMessage = outcome.result.Error
						workflowFailureStack = outcome.result.ErrorStack
					}
					if opts.logRepo != nil && opts.task != nil && opts.task.ID > 0 {
						nodeIDCopy := nodeID
						createTaskFailureLog(opts.logRepo, opts.task.ID, &nodeIDCopy, "error", outcome.result.Error, buildFailureMetadata(nodeConfig.Type, status), outcome.result.ErrorStack)
					}
				}
				nodeStatus[nodeID] = status
				saveNodeExecution(nodeID, outcome.nodeType, outcome.result, outcome.executionTime, status)
				emit(nodeID, nodeResultPayload(outcome.result, status), false, "node_result", nil)
			}
			updateTaskProgress(len(nodeResults))

			if nodeConfig.Type == "condition" && outcome.result.Success {
				if resultData, ok := outcome.result.Data.(map[string]interface{}); ok {
					if res, exists := resultData["result"]; exists {
						if boolRes, ok := res.(bool); ok {
							conditionResults[nodeID] = boolRes
						}
					}
				}
			}

			for _, edge := range outgoingEdges[nodeID] {
				if nodeConfig.Type == "condition" {
					shouldExecute := false
					conditionResult := conditionResults[nodeID]
					if edge.SourceHandle == "true" && conditionResult {
						shouldExecute = true
					} else if edge.SourceHandle == "false" && !conditionResult {
						shouldExecute = true
					} else if edge.SourceHandle == "" {
						shouldExecute = true
					}
					if !shouldExecute {
						continue
					}
				}
				enqueueReady(edge.Target)
			}
		}
	}

	if err := finalizeTask(); err != nil {
		return nil, err
	}

	orderedResults := make([]NodeExecutionResult, 0, len(req.Nodes))
	for _, node := range req.Nodes {
		if result, ok := nodeResults[node.ID]; ok {
			orderedResults = append(orderedResults, result)
		}
	}

	return &ExecutionResult{
		Success: !workflowFailed && !workflowCancelled,
		Results: orderedResults,
	}, nil
}

func (e *WorkflowExecutor) shouldUseAINodeStream(userID uint, node NodeConfig) bool {
	if node.Type != "ai" {
		return false
	}

	if stream, ok := node.Config["stream"].(bool); ok {
		return stream
	}

	modelMode := getString(node.Config, "modelMode", "system")
	modelID := getUint(node.Config, "modelId", 0)
	modelRepo := aiRepos.NewAIModelRepository(database.DB)
	modelConfig, err := aiService.GetModelConfigForExecution(
		modelMode,
		modelID,
		userID,
		node.Config,
		modelRepo,
	)
	if err != nil {
		return false
	}

	if modelMode == "saved" && modelID > 0 {
		modelEntity, err := modelRepo.FindByIDAndUser(modelID, userID)
		if err == nil && modelEntity != nil && modelEntity.Params.Data != nil {
			if paramsMap, ok := modelEntity.Params.Data.(map[string]interface{}); ok {
				if stream, ok := paramsMap["stream"].(bool); ok {
					return stream
				}
			}
		}
	}

	return modelConfig != nil && modelConfig.Provider == "doubao"
}

func extractMaxConcurrency(runtimeMeta map[string]interface{}) int {
	const defaultConcurrency = 4
	if runtimeMeta == nil {
		return defaultConcurrency
	}

	for _, key := range []string{"maxConcurrency", "max_concurrency"} {
		raw, exists := runtimeMeta[key]
		if !exists {
			continue
		}

		switch value := raw.(type) {
		case int:
			if value > 0 {
				return value
			}
		case int32:
			if value > 0 {
				return int(value)
			}
		case int64:
			if value > 0 {
				return int(value)
			}
		case float64:
			if value > 0 {
				return int(value)
			}
		}
	}

	return defaultConcurrency
}

func errorsContainContextCancellation(message string) bool {
	message = strings.ToLower(strings.TrimSpace(message))
	if message == "" {
		return false
	}
	return strings.Contains(message, "context canceled") || strings.Contains(message, "context cancelled")
}

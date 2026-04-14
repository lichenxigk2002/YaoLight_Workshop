package services

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"
	log "yaolight-workshop/backend/infrastructure/logx"

	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/shared"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	aiService "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
	notification "yaolight-workshop/backend/modules/notification"
	taskModels "yaolight-workshop/backend/modules/task/models"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

func (e *WorkflowExecutor) ExecuteWorkflowStream(
	ctx context.Context,
	req ExecutionRequest,
	callback StreamCallback,
) error {
	if len(req.Nodes) == 0 {
		return fmt.Errorf("workflow has no nodes")
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
	}

	taskRepo := taskRepos.NewTaskRepository(database.DB)
	nodeExecutionRepo := taskRepos.NewTaskNodeExecutionRepository(database.DB)
	logRepo := taskRepos.NewTaskLogRepository(database.DB)
	startNodes := e.findStartNodes(req.Nodes, req.Edges)
	startNodeIDs := make(map[string]struct{}, len(startNodes))
	for _, node := range startNodes {
		startNodeIDs[node.ID] = struct{}{}
	}
	terminalNodes := collectTerminalNodes(req.Nodes, req.Edges)

	if err := taskRepo.CreateTask(task); err != nil {
		log.Printf("create task record failed: %v", err)
	}
	if task.ID > 0 && req.OnTaskCreated != nil {
		req.OnTaskCreated(task.ID)
	}

	taskStartTime := time.Now()

	checkStreamEnabled := func(node NodeConfig, modelConfig *providers.AIModelConfig) bool {
		if stream, ok := node.Config["stream"].(bool); ok {
			return stream
		}

		if modelMode := getString(node.Config, "modelMode", "system"); modelMode == "saved" {
			modelID := getUint(node.Config, "modelId", 0)
			if modelID > 0 {
				modelRepo := aiRepos.NewAIModelRepository(database.DB)
				modelEntity, err := modelRepo.FindByIDAndUser(modelID, req.UserID)
				if err == nil && modelEntity != nil && modelEntity.Params.Data != nil {
					if paramsMap, ok := modelEntity.Params.Data.(map[string]interface{}); ok {
						if stream, ok := paramsMap["stream"].(bool); ok {
							return stream
						}
					}
				}
			}
		}

		return modelConfig != nil && modelConfig.Provider == "doubao"
	}

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
	if task.ID > 0 {
		tid := task.ID
		execMeta.TaskID = &tid
	}

	nodeConfigs := make(map[string]NodeConfig, len(req.Nodes))
	incomingEdges := make(map[string][]EdgeConfig)
	outgoingEdges := make(map[string][]EdgeConfig)
	for _, node := range req.Nodes {
		nodeConfigs[node.ID] = node
	}
	for _, edge := range req.Edges {
		incomingEdges[edge.Target] = append(incomingEdges[edge.Target], edge)
		outgoingEdges[edge.Source] = append(outgoingEdges[edge.Source], edge)
	}

	executed := make(map[string]bool)
	nodeStatus := make(map[string]string)
	conditionResults := make(map[string]bool)
	queue := make([]string, 0, len(startNodes))
	queued := make(map[string]bool)
	workflowFailed := false
	workflowFailureMessage := ""
	workflowFailureStack := ""
	currentExecutingNodeID := ""

	emitNodeResult := func(result NodeExecutionResult, status string) {
		payload := map[string]interface{}{
			"node_id": result.NodeID,
			"type":    result.Type,
			"success": result.Success,
			"data":    result.Data,
			"error":   result.Error,
			"status":  status,
		}
		resultJSON, _ := json.Marshal(payload)
		callback(result.NodeID, string(resultJSON), false, "node_result", nil)
	}

	saveNodeExecution := func(nodeID string, nodeType string, result NodeExecutionResult, executionTime int64, statusOverride string) {
		if task.ID == 0 {
			return
		}

		updatedTask, err := taskRepo.GetTaskByID(task.ID)
		isCancelled := false
		if err == nil && updatedTask != nil {
			isCancelled = updatedTask.Status == "cancelled" && updatedTask.CancelledBy != nil
		}

		nodeStartTime := time.Now().Add(-time.Duration(executionTime) * time.Millisecond)
		nodeCompletedTime := time.Now()

		status := statusOverride
		if status == "" {
			status = "completed"
			if !result.Success {
				isContextCanceled := false
				if result.Error != "" {
					errorLower := strings.ToLower(result.Error)
					isContextCanceled = strings.Contains(errorLower, "context canceled") ||
						strings.Contains(errorLower, "context cancelled")
				}
				if isCancelled || isContextCanceled {
					status = "cancelled"
				} else {
					status = "failed"
				}
			}
		}

		var inputData *shared.JSONB
		var outputData *shared.JSONB
		if nodeInput, err := dataFlow.GetNodeInputData(nodeID); err == nil && nodeInput != nil && nodeInput.Payload != nil {
			inputData = jsonbFromPayload(nodeInput.Payload)
		}
		if result.Data != nil {
			outputData = jsonbFromPayload(result.Data)
		}

		if outputData != nil {
			if _, isStartNode := startNodeIDs[nodeID]; isStartNode && task.InputData == nil {
				if len(startNodeIDs) == 1 {
					task.InputData = outputData
				} else {
					task.InputData = jsonbFromPayload(map[string]interface{}{nodeID: outputData.Data})
				}
			} else if _, isStartNode := startNodeIDs[nodeID]; isStartNode && len(startNodeIDs) > 1 {
				if current, ok := task.InputData.Data.(map[string]interface{}); ok {
					current[nodeID] = outputData.Data
				} else {
					task.InputData = jsonbFromPayload(map[string]interface{}{nodeID: outputData.Data})
				}
			}
		}

		execTimeInt := int(executionTime)
		existingExecution, err := nodeExecutionRepo.GetByTaskIDAndNodeID(task.ID, nodeID)
		if err == nil && existingExecution != nil {
			existingExecution.Status = status
			existingExecution.InputData = inputData
			existingExecution.OutputData = outputData
			existingExecution.ExecutionTime = &execTimeInt
			existingExecution.CompletedAt = &nodeCompletedTime

			applyExecutionFailure(existingExecution, status, result)

			if err := nodeExecutionRepo.Update(existingExecution); err != nil {
				log.Printf("update node execution failed: %v", err)
			}
			return
		}

		execution := &taskModels.TaskNodeExecution{
			TaskID:        task.ID,
			NodeID:        nodeID,
			NodeType:      nodeType,
			Status:        status,
			InputData:     inputData,
			OutputData:    outputData,
			ExecutionTime: &execTimeInt,
			RetryCount:    0,
			StartedAt:     &nodeStartTime,
			CompletedAt:   &nodeCompletedTime,
			CreatedAt:     time.Now(),
		}

		applyExecutionFailure(execution, status, result)

		if err := nodeExecutionRepo.Create(execution); err != nil {
			log.Printf("create node execution failed: %v", err)
		}
	}

	createRunningExecution := func(nodeID string, nodeType string) {
		if task.ID == 0 {
			return
		}

		existingExecution, err := nodeExecutionRepo.GetByTaskIDAndNodeID(task.ID, nodeID)
		now := time.Now()
		if err == nil && existingExecution != nil {
			existingExecution.Status = "running"
			existingExecution.StartedAt = &now
			existingExecution.CompletedAt = nil
			existingExecution.ErrorMessage = nil
			existingExecution.ErrorStack = nil
			if err := nodeExecutionRepo.Update(existingExecution); err != nil {
				log.Printf("update running node execution failed: %v", err)
			}
			return
		}

		runningExecution := &taskModels.TaskNodeExecution{
			TaskID:     task.ID,
			NodeID:     nodeID,
			NodeType:   nodeType,
			Status:     "running",
			RetryCount: 0,
			StartedAt:  &now,
			CreatedAt:  now,
		}
		if err := nodeExecutionRepo.Create(runningExecution); err != nil {
			log.Printf("create running node execution failed: %v", err)
		}
	}

	cancelTaskExecution := func(cancelledBy *uint) error {
		if task.ID == 0 {
			return context.Canceled
		}

		cancelledAt := time.Now()
		actualDuration := int(time.Since(taskStartTime).Milliseconds())
		task.Status = "cancelled"
		task.CancelledAt = &cancelledAt
		task.CancelledBy = cancelledBy
		task.ActualDuration = &actualDuration
		task.UpdatedAt = time.Now()

		executedCount := 0
		for _, done := range executed {
			if done {
				executedCount++
			}
		}
		if len(req.Nodes) > 0 {
			task.Progress = int(float64(executedCount) / float64(len(req.Nodes)) * 100)
		}

		if err := taskRepo.UpdateTask(task); err != nil {
			log.Printf("update cancelled task failed: %v", err)
		}

		executions, err := nodeExecutionRepo.GetByTaskID(task.ID)
		if err == nil {
			for i := range executions {
				if executions[i].Status == "running" ||
					executions[i].Status == "pending" ||
					(executions[i].Status == "failed" && executions[i].NodeID == currentExecutingNodeID) {
					executions[i].Status = "cancelled"
					completedAt := time.Now()
					executions[i].CompletedAt = &completedAt
					if err := nodeExecutionRepo.Update(&executions[i]); err != nil {
						log.Printf("update cancelled node execution failed: %v", err)
					}
				}
			}
		}

		existingExecutions, err := nodeExecutionRepo.GetByTaskID(task.ID)
		for _, node := range req.Nodes {
			if executed[node.ID] {
				continue
			}
			exists := false
			if err == nil {
				for _, exec := range existingExecutions {
					if exec.NodeID == node.ID {
						exists = true
						break
					}
				}
			}
			if exists {
				continue
			}

			pendingExecution := &taskModels.TaskNodeExecution{
				TaskID:     task.ID,
				NodeID:     node.ID,
				NodeType:   node.Type,
				Status:     "pending",
				RetryCount: 0,
				CreatedAt:  time.Now(),
			}
			if err := nodeExecutionRepo.Create(pendingExecution); err != nil {
				log.Printf("create pending node execution failed: %v", err)
			}
		}

		return context.Canceled
	}

	updateFailedTask := func(message string, stack string) {
		if task.ID == 0 {
			return
		}

		completedAt := time.Now()
		actualDuration := int(time.Since(taskStartTime).Milliseconds())
		task.Status = "failed"
		task.Progress = 100
		task.CompletedAt = &completedAt
		task.ActualDuration = &actualDuration
		task.Result = collectTaskResultPayload(dataFlow, terminalNodes)
		task.UpdatedAt = time.Now()
		applyTaskFailure(task, message, stack)

		if err := taskRepo.UpdateTask(task); err != nil {
			log.Printf("update failed task failed: %v", err)
		}

		createTaskFailureLog(logRepo, task.ID, nil, "error", message, buildFailureMetadata("", "failed"), stack)
	}

	if len(startNodes) == 0 {
		err := fmt.Errorf("workflow has no start node")
		updateFailedTask(err.Error(), currentErrorStack())
		return err
	}

	evaluateNodeState := func(nodeID string) (string, string) {
		edges := incomingEdges[nodeID]
		if len(edges) == 0 {
			return "ready", ""
		}

		for _, edge := range edges {
			if !isEdgeActive(edge, req.Nodes, req.Edges, conditionResults, executed) {
				continue
			}
			if !executed[edge.Source] {
				return "waiting", ""
			}
			if nodeStatus[edge.Source] != "completed" {
				return "blocked", fmt.Sprintf("upstream node %s did not complete successfully", edge.Source)
			}
		}

		return "ready", ""
	}

	var markNodeSkipped func(nodeID string, reason string)
	var enqueueTarget func(nodeID string)

	markNodeSkipped = func(nodeID string, reason string) {
		if executed[nodeID] {
			return
		}

		nodeConfig, exists := nodeConfigs[nodeID]
		if !exists {
			return
		}

		delete(queued, nodeID)
		executed[nodeID] = true
		nodeStatus[nodeID] = "skipped"

		result := NodeExecutionResult{
			NodeID:  nodeID,
			Type:    nodeConfig.Type,
			Success: false,
			Error:   reason,
		}
		saveNodeExecution(nodeID, nodeConfig.Type, result, 0, "skipped")
		emitNodeResult(result, "skipped")

		for _, edge := range outgoingEdges[nodeID] {
			enqueueTarget(edge.Target)
		}
	}

	enqueueTarget = func(nodeID string) {
		if executed[nodeID] || queued[nodeID] {
			return
		}

		state, reason := evaluateNodeState(nodeID)
		switch state {
		case "ready":
			queue = append(queue, nodeID)
			queued[nodeID] = true
		case "blocked":
			markNodeSkipped(nodeID, reason)
		}
	}

	for _, node := range startNodes {
		enqueueTarget(node.ID)
	}

	for len(queue) > 0 {
		select {
		case <-ctx.Done():
			return cancelTaskExecution(&req.UserID)
		default:
		}

		if task.ID > 0 {
			updatedTask, err := taskRepo.GetTaskByID(task.ID)
			if err == nil && updatedTask != nil && updatedTask.Status == "cancelled" && updatedTask.CancelledBy != nil {
				task.Status = updatedTask.Status
				task.CancelledAt = updatedTask.CancelledAt
				task.CancelledBy = updatedTask.CancelledBy
				task.UpdatedAt = updatedTask.UpdatedAt
				task.ActualDuration = updatedTask.ActualDuration
				return cancelTaskExecution(updatedTask.CancelledBy)
			}
		}

		nodeID := queue[0]
		queue = queue[1:]
		delete(queued, nodeID)

		if executed[nodeID] {
			continue
		}

		state, reason := evaluateNodeState(nodeID)
		switch state {
		case "waiting":
			continue
		case "blocked":
			markNodeSkipped(nodeID, reason)
			continue
		}

		nodeConfig, exists := nodeConfigs[nodeID]
		if !exists {
			continue
		}

		variableContext.SetNodeType(nodeID, nodeConfig.Type)
		currentExecutingNodeID = nodeID
		createRunningExecution(nodeID, nodeConfig.Type)

		var result NodeExecutionResult
		var executionTime int64

		if nodeConfig.Type == "ai" {
			modelMode := getString(nodeConfig.Config, "modelMode", "system")
			if modelMode == "" {
				modelMode = "system"
			}

			modelRepo := aiRepos.NewAIModelRepository(database.DB)
			modelConfig, err := aiService.GetModelConfigForExecution(
				modelMode,
				getUint(nodeConfig.Config, "modelId", 0),
				req.UserID,
				nodeConfig.Config,
				modelRepo,
			)

			if err == nil && modelConfig != nil && checkStreamEnabled(nodeConfig, modelConfig) {
				nodeStartTime := time.Now()
				streamSuccess := false
				var streamError error

				wrappedCallback := func(streamNodeID string, content string, done bool, contentType string, err error) {
					if err != nil {
						streamError = err
					}
					if done {
						streamSuccess = err == nil
					}
					if err == nil {
						callback(streamNodeID, content, done, contentType, nil)
					}
				}

				e.ExecuteAINodeStream(ctx, nodeConfig, dataFlow, variableContext, req.UserID, wrappedCallback)
				executionTime = time.Since(nodeStartTime).Milliseconds()

				outputData := dataFlow.GetNodeOutput(nodeID)
				result = NodeExecutionResult{
					NodeID:  nodeID,
					Type:    nodeConfig.Type,
					Success: streamSuccess,
				}
				if outputData != nil && outputData.Payload != nil {
					result.Data = outputData.Payload
				}
				if streamError != nil {
					result.Error = streamError.Error()
					result.ErrorStack = currentErrorStack()
				}
			} else {
				nodeStartTime := time.Now()
				result = e.executeNodeSafely(nodeConfig, dataFlow, variableContext, execMeta)
				executionTime = time.Since(nodeStartTime).Milliseconds()
			}
		} else {
			nodeStartTime := time.Now()
			result = e.executeNodeSafely(nodeConfig, dataFlow, variableContext, execMeta)
			executionTime = time.Since(nodeStartTime).Milliseconds()
		}

		currentExecutingNodeID = ""

		if ctx.Err() != nil {
			return cancelTaskExecution(&req.UserID)
		}

		executed[nodeID] = true

		if result.Success {
			nodeData := NewNodeData(result.Data)
			dataFlow.SetNodeOutput(nodeID, nodeData)
			variableContext.SetNodeOutput(nodeID, nodeData)
			nodeStatus[nodeID] = "completed"
			saveNodeExecution(nodeID, nodeConfig.Type, result, executionTime, "")
			emitNodeResult(result, "completed")
		} else {
			nodeStatus[nodeID] = "failed"
			saveNodeExecution(nodeID, nodeConfig.Type, result, executionTime, "")
			emitNodeResult(result, "failed")
			nodeIDCopy := nodeID
			createTaskFailureLog(logRepo, task.ID, &nodeIDCopy, "error", result.Error, buildFailureMetadata(nodeConfig.Type, "failed"), result.ErrorStack)
			workflowFailed = true
			if workflowFailureMessage == "" {
				workflowFailureMessage = result.Error
			}
			if workflowFailureStack == "" {
				workflowFailureStack = result.ErrorStack
			}
		}

		if nodeConfig.Type == "condition" && result.Success {
			conditionResult := false
			if resultData, ok := result.Data.(map[string]interface{}); ok {
				if res, exists := resultData["result"]; exists {
					if boolRes, ok := res.(bool); ok {
						conditionResult = boolRes
					}
				}
			}
			conditionResults[nodeID] = conditionResult

			for _, edge := range outgoingEdges[nodeID] {
				if executed[edge.Target] {
					continue
				}
				shouldExecute := false
				if edge.SourceHandle == "true" && conditionResult {
					shouldExecute = true
				} else if edge.SourceHandle == "false" && !conditionResult {
					shouldExecute = true
				} else if edge.SourceHandle == "" {
					shouldExecute = true
				}
				if shouldExecute {
					enqueueTarget(edge.Target)
				}
			}
			continue
		}

		if !result.Success {
			continue
		}

		for _, edge := range outgoingEdges[nodeID] {
			enqueueTarget(edge.Target)
		}
	}

	changed := true
	for changed {
		changed = false
		for _, node := range req.Nodes {
			if executed[node.ID] {
				continue
			}
			state, reason := evaluateNodeState(node.ID)
			if state == "blocked" {
				markNodeSkipped(node.ID, reason)
				changed = true
			}
		}
	}

	for _, node := range req.Nodes {
		if !executed[node.ID] {
			markNodeSkipped(node.ID, "node execution conditions were not satisfied")
		}
	}

	callback("workflow_complete", "", true, "workflow_complete", nil)

	if task.ID > 0 {
		completedAt := time.Now()
		actualDuration := int(time.Since(taskStartTime).Milliseconds())
		task.Progress = 100
		task.CompletedAt = &completedAt
		task.ActualDuration = &actualDuration
		task.Result = collectTaskResultPayload(dataFlow, terminalNodes)
		task.UpdatedAt = time.Now()

		if workflowFailed {
			task.Status = "failed"
			applyTaskFailure(task, workflowFailureMessage, workflowFailureStack)
		} else {
			task.Status = "completed"
			task.ErrorMessage = nil
			task.ErrorStack = nil
		}

		if err := taskRepo.UpdateTask(task); err != nil {
			log.Printf("update task status failed: %v", err)
		}

		if !workflowFailed {
			var workflow workflowModels.Workflow
			if err := database.DB.Select("name", "project_id").Where("id = ?", task.WorkflowID).First(&workflow).Error; err == nil {
				title := "工作流执行完成"
				content := "工作流《" + workflow.Name + "》已执行完成，点击查看结果。"
				actionURL := ""
				if workflow.ProjectID != nil && *workflow.ProjectID > 0 {
					actionURL = fmt.Sprintf("/projects/%d/workflows/%d/edit", *workflow.ProjectID, task.WorkflowID)
				}
				notification.Notify(task.UserID, "task_completed", title, content, actionURL)
			} else {
				notification.Notify(task.UserID, "task_completed", "工作流执行完成", "任务已执行完成，点击查看结果。", "")
			}
		}
	}

	return nil
}

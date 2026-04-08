package services

import (
	"fmt"
	"runtime/debug"
	"strings"
	"time"

	"yaolight-workshop/backend/infrastructure/shared"
	taskModels "yaolight-workshop/backend/modules/task/models"
	taskRepos "yaolight-workshop/backend/modules/task/repositories"
)

func currentErrorStack() string {
	return strings.TrimSpace(string(debug.Stack()))
}

func normalizeErrorStack(raw string) *string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return nil
	}
	return &value
}

func errorMessageForStatus(status string, result NodeExecutionResult) *string {
	if status == "completed" || status == "running" {
		return nil
	}

	message := strings.TrimSpace(result.Error)
	if message == "" && status == "skipped" {
		message = "node skipped"
	}
	if message == "" {
		return nil
	}
	return &message
}

func applyExecutionFailure(execution *taskModels.TaskNodeExecution, status string, result NodeExecutionResult) {
	execution.ErrorMessage = errorMessageForStatus(status, result)

	if execution.ErrorMessage == nil {
		execution.ErrorStack = nil
		return
	}

	execution.ErrorStack = normalizeErrorStack(result.ErrorStack)
}

func applyTaskFailure(task *taskModels.Task, message string, stack string) {
	trimmedMessage := strings.TrimSpace(message)
	if trimmedMessage == "" {
		task.ErrorMessage = nil
	} else {
		task.ErrorMessage = &trimmedMessage
	}
	task.ErrorStack = normalizeErrorStack(stack)
}

func buildFailureMetadata(nodeType string, status string) *shared.JSONB {
	payload := map[string]interface{}{
		"status": status,
	}
	if nodeType != "" {
		payload["nodeType"] = nodeType
	}
	return &shared.JSONB{Data: payload}
}

func createTaskFailureLog(
	logRepo taskRepos.TaskLogRepository,
	taskID uint,
	nodeID *string,
	level string,
	message string,
	metadata *shared.JSONB,
	stack string,
) {
	if taskID == 0 || strings.TrimSpace(message) == "" {
		return
	}

	entry := &taskModels.TaskLog{
		TaskID:     taskID,
		NodeID:     nodeID,
		Level:      level,
		Message:    message,
		Metadata:   metadata,
		StackTrace: normalizeErrorStack(stack),
		CreatedAt:  time.Now(),
	}

	_ = logRepo.Create(entry)
}

func (e *WorkflowExecutor) executeNodeSafely(
	node NodeConfig,
	dataFlow *DataFlow,
	variableContext *VariableContext,
	meta ExecutionMeta,
) (result NodeExecutionResult) {
	defer func() {
		if recovered := recover(); recovered != nil {
			result = NodeExecutionResult{
				NodeID:     node.ID,
				Type:       node.Type,
				Success:    false,
				Error:      fmt.Sprintf("node panic: %v", recovered),
				ErrorStack: currentErrorStack(),
			}
		}
	}()

	result = e.executeNode(node, dataFlow, variableContext, meta)
	if !result.Success && strings.TrimSpace(result.Error) != "" && strings.TrimSpace(result.ErrorStack) == "" {
		result.ErrorStack = currentErrorStack()
	}
	return result
}

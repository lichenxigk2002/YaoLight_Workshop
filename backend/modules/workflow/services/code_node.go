package services

import (
	"context"
	"fmt"
)

func (e *WorkflowExecutor) executeCodeNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	language := normalizeCodeNodeLanguage(getString(node.Config, "language", defaultCodeNodeLanguage))
	source := getString(node.Config, "source", "")
	timeoutMs := normalizeCodeNodeTimeout(getInt(node.Config, "timeoutMs", defaultCodeNodeTimeoutMs))
	inputMode := getString(node.Config, "inputMode", "merged")
	consoleEnabled := getBool(node.Config, "consoleEnabled", true)

	inputData, err := resolveCodeNodeInput(node.ID, inputMode, dataFlow)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "code",
			Success: false,
			Error:   fmt.Sprintf("获取代码节点输入失败: %v", err),
		}
	}

	runtimeConfig := getCodeRuntimeConfig(node.Config, language)
	if e.codeRuntimeRegistry == nil {
		e.codeRuntimeRegistry = NewDefaultCodeRuntimeRegistry()
	}
	runtime, ok := e.codeRuntimeRegistry.Get(language)
	if !ok {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "code",
			Success: false,
			Error:   unsupportedCodeRuntimeError(language).Error(),
		}
	}

	result, err := runtime.Execute(context.Background(), CodeExecutionRequest{
		NodeID:         node.ID,
		Language:       language,
		Source:         source,
		TimeoutMs:      timeoutMs,
		InputMode:      inputMode,
		Input:          ExtractPayload(inputData),
		Variables:      cloneVariableMap(variableContext.GetAllVariables()),
		ConsoleEnabled: consoleEnabled,
		RuntimeConfig:  runtimeConfig,
	})
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "code",
			Success: false,
			Error:   fmt.Sprintf("代码执行失败: %v", err),
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "code",
		Success: true,
		Data: map[string]interface{}{
			"result": result.Result,
			"stdout": result.Stdout,
			"stderr": result.Stderr,
			"metrics": map[string]interface{}{
				"durationMs": result.DurationMs,
				"language":   language,
			},
			"metadata": result.Metadata,
		},
	}
}

func resolveCodeNodeInput(nodeID string, inputMode string, dataFlow *DataFlow) (*NodeData, error) {
	if inputMode == "primary" {
		inputs, err := dataFlow.GetNodeInput(nodeID)
		if err != nil {
			return nil, err
		}
		if len(inputs) == 0 {
			return NewNodeData(nil), nil
		}
		return inputs[0], nil
	}
	return dataFlow.GetNodeInputData(nodeID)
}

func getCodeRuntimeConfig(config map[string]interface{}, language string) map[string]interface{} {
	runtimeConfig, ok := config["runtime"].(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}
	langConfig, ok := runtimeConfig[language].(map[string]interface{})
	if !ok {
		return map[string]interface{}{}
	}
	return langConfig
}

func cloneVariableMap(input map[string]interface{}) map[string]interface{} {
	if len(input) == 0 {
		return map[string]interface{}{}
	}
	cloned := make(map[string]interface{}, len(input))
	for key, value := range input {
		cloned[key] = value
	}
	return cloned
}

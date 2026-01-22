package services

import (
	"fmt"

	datacleanService "yaolight-workshop/backend/modules/dataclean/services"
)

// executeDataCleanNode 执行数据清洗节点
func (e *WorkflowExecutor) executeDataCleanNode(node NodeConfig, dataFlow *DataFlow, variableContext *VariableContext) NodeExecutionResult {
	// 获取上游节点的输入数据
	inputData, err := dataFlow.GetNodeInputData(node.ID)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "dataclean",
			Success: false,
			Error:   fmt.Sprintf("获取输入数据失败: %v", err),
		}
	}

	// 如果配置了数据变量，优先使用变量
	dataVariable := getString(node.Config, "dataVariable", "")
	if dataVariable != "" {
		resolved, err := variableContext.ResolveTemplateToInterface(dataVariable)
		if err == nil && resolved != nil {
			// 使用变量值作为输入数据
			inputData = NewNodeData(resolved)
		}
	}

	// 构建清洗配置
	config := datacleanService.CleanConfig{
		CleanType:    getString(node.Config, "cleanType", "custom"),
		RemoveHTML:   getBool(node.Config, "removeHTML", false),
		Trim:         getBool(node.Config, "trim", true),
		RemoveSpaces: getBool(node.Config, "removeSpaces", false),
		ToLowerCase:  getBool(node.Config, "toLowerCase", false),
		ToUpperCase:  getBool(node.Config, "toUpperCase", false),
		Deduplicate:  getBool(node.Config, "deduplicate", false),
	}

	// 如果使用预设配置
	if config.CleanType != "custom" {
		preset := e.datacleanService.GetPreset(config.CleanType)
		// 预设配置与用户配置合并
		if config.RemoveHTML || preset.RemoveHTML {
			config.RemoveHTML = true
		}
		if config.Trim || preset.Trim {
			config.Trim = true
		}
		if config.RemoveSpaces || preset.RemoveSpaces {
			config.RemoveSpaces = true
		}
		if config.ToLowerCase || preset.ToLowerCase {
			config.ToLowerCase = true
		}
		if config.ToUpperCase || preset.ToUpperCase {
			config.ToUpperCase = true
		}
		// 使用预设的提取和替换规则
		if preset.Extract != nil {
			config.Extract = preset.Extract
		}
		if len(preset.Replace) > 0 {
			config.Replace = preset.Replace
		}
	}

	// 处理替换规则
	if replaceRules, ok := node.Config["replace"].([]interface{}); ok {
		config.Replace = make([]datacleanService.ReplaceRule, 0)
		for _, rule := range replaceRules {
			if ruleMap, ok := rule.(map[string]interface{}); ok {
				config.Replace = append(config.Replace, datacleanService.ReplaceRule{
					From:  getString(ruleMap, "from", ""),
					To:    getString(ruleMap, "to", ""),
					Regex: getBool(ruleMap, "regex", false),
				})
			}
		}
	}

	// 处理提取规则
	if extractRule, ok := node.Config["extract"].(map[string]interface{}); ok {
		config.Extract = &datacleanService.ExtractRule{
			Pattern: getString(extractRule, "pattern", ""),
			Group:   getInt(extractRule, "group", 0),
		}
	}

	// 处理过滤规则
	if filterRule, ok := node.Config["filter"].(map[string]interface{}); ok {
		config.Filter = &datacleanService.FilterRule{
			Field:    getString(filterRule, "field", ""),
			Operator: getString(filterRule, "operator", "contains"),
			Value:    getString(filterRule, "value", ""),
		}
	}

	// 处理字段映射
	if fieldMapping, ok := node.Config["fieldMapping"].(map[string]interface{}); ok {
		config.FieldMapping = fieldMapping
	}

	// 执行数据清洗
	payload := ExtractPayload(inputData)
	result, err := e.datacleanService.Execute(payload, config)
	if err != nil {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "dataclean",
			Success: false,
			Error:   err.Error(),
		}
	}

	if !result.Success {
		return NodeExecutionResult{
			NodeID:  node.ID,
			Type:    "dataclean",
			Success: false,
			Error:   result.Error,
		}
	}

	// 将清洗后的数据包装成符合变量定义的格式
	// 变量定义中输出变量是 "cleaned"，所以需要包装成 { "cleaned": result.Data }
	// 同时，如果清洗后的数据是对象，保留其原有结构以便直接访问字段
	var cleanedData map[string]interface{}

	if cleanedObj, ok := result.Data.(map[string]interface{}); ok {
		// 如果清洗后的数据是对象，保留原有结构，同时添加 cleaned 字段
		cleanedData = make(map[string]interface{})
		for k, v := range cleanedObj {
			cleanedData[k] = v
		}
		// 添加 cleaned 字段，指向整个清洗后的数据（用于变量访问）
		cleanedData["cleaned"] = result.Data
	} else {
		// 如果清洗后的数据不是对象（是字符串、数组等），包装成对象
		cleanedData = map[string]interface{}{
			"cleaned": result.Data,
		}
	}

	return NodeExecutionResult{
		NodeID:  node.ID,
		Type:    "dataclean",
		Success: true,
		Data:    cleanedData,
	}
}

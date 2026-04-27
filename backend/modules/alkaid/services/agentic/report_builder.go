package agentic

import (
	"encoding/json"
	"fmt"
	"strings"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

func buildExplainReportFromToolResult(assistantContent string, workflowToolResult interface{}) alkaidModels.ExplainReport {
	report := alkaidModels.ExplainReport{
		Summary: strings.TrimSpace(assistantContent),
	}
	if len([]rune(report.Summary)) > 180 {
		report.Summary = string([]rune(report.Summary)[:180]) + "..."
	}

	root := toStringMap(workflowToolResult)
	summary := toStringMap(root["summary"])
	if len(summary) == 0 {
		summary = toStringMap(toStringMap(root["llmView"])["traversalHints"])
	}

	report.NodeCount = intFromAny(summary["nodeCount"])
	report.EdgeCount = intFromAny(summary["edgeCount"])

	nodeTypeCounts := toStringIntMap(summary["nodeTypeCounts"])
	if len(nodeTypeCounts) > 0 {
		parts := make([]string, 0, len(nodeTypeCounts))
		for nodeType, count := range nodeTypeCounts {
			parts = append(parts, fmt.Sprintf("%s: %d", nodeType, count))
		}
		report.VariableFlow = append(report.VariableFlow, "节点类型分布: "+strings.Join(parts, ", "))
	}

	if ids := stringSliceFromAny(summary["rootNodeIds"]); len(ids) > 1 {
		report.Risks = append(report.Risks, fmt.Sprintf("检测到 %d 个根节点，流程入口可能不够明确", len(ids)))
	}
	if ids := stringSliceFromAny(summary["leafNodeIds"]); len(ids) > 1 {
		report.Suggestions = append(report.Suggestions, fmt.Sprintf("检测到 %d 个叶子节点，可检查是否都能输出或结束", len(ids)))
	}
	if ids := stringSliceFromAny(summary["branchNodeIds"]); len(ids) > 0 {
		report.VariableFlow = append(report.VariableFlow, "存在分支节点: "+strings.Join(ids, ", "))
	}
	if ids := stringSliceFromAny(summary["mergeNodeIds"]); len(ids) > 0 {
		report.VariableFlow = append(report.VariableFlow, "存在汇聚节点: "+strings.Join(ids, ", "))
	}
	if report.NodeCount == 0 && report.EdgeCount == 0 {
		report.Suggestions = append(report.Suggestions, "未读取到稳定的画布摘要，请确认当前工作流已保存")
	}
	return report
}

func buildDebugReportFromToolResults(assistantContent string, validationResult interface{}, trialResult interface{}) alkaidModels.TrialReport {
	report := alkaidModels.TrialReport{
		Success: true,
		Summary: strings.TrimSpace(assistantContent),
	}
	if len([]rune(report.Summary)) > 220 {
		report.Summary = string([]rune(report.Summary)[:220]) + "..."
	}

	validation := toStringMap(validationResult)
	if len(validation) > 0 {
		valid, hasValid := boolFromAny(validation["valid"])
		if hasValid && !valid {
			report.Success = false
			report.Observations = append(report.Observations, "结构校验未通过")
		}
		for _, msg := range messagesFromList(validation["errors"]) {
			report.Observations = append(report.Observations, msg)
		}
		for _, msg := range messagesFromList(validation["warnings"]) {
			report.Observations = append(report.Observations, "警告: "+msg)
		}
	}

	trial := toStringMap(trialResult)
	if len(trial) > 0 {
		if success, ok := boolFromAny(trial["success"]); ok {
			report.Success = success
		}
		report.FailedNodeID = stringFromAny(trial["failedNodeId"])
		report.FailedNodeLabel = stringFromAny(trial["failedNodeLabel"])
		if reason := stringFromAny(trial["reason"]); reason != "" {
			report.Observations = append(report.Observations, reason)
		} else if errMsg := stringFromAny(trial["error"]); errMsg != "" {
			report.Observations = append(report.Observations, errMsg)
		}
		if summary := stringFromAny(trial["summary"]); summary != "" && !strings.Contains(report.Summary, summary) {
			report.Observations = append(report.Observations, summary)
		}
	}

	if report.Summary == "" {
		if report.Success {
			report.Summary = "调试完成，未发现阻塞性错误。"
		} else {
			report.Summary = "调试完成，发现需要处理的问题。"
		}
	}
	return report
}

func toStringMap(value interface{}) map[string]interface{} {
	if value == nil {
		return nil
	}
	if m, ok := value.(map[string]interface{}); ok {
		return m
	}
	data, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	var out map[string]interface{}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil
	}
	return out
}

func toStringIntMap(value interface{}) map[string]int {
	raw := toStringMap(value)
	if len(raw) == 0 {
		return nil
	}
	out := make(map[string]int, len(raw))
	for key, val := range raw {
		out[key] = intFromAny(val)
	}
	return out
}

func intFromAny(value interface{}) int {
	switch v := value.(type) {
	case int:
		return v
	case int64:
		return int(v)
	case float64:
		return int(v)
	case json.Number:
		i, _ := v.Int64()
		return int(i)
	default:
		return 0
	}
}

func boolFromAny(value interface{}) (bool, bool) {
	v, ok := value.(bool)
	return v, ok
}

func stringFromAny(value interface{}) string {
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v)
	default:
		if value == nil {
			return ""
		}
		return strings.TrimSpace(fmt.Sprintf("%v", value))
	}
}

func stringSliceFromAny(value interface{}) []string {
	items, ok := value.([]interface{})
	if !ok {
		if direct, ok := value.([]string); ok {
			return direct
		}
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if text := stringFromAny(item); text != "" {
			out = append(out, text)
		}
	}
	return out
}

func messagesFromList(value interface{}) []string {
	items, ok := value.([]interface{})
	if !ok {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if text := stringFromAny(item); text != "" && !strings.HasPrefix(text, "map[") {
			out = append(out, text)
			continue
		}
		m := toStringMap(item)
		if msg := stringFromAny(m["message"]); msg != "" {
			if path := stringFromAny(m["path"]); path != "" {
				out = append(out, path+": "+msg)
			} else {
				out = append(out, msg)
			}
		}
	}
	return out
}

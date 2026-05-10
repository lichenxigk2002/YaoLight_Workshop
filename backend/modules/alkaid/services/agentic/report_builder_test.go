package agentic

import "testing"

func TestBuildDebugReportFromToolResultsUsesFailedNode(t *testing.T) {
	report := buildDebugReportFromToolResults(
		"试跑发现 AI 节点配置错误",
		map[string]interface{}{
			"valid":    true,
			"warnings": []interface{}{map[string]interface{}{"path": "nodes", "message": "未检测到 output 节点"}},
		},
		map[string]interface{}{
			"success":         false,
			"failedNodeId":    "ai-1",
			"failedNodeLabel": "AI 总结",
			"reason":          "模型未配置",
			"summary":         "试跑失败，失败节点: ai-1",
		},
	)

	if report.Success {
		t.Fatalf("expected report to be unsuccessful")
	}
	if report.FailedNodeID != "ai-1" {
		t.Fatalf("expected failed node id, got %q", report.FailedNodeID)
	}
	if len(report.Observations) == 0 {
		t.Fatalf("expected observations")
	}
}

func TestBuildExplainReportFromWorkflowSummary(t *testing.T) {
	report := buildExplainReportFromToolResult("当前工作流用于抓取并总结网页。", map[string]interface{}{
		"summary": map[string]interface{}{
			"nodeCount":      4,
			"edgeCount":      3,
			"nodeTypeCounts": map[string]interface{}{"start": 1, "crawler": 1, "ai": 1, "output": 1},
			"branchNodeIds":  []interface{}{"condition-1"},
			"leafNodeIds":    []interface{}{"output-1"},
		},
	})

	if report.NodeCount != 4 || report.EdgeCount != 3 {
		t.Fatalf("unexpected summary counts: %#v", report)
	}
	if len(report.VariableFlow) == 0 {
		t.Fatalf("expected variable flow summary")
	}
}

func TestBuildExplainReportKeepsFullSummary(t *testing.T) {
	longSummary := "### 结构总览\n" +
		"start -> crawler-1 -> dataclean-1 -> ai-1 -> merge-1\n" +
		"start -> crawler-2 -> dataclean-2 -> ai-2 -> merge-1\n" +
		"start -> crawler-3 -> dataclean-3 -> ai-3 -> merge-1\n" +
		"merge-1 -> ai-4 -> output-1 -> end-1\n" +
		"这段内容需要在完整解释报告中完整保留，不能被后端截断成省略号。"

	report := buildExplainReportFromToolResult(longSummary, map[string]interface{}{
		"summary": map[string]interface{}{"nodeCount": 14, "edgeCount": 15},
	})

	if report.Summary != longSummary {
		t.Fatalf("expected full summary to be preserved, got %q", report.Summary)
	}
}

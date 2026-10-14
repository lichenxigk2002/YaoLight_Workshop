package agentic

import (
	"strings"
	"testing"

	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

func TestWorkflowMapFromGetWorkflowResultAddsVersionAndEdges(t *testing.T) {
	workflow := workflowMapFromGetWorkflowResult(map[string]interface{}{
		"workflow": map[string]interface{}{
			"nodes": []interface{}{map[string]interface{}{"id": "start-1", "type": "start"}},
		},
	})

	if workflow == nil {
		t.Fatalf("expected workflow map")
	}
	if workflow["version"] != "1.0.0" {
		t.Fatalf("expected default version, got %#v", workflow["version"])
	}
	if _, ok := workflow["edges"].([]interface{}); !ok {
		t.Fatalf("expected default edges array, got %#v", workflow["edges"])
	}
}

func TestTrialDebugNarrativeIncludesFailedNode(t *testing.T) {
	got := trialDebugNarrative(alkaidModels.TrialReport{
		Success:         false,
		FailedNodeID:    "ai-1",
		FailedNodeLabel: "AI 总结",
		Observations:    []string{"模型未配置"},
	})

	if !strings.Contains(got, "AI 总结") {
		t.Fatalf("expected failed node label in narrative, got %q", got)
	}
	if !strings.Contains(got, "模型未配置") {
		t.Fatalf("expected reason in narrative, got %q", got)
	}
}

func TestDetectUserReportedRuntimeErrorMatchesDouyinCrawler(t *testing.T) {
	workflow := map[string]interface{}{
		"nodes": []interface{}{
			map[string]interface{}{
				"id":   "node-2",
				"type": "crawler",
				"data": map[string]interface{}{
					"label":  "百度热榜抓取",
					"config": map[string]interface{}{"url": "https://top.baidu.com/board"},
				},
			},
			map[string]interface{}{
				"id":   "node-5",
				"type": "crawler",
				"data": map[string]interface{}{
					"label":  "抖音热榜抓取",
					"config": map[string]interface{}{"url": "https://www.douyin.com/hot"},
				},
			},
		},
	}

	issue := detectUserReportedRuntimeError(
		"看一下当前的工作流，抖音节点出问题了，报错是这个执行浏览器任务失败: exec: \"google-chrome\": executable file not found in $PATH",
		"",
		workflow,
	)
	if issue == nil {
		t.Fatalf("expected runtime error to be detected")
	}
	if issue.nodeID != "node-5" {
		t.Fatalf("expected douyin crawler node, got %#v", issue)
	}
	if !strings.Contains(issue.message, "google-chrome") {
		t.Fatalf("expected chrome error in message, got %q", issue.message)
	}
}

func TestDetectUserReportedRuntimeErrorUsesConversationHistory(t *testing.T) {
	workflow := map[string]interface{}{
		"nodes": []interface{}{
			map[string]interface{}{"id": "crawler-1", "type": "crawler", "data": map[string]interface{}{"label": "抖音抓取"}},
		},
	}

	issue := detectUserReportedRuntimeError(
		"确实出问题了，你必须看看",
		"用户：看一下当前的工作流，抖音节点出问题了，报错是这个执行浏览器任务失败: exec: \"google-chrome\": executable file not found in $PATH",
		workflow,
	)
	if issue == nil {
		t.Fatalf("expected runtime error from history")
	}
	if issue.nodeID != "crawler-1" {
		t.Fatalf("expected node from history keyword, got %#v", issue)
	}
}

func TestTrialDebugLevelEscalatesWhenUserReportsRealFailure(t *testing.T) {
	if got := trialDebugLevel("如何排查工作流执行失败？", ""); got != "quick" {
		t.Fatalf("expected generic question to stay quick, got %q", got)
	}
	if got := trialDebugLevel("确实出问题了，你必须看看", "用户：抖音节点报错是这个 exec: \"google-chrome\""); got != "standard" {
		t.Fatalf("expected reported failure to use standard trial, got %q", got)
	}
}

func TestWorkflowJSONHasNodeType(t *testing.T) {
	workflowJSON := `{"version":"1.0.0","nodes":[{"id":"start-1","type":"start"},{"id":"crawler-1","type":"crawler"}],"edges":[]}`
	if !workflowJSONHasNodeType(workflowJSON, "crawler") {
		t.Fatalf("expected crawler node type to be detected")
	}
	if workflowJSONHasNodeType(workflowJSON, "ai") {
		t.Fatalf("did not expect ai node type")
	}
	if workflowJSONHasNodeType(`not-json`, "crawler") {
		t.Fatalf("invalid JSON should not report node type")
	}
}

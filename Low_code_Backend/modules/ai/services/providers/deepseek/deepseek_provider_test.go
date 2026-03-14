package deepseek

import "testing"

func TestParseDSMLToolCalls(t *testing.T) {
	content := `在调用工具前先确认节点类型。
<｜DSML｜function_calls>
<｜DSML｜invoke name="get_node_spec">
<｜DSML｜parameter name="nodeType" string="true">merge</｜DSML｜parameter>
</｜DSML｜invoke>
</｜DSML｜function_calls>`

	cleanContent, toolCalls, ok := parseDSMLToolCalls(content)
	if !ok {
		t.Fatalf("expected DSML tool call to be parsed")
	}
	if cleanContent != "在调用工具前先确认节点类型。" {
		t.Fatalf("unexpected clean content: %q", cleanContent)
	}
	if len(toolCalls) != 1 {
		t.Fatalf("expected 1 tool call, got %d", len(toolCalls))
	}
	if toolCalls[0].Function.Name != "get_node_spec" {
		t.Fatalf("unexpected tool name: %s", toolCalls[0].Function.Name)
	}
	expectedArgs := `{"nodeType":"merge"}`
	if toolCalls[0].Function.Arguments != expectedArgs {
		t.Fatalf("unexpected tool args: %s", toolCalls[0].Function.Arguments)
	}
}

func TestParseDSMLToolCallsNoMatch(t *testing.T) {
	content := "普通文本回复"
	cleanContent, toolCalls, ok := parseDSMLToolCalls(content)
	if ok {
		t.Fatalf("expected no DSML match")
	}
	if cleanContent != content {
		t.Fatalf("unexpected clean content: %q", cleanContent)
	}
	if len(toolCalls) != 0 {
		t.Fatalf("expected no tool calls, got %d", len(toolCalls))
	}
}

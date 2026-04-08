package export

import (
	"strings"
	"testing"
)

func TestMarkdownProvider_Export_UnwrapFencedMarkdownString(t *testing.T) {
	p := &markdownProvider{}
	files, err := p.Export("```markdown\n# 标题\n\n内容\n```", nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	got := string(files[0].Bytes)
	if strings.Contains(got, "```") {
		t.Fatalf("expected unwrapped content, got fenced block: %q", got)
	}
	if !strings.Contains(got, "# 标题") {
		t.Fatalf("expected markdown heading, got %q", got)
	}
}

func TestMarkdownProvider_Export_ExtractFromMap(t *testing.T) {
	p := &markdownProvider{}
	files, err := p.Export(map[string]interface{}{
		"content":     "```markdown\n# H1\n```",
		"tokensUsed":  10,
		"model":       "x",
		"reasoning":   nil,
		"extraField1": "y",
	}, nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	got := string(files[0].Bytes)
	if strings.TrimSpace(got) != "# H1" {
		t.Fatalf("expected extracted markdown, got %q", got)
	}
}

func TestMarkdownProvider_Export_FallbackToJSONCodeblock(t *testing.T) {
	p := &markdownProvider{}
	files, err := p.Export(map[string]interface{}{
		"tokensUsed": 123,
	}, nil)
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(files) != 1 {
		t.Fatalf("expected 1 file, got %d", len(files))
	}
	got := string(files[0].Bytes)
	if !strings.HasPrefix(strings.TrimSpace(got), "```json") {
		t.Fatalf("expected json codeblock fallback, got %q", got)
	}
	if !strings.Contains(got, "tokensUsed") {
		t.Fatalf("expected tokensUsed in json fallback, got %q", got)
	}
}

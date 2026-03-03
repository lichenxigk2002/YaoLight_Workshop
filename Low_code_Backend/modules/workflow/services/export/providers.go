package export

import (
	"encoding/json"
	"fmt"
	"strings"
)

// DefaultFactory 创建并注册默认导出提供商
func DefaultFactory() *Factory {
	f := NewFactory()
	f.Register("json", &jsonProvider{})
	f.Register("markdown", &markdownProvider{})
	f.Register("md", &markdownProvider{})
	f.Register("text", &textProvider{})
	f.Register("txt", &textProvider{})
	f.Register("pdf", &pdfProvider{})
	f.Register("docx", &docxProvider{})
	f.Register("word", &docxProvider{})
	f.Register("mermaid", &mermaidProvider{})
	f.Register("timeline", &timelineProvider{})
	f.Register("sankey", &sankeyProvider{})
	f.Register("network", &networkProvider{})
	f.Register("chart", &chartSVGProvider{})
	f.Register("chart_svg", &chartSVGProvider{})
	return f
}

type jsonProvider struct{}

func (p *jsonProvider) Name() string { return "json" }

func (p *jsonProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	b, err := json.MarshalIndent(input, "", "  ")
	if err != nil {
		return nil, err
	}
	return []File{{
		Name:     "output.json",
		Kind:     "json",
		MimeType: "application/json; charset=utf-8",
		Bytes:    b,
	}}, nil
}

type markdownProvider struct{}

func (p *markdownProvider) Name() string { return "markdown" }

func unwrapFencedBlock(s string) string {
	ss := strings.TrimSpace(s)
	if !strings.HasPrefix(ss, "```") {
		return s
	}
	nl := strings.Index(ss, "\n")
	if nl <= 0 {
		return s
	}
	body := ss[nl+1:]
	if end := strings.LastIndex(body, "```"); end >= 0 {
		body = body[:end]
	}
	return strings.TrimSpace(body)
}

func extractPreferredText(input interface{}) (string, bool) {
	switch v := input.(type) {
	case string:
		if strings.TrimSpace(v) == "" {
			return "", false
		}
		return v, true
	case map[string]interface{}:
		if v == nil {
			return "", false
		}
		if s, ok := v["content"].(string); ok && strings.TrimSpace(s) != "" {
			return s, true
		}
		if s, ok := v["result"].(string); ok && strings.TrimSpace(s) != "" {
			return s, true
		}
		if s, ok := v["data"].(string); ok && strings.TrimSpace(s) != "" {
			return s, true
		}
		return "", false
	default:
		return "", false
	}
}

func (p *markdownProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	if s, ok := extractPreferredText(input); ok {
		return []File{{
			Name:     "output.md",
			Kind:     "markdown",
			MimeType: "text/markdown; charset=utf-8",
			Bytes:    []byte(unwrapFencedBlock(s)),
		}}, nil
	}

	// 非文本时：用 JSON 包一层 codeblock，保证可读性
	b, err := json.MarshalIndent(input, "", "  ")
	if err != nil {
		return nil, err
	}
	md := fmt.Sprintf("```json\n%s\n```\n", string(b))
	return []File{{
		Name:     "output.md",
		Kind:     "markdown",
		MimeType: "text/markdown; charset=utf-8",
		Bytes:    []byte(md),
	}}, nil
}

type textProvider struct{}

func (p *textProvider) Name() string { return "text" }

func (p *textProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	if s, ok := extractPreferredText(input); ok {
		return []File{{
			Name:     "output.txt",
			Kind:     "text",
			MimeType: "text/plain; charset=utf-8",
			Bytes:    []byte(unwrapFencedBlock(s)),
		}}, nil
	}

	// 兜底：尽量用 JSON；JSON 失败再 fmt
	if b, err := json.MarshalIndent(input, "", "  "); err == nil {
		return []File{{
			Name:     "output.txt",
			Kind:     "text",
			MimeType: "text/plain; charset=utf-8",
			Bytes:    b,
		}}, nil
	}
	s := fmt.Sprintf("%v", input)
	return []File{{
		Name:     "output.txt",
		Kind:     "text",
		MimeType: "text/plain; charset=utf-8",
		Bytes:    []byte(s),
	}}, nil
}

package export

import (
	"encoding/json"
	"fmt"
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

func (p *markdownProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	switch v := input.(type) {
	case string:
		return []File{{
			Name:     "output.md",
			Kind:     "markdown",
			MimeType: "text/markdown; charset=utf-8",
			Bytes:    []byte(v),
		}}, nil
	default:
		// 非字符串时：用 JSON 包一层 codeblock，保证可读性
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
}

type textProvider struct{}

func (p *textProvider) Name() string { return "text" }

func (p *textProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	switch v := input.(type) {
	case string:
		return []File{{
			Name:     "output.txt",
			Kind:     "text",
			MimeType: "text/plain; charset=utf-8",
			Bytes:    []byte(v),
		}}, nil
	default:
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
}

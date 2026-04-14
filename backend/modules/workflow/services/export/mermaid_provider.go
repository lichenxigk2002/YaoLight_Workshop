package export

import (
	"fmt"
	"strings"
)

type mermaidProvider struct{}

func (p *mermaidProvider) Name() string { return "mermaid" }

func (p *mermaidProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	text, err := ToPrettyText(input)
	if err != nil {
		return nil, err
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, fmt.Errorf("mermaid 内容为空")
	}

	// 输出两份：
	// 1) 纯 mermaid 源文件（.mmd）
	// 2) 包含 ```mermaid fenced block 的 markdown（.md），方便站内预览/二次导出
	mmd := text
	md := fmt.Sprintf("```mermaid\n%s\n```\n", mmd)

	return []File{
		{
			Name:     "diagram.mmd",
			Kind:     "mermaid",
			MimeType: "text/plain; charset=utf-8",
			Bytes:    []byte(mmd),
		},
		{
			Name:     "diagram.md",
			Kind:     "markdown",
			MimeType: "text/markdown; charset=utf-8",
			Bytes:    []byte(md),
		},
	}, nil
}

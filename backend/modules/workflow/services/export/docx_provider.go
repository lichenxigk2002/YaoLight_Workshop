package export

import (
	"bytes"
	"fmt"
	"strings"

	"baliance.com/gooxml/document"
)

type docxProvider struct{}

func (p *docxProvider) Name() string { return "docx" }

func (p *docxProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	text, err := ToPrettyText(input)
	if err != nil {
		return nil, err
	}

	doc := document.New()

	// 简单按行输出为段落（最小可用版本）
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		para := doc.AddParagraph()
		run := para.AddRun()
		run.AddText(line)
	}

	var buf bytes.Buffer
	if err := doc.Save(&buf); err != nil {
		return nil, fmt.Errorf("生成DOCX失败: %w", err)
	}

	return []File{{
		Name:     "output.docx",
		Kind:     "docx",
		MimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
		Bytes:    buf.Bytes(),
	}}, nil
}

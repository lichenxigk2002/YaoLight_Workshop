package export

import (
	"bytes"
	"fmt"

	"github.com/jung-kurt/gofpdf/v2"
)

type pdfProvider struct{}

func (p *pdfProvider) Name() string { return "pdf" }

func (p *pdfProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	text, err := ToPrettyText(input)
	if err != nil {
		return nil, err
	}

	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.AddPage()

	// 使用内置字体（不保证中文完美显示；后续可扩展为加载本地 TTF）
	pdf.SetFont("Arial", "", 11)
	pdf.SetAutoPageBreak(true, 15)
	pdf.MultiCell(0, 5.5, text, "", "L", false)

	var buf bytes.Buffer
	if err := pdf.Output(&buf); err != nil {
		return nil, fmt.Errorf("生成PDF失败: %w", err)
	}

	return []File{{
		Name:     "output.pdf",
		Kind:     "pdf",
		MimeType: "application/pdf",
		Bytes:    buf.Bytes(),
	}}, nil
}

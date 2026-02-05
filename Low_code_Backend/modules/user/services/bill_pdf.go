package services

import (
	"bytes"
	"fmt"
	"strings"
	"time"
	"unicode"

	"github.com/jung-kurt/gofpdf/v2"
	userModels "yaolight-workshop/backend/modules/user/models"
)

// BillPDFUser 导出 PDF 所需的用户信息
type BillPDFUser struct {
	UserNo   int64
	Username string
}

// GenerateBillPDF 生成账单 PDF，返回 PDF 字节
func GenerateBillPDF(sum *BillSummary, transactions []userModels.TokenTransaction, user *BillPDFUser, generatedAt time.Time) ([]byte, error) {
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(15, 15, 15)
	pdf.SetAutoPageBreak(true, 15)
	pdf.AddPage()
	pdf.SetFont("Helvetica", "", 10)

	// Title
	pdf.SetFont("Helvetica", "B", 16)
	pdf.CellFormat(0, 10, "Stardust Bill", "", 0, "L", false, 0, "")
	pdf.Ln(12)

	periodLabel := periodLabel(sum.Period, sum.StartAt, sum.EndAt)
	pdf.SetFont("Helvetica", "", 11)
	pdf.CellFormat(0, 8, fmt.Sprintf("Period: %s", periodLabel), "", 0, "L", false, 0, "")
	pdf.Ln(6)
	pdf.CellFormat(0, 6, fmt.Sprintf("From %s to %s", sum.StartAt.Format("2006-01-02"), sum.EndAt.Format("2006-01-02")), "", 0, "L", false, 0, "")
	pdf.Ln(12)

	// User info
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(0, 6, "Account", "", 0, "L", false, 0, "")
	pdf.Ln(6)
	pdf.SetFont("Helvetica", "", 10)
	pdf.CellFormat(0, 6, fmt.Sprintf("User No: %d  |  Username: %s  |  Generated: %s", user.UserNo, user.Username, generatedAt.Format("2006-01-02 15:04:05")), "", 0, "L", false, 0, "")
	pdf.Ln(12)

	// Summary
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(0, 6, "Summary", "", 0, "L", false, 0, "")
	pdf.Ln(8)
	w := 190.0
	colW := w / 3
	pdf.SetFillColor(245, 245, 245)
	pdf.SetFont("Helvetica", "B", 9)
	pdf.CellFormat(colW, 8, "Income (Stardust)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colW, 8, "Expense (Stardust)", "1", 0, "C", true, 0, "")
	pdf.CellFormat(colW, 8, "Transaction Count", "1", 1, "C", true, 0, "")
	pdf.SetFont("Helvetica", "", 9)
	pdf.CellFormat(colW, 8, fmt.Sprintf("+%s", formatInt64(sum.TotalIncome)), "1", 0, "C", false, 0, "")
	pdf.CellFormat(colW, 8, fmt.Sprintf("-%s", formatInt64(sum.TotalExpense)), "1", 0, "C", false, 0, "")
	pdf.CellFormat(colW, 8, formatInt64(sum.TransactionCount), "1", 1, "C", false, 0, "")
	pdf.Ln(12)

	// Transactions
	pdf.SetFont("Helvetica", "B", 10)
	pdf.CellFormat(0, 6, "Transaction Details", "", 0, "L", false, 0, "")
	pdf.Ln(8)

	colTime := 38.0
	colDesc := 75.0
	colAmount := 35.0
	colCost := 42.0
	pdf.SetFont("Helvetica", "B", 8)
	pdf.CellFormat(colTime, 7, "Time", "1", 0, "L", true, 0, "")
	pdf.CellFormat(colDesc, 7, "Description", "1", 0, "L", true, 0, "")
	pdf.CellFormat(colAmount, 7, "Amount", "1", 0, "R", true, 0, "")
	pdf.CellFormat(colCost, 7, "Cost", "1", 1, "R", true, 0, "")
	pdf.SetFont("Helvetica", "", 8)
	for _, tx := range transactions {
		desc := pdfSafeDescription(&tx)
		if len(desc) > 40 {
			desc = desc[:37] + "..."
		}
		amountStr := fmt.Sprintf("%+d", tx.Amount)
		costStr := "-"
		if tx.Cost != 0 && tx.Currency != "" {
			costStr = fmt.Sprintf("%.4f %s", tx.Cost, tx.Currency)
		}
		pdf.CellFormat(colTime, 6, tx.CreatedAt.Format("2006-01-02 15:04"), "1", 0, "L", false, 0, "")
		pdf.CellFormat(colDesc, 6, desc, "1", 0, "L", false, 0, "")
		pdf.CellFormat(colAmount, 6, amountStr, "1", 0, "R", false, 0, "")
		pdf.CellFormat(colCost, 6, costStr, "1", 1, "R", false, 0, "")
	}
	pdf.Ln(10)

	// Footer note
	pdf.SetFont("Helvetica", "I", 8)
	pdf.SetTextColor(128, 128, 128)
	pdf.CellFormat(0, 6, "This bill is generated automatically for your reference only.", "", 0, "L", false, 0, "")
	pdf.Ln(6)
	pdf.CellFormat(0, 6, "Stardust is the in-platform resource used for AI model token consumption.", "", 0, "L", false, 0, "")

	var buf bytes.Buffer
	err := pdf.Output(&buf)
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// pdfSafeDescription 返回仅含 ASCII 的说明，避免 PDF 使用 Helvetica 时中文乱码
func pdfSafeDescription(tx *userModels.TokenTransaction) string {
	desc := tx.Description
	if desc == "" {
		desc = tx.Type
	}
	if isASCII(desc) {
		return desc
	}
	// 按类型映射为英文并带上具体模型，避免乱码
	modelPart := buildModelPart(tx.Provider, tx.ModelName)
	switch tx.Type {
	case "consumption":
		if modelPart != "" {
			return "AI consumption (" + modelPart + ")"
		}
		return "AI consumption (system model)"
	case "usage_record":
		if modelPart != "" {
			return "Usage record (" + modelPart + ", own API Key)"
		}
		return "Usage record (own API Key)"
	case "bonus":
		return "Bonus (e.g. sign-up)"
	default:
		if modelPart != "" {
			return modelPart
		}
		return tx.Type
	}
}

// buildModelPart 返回仅 ASCII 的 provider/model 组合，供 PDF 使用
func buildModelPart(provider, modelName string) string {
	p, m := strings.TrimSpace(provider), strings.TrimSpace(modelName)
	if p == "" && m == "" {
		return ""
	}
	if p != "" && m != "" {
		return p + " / " + m
	}
	if p != "" {
		return p
	}
	return m
}

func isASCII(s string) bool {
	for _, r := range s {
		if r > unicode.MaxASCII {
			return false
		}
	}
	return true
}

func periodLabel(period string, start, end time.Time) string {
	switch period {
	case "day":
		return start.Format("2006-01-02")
	case "month":
		return start.Format("2006-01")
	case "quarter":
		y := start.Year()
		m := int(start.Month())
		q := (m-1)/3 + 1
		return fmt.Sprintf("%d-Q%d", y, q)
	case "year":
		return start.Format("2006")
	default:
		return start.Format("2006-01-02") + " ~ " + end.Format("2006-01-02")
	}
}

func formatInt64(n int64) string {
	s := fmt.Sprintf("%d", n)
	if n < 0 {
		s = s[1:]
	}
	var b []byte
	for i := 0; i < len(s); i++ {
		if i > 0 && (len(s)-i)%3 == 0 {
			b = append(b, ',')
		}
		b = append(b, s[i])
	}
	if n < 0 {
		return "-" + string(b)
	}
	return string(b)
}

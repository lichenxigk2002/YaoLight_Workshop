package email

import (
	"bytes"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"mime"
	"net/smtp"
	"os"
	"path/filepath"
	"strings"

	"yaolight-workshop/backend/infrastructure/logx"
)

type EmailService struct {
	host     string
	port     string
	username string
	password string
	from     string
}

type Attachment struct {
	Filename string
	MimeType string
	Data     []byte
}

func NewEmailService() *EmailService {
	return &EmailService{
		host:     getEnv("TENCENT_CLOUD_MAIL_HOST", "gz-smtp.qcloudmail.com"),
		port:     getEnv("TENCENT_CLOUD_MAIL_PORT", "465"),
		username: os.Getenv("TENCENT_CLOUD_MAIL_USERNAME"),
		password: os.Getenv("TENCENT_CLOUD_MAIL_PASSWORD"),
		from:     os.Getenv("TENCENT_CLOUD_MAIL_USERNAME"),
	}
}

func (s *EmailService) SendVerificationCode(to string, code string) error {
	subject := "【瑶光工坊】验证码"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: #000000; color: #ffffff; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
        .content { padding: 40px 30px; }
        .code-box { background: #f5f5f7; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
        .code { font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #000000; }
        .footer { background: #f5f5f7; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        p { line-height: 1.6; color: #333; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>验证码确认</h1>
        </div>
        <div class="content">
            <p>您好，</p>
            <p>您正在使用邮箱验证码登录瑶光工坊。您的验证码是：</p>
            <div class="code-box">
                <div class="code">%s</div>
            </div>
            <p><strong>验证码有效期为 5 分钟</strong>，请尽快使用。</p>
            <p>如果这不是您的操作，请忽略此邮件。</p>
        </div>
        <div class="footer">
            <p>© 2026 瑶光工坊 YaoLight Workshop. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, code)

	return s.SendHTML(to, subject, body)
}

func (s *EmailService) SendHTML(to, subject, body string) error {
	if s.username == "" || s.password == "" {
		return fmt.Errorf("邮件服务未配置，请设置环境变量 TENCENT_CLOUD_MAIL_USERNAME 和 TENCENT_CLOUD_MAIL_PASSWORD")
	}

	message := []byte(fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: %s\r\n"+
			"MIME-Version: 1.0\r\n"+
			"Content-Type: text/html; charset=UTF-8\r\n"+
			"\r\n"+
			"%s",
		s.from, to, subject, body,
	))

	return s.sendRaw(to, message)
}

func (s *EmailService) SendPlain(to, subject, body string) error {
	if s.username == "" || s.password == "" {
		return fmt.Errorf("邮件服务未配置")
	}

	message := []byte(fmt.Sprintf(
		"From: %s\r\n"+
			"To: %s\r\n"+
			"Subject: %s\r\n"+
			"\r\n"+
			"%s",
		s.from, to, subject, body,
	))

	return s.sendRaw(to, message)
}

func (s *EmailService) SendWithAttachments(to, subject, body string, attachments []Attachment) error {
	if s.username == "" || s.password == "" {
		return fmt.Errorf("邮件服务未配置")
	}

	isTencentSES := s.isTencentSES()
	preparedAttachments := make([]Attachment, 0, len(attachments))
	attachmentLog := make([]map[string]any, 0, len(attachments))
	usedNames := make(map[string]int)
	for index, att := range attachments {
		prepared := att
		if isTencentSES {
			prepared.Filename = sanitizeTencentAttachmentFilename(att.Filename, att.MimeType, index+1)
			prepared.Filename = dedupeAttachmentFilename(prepared.Filename, usedNames)
		}
		preparedAttachments = append(preparedAttachments, prepared)
		attachmentLog = append(attachmentLog, map[string]any{
			"original_filename": att.Filename,
			"send_filename":     prepared.Filename,
			"mime_type":         prepared.MimeType,
			"size":              len(prepared.Data),
		})
	}

	logx.WithContext(logx.LevelInfo, 7001, "准备发送附件邮件", map[string]any{
		"to":               redactEmailList(to),
		"host":             s.host,
		"subject":          subject,
		"attachment_count": len(preparedAttachments),
		"attachments":      attachmentLog,
		"tencent_ses":      isTencentSES,
	})

	boundary := s.randomBoundary()

	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("From: %s\r\n", s.from))
	buf.WriteString(fmt.Sprintf("To: %s\r\n", to))
	buf.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	buf.WriteString("MIME-Version: 1.0\r\n")
	buf.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=%q\r\n", boundary))
	buf.WriteString("\r\n")

	buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	buf.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	buf.WriteString("Content-Transfer-Encoding: base64\r\n")
	buf.WriteString("\r\n")
	buf.WriteString(encodeBase64(body))
	buf.WriteString("\r\n")

	for _, att := range preparedAttachments {
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		mt := att.MimeType
		if strings.TrimSpace(mt) == "" {
			mt = "application/octet-stream"
		}

		if isTencentSES {
			buf.WriteString(fmt.Sprintf("Content-Type: %s; name=\"%s\"\r\n", mt, att.Filename))
			buf.WriteString("Content-Transfer-Encoding: base64\r\n")
			buf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n", att.Filename))
		} else {
			encodedFilename := mime.BEncoding.Encode("UTF-8", att.Filename)
			buf.WriteString(fmt.Sprintf("Content-Type: %s; name=\"%s\"\r\n", mt, encodedFilename))
			buf.WriteString("Content-Transfer-Encoding: base64\r\n")
			buf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n", encodedFilename))
		}
		buf.WriteString("\r\n")
		buf.WriteString(encodeBase64Bytes(att.Data))
		buf.WriteString("\r\n")
	}

	buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	if err := s.sendRaw(to, buf.Bytes()); err != nil {
		logx.WithContext(logx.LevelError, 7002, "附件邮件发送失败", map[string]any{
			"to":               redactEmailList(to),
			"host":             s.host,
			"subject":          subject,
			"attachment_count": len(preparedAttachments),
			"attachments":      attachmentLog,
			"error":            err.Error(),
		})
		return err
	}

	logx.WithContext(logx.LevelInfo, 7003, "附件邮件发送成功", map[string]any{
		"to":               redactEmailList(to),
		"host":             s.host,
		"subject":          subject,
		"attachment_count": len(preparedAttachments),
		"attachments":      attachmentLog,
	})
	return nil
}

func (s *EmailService) sendRaw(to string, message []byte) error {
	auth := smtp.PlainAuth("", s.username, s.password, s.host)
	addr := fmt.Sprintf("%s:%s", s.host, s.port)

	tlsConfig := &tls.Config{
		ServerName:         s.host,
		InsecureSkipVerify: false,
	}

	conn, err := tls.Dial("tcp", addr, tlsConfig)
	if err != nil {
		return fmt.Errorf("连接邮件服务器失败: %v", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("创建SMTP客户端失败: %v", err)
	}
	defer client.Quit()

	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("邮件认证失败: %v", err)
	}

	if err := client.Mail(s.from); err != nil {
		return fmt.Errorf("设置发件人失败: %v", err)
	}

	recipients := strings.Split(to, ",")
	for _, r := range recipients {
		addrStr := strings.TrimSpace(r)
		if addrStr == "" {
			continue
		}
		if err := client.Rcpt(addrStr); err != nil {
			return fmt.Errorf("设置收件人失败: %v", err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("准备发送邮件失败: %v", err)
	}

	if _, err := w.Write(message); err != nil {
		return fmt.Errorf("写入邮件内容失败: %v", err)
	}

	if err := w.Close(); err != nil {
		return fmt.Errorf("关闭邮件写入失败: %v", err)
	}

	return nil
}

func (s *EmailService) randomBoundary() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "mixed-boundary"
	}
	return "mixed-" + hex.EncodeToString(b)
}

func (s *EmailService) isTencentSES() bool {
	host := strings.ToLower(strings.TrimSpace(s.host))
	return strings.Contains(host, "qcloud") || strings.Contains(host, "tencent")
}

func sanitizeTencentAttachmentFilename(filename, mimeType string, index int) string {
	base := strings.TrimSpace(filepath.Base(filename))
	if base == "" || base == "." || base == string(filepath.Separator) {
		base = fmt.Sprintf("attachment_%d", index)
	}

	ext := strings.ToLower(filepath.Ext(base))
	if !isSafeExtension(ext) {
		ext = extensionForMimeType(mimeType)
	}

	stem := strings.TrimSuffix(base, filepath.Ext(base))
	stem = sanitizeASCIINamePart(stem)
	if stem == "" {
		stem = fmt.Sprintf("attachment_%d", index)
	}
	if len(stem) > 64 {
		stem = strings.Trim(stem[:64], "._-")
		if stem == "" {
			stem = fmt.Sprintf("attachment_%d", index)
		}
	}
	return stem + ext
}

func sanitizeASCIINamePart(value string) string {
	var b strings.Builder
	lastUnderscore := false
	for _, r := range value {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b.WriteRune(r)
			lastUnderscore = false
		case r == '-' || r == '.':
			b.WriteRune(r)
			lastUnderscore = false
		case r == '_' || r == ' ':
			if !lastUnderscore {
				b.WriteByte('_')
				lastUnderscore = true
			}
		default:
			if !lastUnderscore {
				b.WriteByte('_')
				lastUnderscore = true
			}
		}
	}
	return strings.Trim(b.String(), "._-")
}

func isSafeExtension(ext string) bool {
	if len(ext) < 2 || len(ext) > 12 || ext[0] != '.' {
		return false
	}
	for _, r := range ext[1:] {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9') {
			return false
		}
	}
	return true
}

func extensionForMimeType(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0])) {
	case "application/pdf":
		return ".pdf"
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return ".docx"
	case "application/json":
		return ".json"
	case "text/markdown":
		return ".md"
	case "text/plain":
		return ".txt"
	case "text/html":
		return ".html"
	case "image/svg+xml":
		return ".svg"
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "text/csv":
		return ".csv"
	default:
		return ".bin"
	}
}

func dedupeAttachmentFilename(filename string, used map[string]int) string {
	key := strings.ToLower(filename)
	count := used[key]
	used[key] = count + 1
	if count == 0 {
		return filename
	}
	ext := filepath.Ext(filename)
	stem := strings.TrimSuffix(filename, ext)
	if stem == "" {
		stem = "attachment"
	}
	return fmt.Sprintf("%s_%d%s", stem, count+1, ext)
}

func redactEmailList(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		email := strings.TrimSpace(part)
		if email == "" {
			continue
		}
		result = append(result, redactEmail(email))
	}
	return result
}

func redactEmail(value string) string {
	parts := strings.SplitN(value, "@", 2)
	if len(parts) != 2 {
		return "***"
	}
	local := parts[0]
	if len(local) == 0 {
		return "***@" + parts[1]
	}
	if len(local) <= 2 {
		return local[:1] + "***@" + parts[1]
	}
	return local[:2] + "***@" + parts[1]
}

func encodeBase64(s string) string {
	return encodeBase64Bytes([]byte(s))
}

func encodeBase64Bytes(b []byte) string {
	enc := base64.StdEncoding.EncodeToString(b)
	var buf strings.Builder
	for i := 0; i < len(enc); i += 76 {
		end := i + 76
		if end > len(enc) {
			end = len(enc)
		}
		buf.WriteString(enc[i:end])
		buf.WriteString("\r\n")
	}
	return buf.String()
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

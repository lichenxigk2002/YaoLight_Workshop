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
	"strings"
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

	for _, att := range attachments {
		buf.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		mt := att.MimeType
		if strings.TrimSpace(mt) == "" {
			mt = "application/octet-stream"
		}

		encodedFilename := mime.BEncoding.Encode("UTF-8", att.Filename)
		buf.WriteString(fmt.Sprintf("Content-Type: %s; name=\"%s\"\r\n", mt, encodedFilename))
		buf.WriteString("Content-Transfer-Encoding: base64\r\n")
		buf.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n", encodedFilename))
		buf.WriteString("\r\n")
		buf.WriteString(encodeBase64Bytes(att.Data))
		buf.WriteString("\r\n")
	}

	buf.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	return s.sendRaw(to, buf.Bytes())
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

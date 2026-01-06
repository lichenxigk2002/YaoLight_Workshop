package email

import (
	"crypto/tls"
	"fmt"
	"net/smtp"
	"os"
	"strings"
)

// EmailService 邮件服务
type EmailService struct {
	host     string
	port     string
	username string
	password string
	from     string
}

// NewEmailService 创建邮件服务
func NewEmailService() *EmailService {
	return &EmailService{
		host:     getEnv("TENCENT_CLOUD_MAIL_HOST", "gz-smtp.qcloudmail.com"),
		port:     getEnv("TENCENT_CLOUD_MAIL_PORT", "465"),
		username: os.Getenv("TENCENT_CLOUD_MAIL_USERNAME"),
		password: os.Getenv("TENCENT_CLOUD_MAIL_PASSWORD"),
		from:     os.Getenv("TENCENT_CLOUD_MAIL_USERNAME"),
	}
}

// SendVerificationCode 发送验证码邮件
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

// SendHTML 发送HTML邮件
func (s *EmailService) SendHTML(to, subject, body string) error {
	if s.username == "" || s.password == "" {
		return fmt.Errorf("邮件服务未配置，请设置环境变量 TENCENT_CLOUD_MAIL_USERNAME 和 TENCENT_CLOUD_MAIL_PASSWORD")
	}

	// 构建邮件内容
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

	// 使用 SSL/TLS 连接
	auth := smtp.PlainAuth("", s.username, s.password, s.host)

	// 建立 TLS 连接
	tlsConfig := &tls.Config{
		ServerName:         s.host,
		InsecureSkipVerify: false,
	}

	addr := fmt.Sprintf("%s:%s", s.host, s.port)
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

	// 认证
	if err := client.Auth(auth); err != nil {
		return fmt.Errorf("邮件认证失败: %v", err)
	}

	// 设置发件人
	if err := client.Mail(s.from); err != nil {
		return fmt.Errorf("设置发件人失败: %v", err)
	}

	// 设置收件人
	if err := client.Rcpt(to); err != nil {
		return fmt.Errorf("设置收件人失败: %v", err)
	}

	// 发送邮件内容
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("准备发送邮件失败: %v", err)
	}

	_, err = w.Write(message)
	if err != nil {
		return fmt.Errorf("写入邮件内容失败: %v", err)
	}

	err = w.Close()
	if err != nil {
		return fmt.Errorf("关闭邮件写入失败: %v", err)
	}

	return nil
}

// SendPlain 发送纯文本邮件
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

	auth := smtp.PlainAuth("", s.username, s.password, s.host)
	addr := fmt.Sprintf("%s:%s", s.host, s.port)

	err := smtp.SendMail(addr, auth, s.from, strings.Split(to, ","), message)
	if err != nil {
		return fmt.Errorf("发送邮件失败: %v", err)
	}

	return nil
}

// getEnv 获取环境变量，如果不存在则返回默认值
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}

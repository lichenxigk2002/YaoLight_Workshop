package controllers

import (
	"net/http"
	"net/mail"
	"strings"

	"github.com/gin-gonic/gin"

	"yaolight-workshop/backend/infrastructure/email"
	"yaolight-workshop/backend/infrastructure/logx"
)

type AdminEmailDebugController struct{}

type adminEmailDebugRequest struct {
	To                string `json:"to" binding:"required"`
	Subject           string `json:"subject"`
	Body              string `json:"body"`
	AttachmentName    string `json:"attachment_name"`
	AttachmentContent string `json:"attachment_content"`
}

func NewAdminEmailDebugController() *AdminEmailDebugController {
	return &AdminEmailDebugController{}
}

func (c *AdminEmailDebugController) SendTestEmail(ctx *gin.Context) {
	var req adminEmailDebugRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		adminOperationLogBadRequest(ctx, "invalid request")
		return
	}

	to := strings.TrimSpace(req.To)
	if _, err := mail.ParseAddress(to); err != nil {
		adminOperationLogBadRequest(ctx, "invalid email address")
		return
	}

	subject := strings.TrimSpace(req.Subject)
	if subject == "" {
		subject = "瑶光工坊邮件发送调试"
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		body = "这是一封后台邮件调试消息，用于验证 SMTP 配置、附件名兼容性和腾讯云 SES 投递链路。"
	}
	attachmentName := strings.TrimSpace(req.AttachmentName)
	if attachmentName == "" {
		attachmentName = "测试附件-中文(1).txt"
	}
	attachmentContent := req.AttachmentContent
	if attachmentContent == "" {
		attachmentContent = "YaoLight Workshop email debug attachment.\n"
	}

	attachment := email.Attachment{
		Filename: attachmentName,
		MimeType: "text/plain",
		Data:     []byte(attachmentContent),
	}

	logx.WithContext(logx.LevelInfo, 7004, "后台触发邮件发送调试", map[string]any{
		"to":              to,
		"subject":         subject,
		"attachment_name": attachmentName,
		"attachment_size": len(attachment.Data),
		"client_ip":       ctx.ClientIP(),
	})

	if err := email.SendWorkflowOutputEmail(to, subject, "邮件发送调试", body, []email.Attachment{attachment}); err != nil {
		logx.WithContext(logx.LevelError, 7005, "后台邮件发送调试失败", map[string]any{
			"to":              to,
			"subject":         subject,
			"attachment_name": attachmentName,
			"attachment_size": len(attachment.Data),
			"error":           err.Error(),
			"client_ip":       ctx.ClientIP(),
		})
		ctx.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	logx.WithContext(logx.LevelInfo, 7006, "后台邮件发送调试成功", map[string]any{
		"to":              to,
		"subject":         subject,
		"attachment_name": attachmentName,
		"attachment_size": len(attachment.Data),
		"client_ip":       ctx.ClientIP(),
	})

	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": "sent",
		"data": gin.H{
			"to":              to,
			"subject":         subject,
			"attachment_name": attachmentName,
		},
	})
}

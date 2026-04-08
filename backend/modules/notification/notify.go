package notification

import (
	"yaolight-workshop/backend/infrastructure/database"
	userModels "yaolight-workshop/backend/modules/user/models"
	"yaolight-workshop/backend/modules/notification/services"
)

// DefaultService 供其他模块调用的通知服务单例，由 main 在启动时设置
var DefaultService *services.NotificationService

// SetDefaultService 设置默认通知服务（main 启动时调用）
func SetDefaultService(s *services.NotificationService) {
	DefaultService = s
}

// isNotificationEnabled 检查用户是否开启了该类型通知（未设置则默认开启）
func isNotificationEnabled(userID uint, typ string) bool {
	var user userModels.User
	if err := database.DB.Select("id", "preferences").First(&user, userID).Error; err != nil {
		return true
	}
	if user.Preferences.Data == nil {
		return true
	}
	prefs, ok := user.Preferences.Data.(map[string]interface{})
	if !ok {
		return true
	}
	notifications, ok := prefs["notifications"].(map[string]interface{})
	if !ok {
		return true
	}
	v, ok := notifications[typ]
	if !ok {
		return true
	}
	enabled, _ := v.(bool)
	return enabled
}

// Notify 便捷方法：需要通知用户时调用（如任务完成、支付成功）
// 会检查用户通知偏好，未关闭则落库并实时通过 WebSocket 推送给该用户
func Notify(userID uint, typ, title, content, actionURL string) {
	if DefaultService == nil {
		return
	}
	if !isNotificationEnabled(userID, typ) {
		return
	}
	var contentPtr, actionPtr *string
	if content != "" {
		contentPtr = &content
	}
	if actionURL != "" {
		actionPtr = &actionURL
	}
	_, _ = DefaultService.CreateAndNotify(services.CreateAndNotifyInput{
		UserID:    userID,
		Type:      typ,
		Title:     title,
		Content:   contentPtr,
		ActionURL: actionPtr,
	})
}

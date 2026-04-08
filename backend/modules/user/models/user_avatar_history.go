package models

import (
	"time"

	"gorm.io/gorm"
)

// UserAvatarHistory 用户头像历史（支持像 QQ 一样查看/重新应用/删除）
type UserAvatarHistory struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"index;not null" json:"user_id"`
	AvatarURL string         `gorm:"type:varchar(512);not null" json:"avatar_url"` // 相对路径或完整 URL
	CreatedAt time.Time      `json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (UserAvatarHistory) TableName() string {
	return "user_avatar_history"
}

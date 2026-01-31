package models

import "gorm.io/gorm"

// UserOAuthBinding 用户与第三方账号绑定（一个用户可同时绑定 GitHub 和 Google）
type UserOAuthBinding struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"uniqueIndex:idx_user_provider;not null" json:"user_id"`
	Provider  string         `gorm:"uniqueIndex:idx_user_provider;type:varchar(20);not null" json:"provider"` // github, google
	OAuthID   string         `gorm:"column:oauth_id;type:varchar(100);not null" json:"-"`
	CreatedAt int64          `gorm:"autoCreateTime" json:"created_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (UserOAuthBinding) TableName() string {
	return "user_oauth_bindings"
}

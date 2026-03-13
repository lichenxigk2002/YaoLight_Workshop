package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// User 用户持久化实体
type User struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserNo        int64          `gorm:"column:user_no" json:"user_no"` // 随机用户编号，用于展示与存储路径；唯一约束在 EnsureUsersUserNo 中回填后创建
	Username      string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"username"`
	Email         string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"email"`
	Password      string         `gorm:"type:varchar(255);not null" json:"-"`
	Phone         *string        `gorm:"type:varchar(20);index" json:"phone"`
	RealName      *string        `gorm:"type:varchar(100)" json:"real_name"`
	AvatarURL     *string        `gorm:"type:varchar(255)" json:"avatar_url"`
	Role          string         `gorm:"type:varchar(20);default:'user';check:role IN ('admin','user')" json:"role"`
	Status        string         `gorm:"type:varchar(20);default:'active';check:status IN ('active','inactive','suspended')" json:"status"`
	LastLoginAt   *time.Time     `json:"last_login_at"`
	LastLoginIP   *string        `gorm:"type:varchar(45)" json:"last_login_ip"`
	LoginCount    int            `gorm:"default:0" json:"login_count"`
	TokenBalance  int64          `gorm:"default:2000000" json:"token_balance"` // 用户Token余额，注册赠送200万星尘
	InviterID     *uint          `gorm:"index" json:"inviter_id"`               // 邀请人ID（通过邀请链接注册时填写）
	OAuthProvider string         `gorm:"type:varchar(20);index" json:"-"`      // google, github
	OAuthID       *string        `gorm:"type:varchar(100);index" json:"-"`
	HasPassword   bool           `gorm:"-" json:"has_password"`                // 是否已设置密码（仅 API 返回，不存库）
	Permissions   []string       `gorm:"-" json:"permissions,omitempty"`
	Preferences   shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"preferences"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (User) TableName() string {
	return "users"
}

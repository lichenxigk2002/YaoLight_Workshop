package entity

import "time"

// User 用户领域实体（纯业务对象，不依赖 GORM）
type User struct {
	ID            uint
	UserNo        int64 // 随机用户编号，用于展示与存储路径
	Username      string
	Email         string
	Password      string
	Phone         *string
	RealName      *string
	AvatarURL     *string
	Role          string
	Status        string
	LastLoginAt   *time.Time
	LastLoginIP   *string
	LoginCount    int
	TokenBalance  int64
	InviterID     *uint   // 邀请人ID
	OAuthProvider string  // 第三方登录来源：google, github，空表示非 OAuth
	OAuthID       *string // 第三方平台用户 ID
	CreatedAt     time.Time
	UpdatedAt     time.Time
}

// IsActive 检查用户是否激活
func (u *User) IsActive() bool {
	return u.Status == "active"
}

// IsAdmin 检查用户是否为管理员
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}

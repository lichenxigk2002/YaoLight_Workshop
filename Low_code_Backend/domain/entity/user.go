package entity

import "time"

// User 用户领域实体（纯业务对象，不依赖 GORM）
type User struct {
	ID           uint
	Username     string
	Email        string
	Password     string
	Phone        *string
	RealName     *string
	AvatarURL    *string
	Role         string
	Status       string
	LastLoginAt  *time.Time
	LastLoginIP  *string
	LoginCount   int
	TokenBalance int64
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

// IsActive 检查用户是否激活
func (u *User) IsActive() bool {
	return u.Status == "active"
}

// IsAdmin 检查用户是否为管理员
func (u *User) IsAdmin() bool {
	return u.Role == "admin"
}

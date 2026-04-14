package models

import (
	"time"
)

// UserInviteCode 用户邀请码（每个用户一个唯一码）
type UserInviteCode struct {
	UserID    uint      `gorm:"primaryKey" json:"user_id"`
	Code      string    `gorm:"type:varchar(32);uniqueIndex;not null" json:"code"`
	CreatedAt time.Time `json:"created_at"`
}

func (UserInviteCode) TableName() string {
	return "user_invite_codes"
}

// UserInvitation 邀请记录（邀请人-被邀请人关系）
type UserInvitation struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	InviterID  uint      `gorm:"index;not null" json:"inviter_id"`
	InviteeID  uint      `gorm:"index;not null" json:"invitee_id"`
	InviteCode string    `gorm:"type:varchar(32)" json:"invite_code"`
	CreatedAt  time.Time `json:"created_at"`
}

func (UserInvitation) TableName() string {
	return "user_invitations"
}

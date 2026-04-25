package models

import (
	"time"

	"gorm.io/gorm"
)

type ResourceLike struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ResourceType string         `gorm:"type:varchar(80);not null;index" json:"resourceType"`
	ResourceID   uint           `gorm:"not null;index" json:"resourceId"`
	UserID       uint           `gorm:"not null;index" json:"userId"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ResourceLike) TableName() string {
	return "resource_likes"
}

type ResourceComment struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	ResourceType     string         `gorm:"type:varchar(80);not null;index" json:"resourceType"`
	ResourceID       uint           `gorm:"not null;index" json:"resourceId"`
	ParentID         *uint          `gorm:"index" json:"parentId,omitempty"`
	UserID           uint           `gorm:"not null;index" json:"userId"`
	Content          string         `gorm:"type:text;not null" json:"content"`
	Status           string         `gorm:"type:varchar(20);not null;default:'visible';index" json:"status"`
	Location         *string        `gorm:"type:varchar(120)" json:"location,omitempty"`
	DeviceModel      *string        `gorm:"type:varchar(160)" json:"deviceModel,omitempty"`
	UserAgent        *string        `gorm:"type:text" json:"userAgent,omitempty"`
	ModerationReason *string        `gorm:"type:text" json:"moderationReason,omitempty"`
	ModeratedBy      *uint          `gorm:"index" json:"moderatedBy,omitempty"`
	ModeratedAt      *time.Time     `json:"moderatedAt,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (ResourceComment) TableName() string {
	return "resource_comments"
}

type CommentReaction struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CommentID uint           `gorm:"not null;index" json:"commentId"`
	UserID    uint           `gorm:"not null;index" json:"userId"`
	Emoji     string         `gorm:"type:varchar(32);not null" json:"emoji"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

func (CommentReaction) TableName() string {
	return "comment_reactions"
}

package models

import "time"

type Permission struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	ResourceKey string    `gorm:"type:varchar(150);not null;uniqueIndex:idx_permissions_resource_action" json:"resource_key"`
	Action      string    `gorm:"type:varchar(20);not null;uniqueIndex:idx_permissions_resource_action;check:action IN ('view','edit')" json:"action"`
	Description *string   `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (Permission) TableName() string {
	return "permissions"
}

package models

import (
	"time"
)

// TokenTransaction Token交易记录
type TokenTransaction struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	UserID           uint      `gorm:"index;not null" json:"user_id"`
	Amount           int64     `gorm:"not null" json:"amount"`
	Type             string    `gorm:"type:varchar(50);not null" json:"type"`
	RelatedID        string    `gorm:"type:varchar(100)" json:"related_id"`
	Description      string    `gorm:"type:varchar(255)" json:"description"`
	Provider         string    `gorm:"type:varchar(50);index" json:"provider"`
	ModelName        string    `gorm:"type:varchar(100);index" json:"model_name"`
	ModelMode        string    `gorm:"type:varchar(20)" json:"model_mode"`
	ModelID          *uint     `gorm:"index" json:"model_id"`
	PromptTokens     int       `gorm:"default:0" json:"prompt_tokens"`
	CompletionTokens int       `gorm:"default:0" json:"completion_tokens"`
	TotalTokens      int       `gorm:"default:0" json:"total_tokens"`
	CacheReadTokens  int       `gorm:"default:0" json:"cache_read_tokens"`
	CacheWriteTokens int       `gorm:"default:0" json:"cache_write_tokens"`
	AudioTokens      int       `gorm:"default:0" json:"audio_tokens"`
	Cost             float64   `gorm:"type:decimal(12,6);default:0" json:"cost"`
	Currency         string    `gorm:"type:varchar(10);default:'USD'" json:"currency"`
	CreatedAt        time.Time `json:"created_at"`
}

// TableName 指定表名
func (TokenTransaction) TableName() string {
	return "token_transactions"
}

package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// CrawlerRule 爬虫规则持久化实体
type CrawlerRule struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	Name              string         `gorm:"type:varchar(200);not null;index" json:"name"`
	Description       *string        `gorm:"type:text" json:"description"`
	Version           string         `gorm:"type:varchar(20);default:'1.0.0'" json:"version"`
	URLPattern        *string        `gorm:"type:varchar(500)" json:"url_pattern"`
	URLPatternType    string         `gorm:"type:varchar(20);default:'regex';check:url_pattern_type IN ('regex','glob','exact')" json:"url_pattern_type"`
	Method            string         `gorm:"type:varchar(10);default:'GET';check:method IN ('GET','POST','PUT','DELETE','PATCH')" json:"method"`
	Headers           shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"headers"`
	Params            shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"params"`
	Body              *shared.JSONB  `gorm:"type:jsonb" json:"body"`
	Selectors         shared.JSONB   `gorm:"type:jsonb;default:'{}'" json:"selectors"`
	DataExtraction    *shared.JSONB  `gorm:"type:jsonb" json:"data_extraction"`
	Pagination        *shared.JSONB  `gorm:"type:jsonb" json:"pagination"`
	ProxyConfig       *shared.JSONB  `gorm:"type:jsonb" json:"proxy_config"`
	Cookies           *shared.JSONB  `gorm:"type:jsonb" json:"cookies"`
	Timeout           int            `gorm:"default:30" json:"timeout"`
	RetryCount        int            `gorm:"default:3" json:"retry_count"`
	RetryDelay        int            `gorm:"default:1" json:"retry_delay"`
	UserAgent         *string        `gorm:"type:varchar(255)" json:"user_agent"`
	FollowRedirects   bool           `gorm:"default:true" json:"follow_redirects"`
	VerifySSL         bool           `gorm:"default:true" json:"verify_ssl"`
	WaitTime          int            `gorm:"default:0" json:"wait_time"`
	JavaScriptEnabled bool           `gorm:"default:false" json:"javascript_enabled"`
	Screenshot        bool           `gorm:"default:false" json:"screenshot"`
	IsActive          bool           `gorm:"default:true;index" json:"is_active"`
	UsageCount        int            `gorm:"default:0" json:"usage_count"`
	SuccessRate       *float64       `gorm:"type:decimal(5,2)" json:"success_rate"`
	CreatedBy         *uint          `gorm:"index" json:"created_by"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (CrawlerRule) TableName() string {
	return "crawler_rules"
}

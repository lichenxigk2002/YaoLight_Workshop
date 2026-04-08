package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// SystemConfig 系统配置持久化实体
type SystemConfig struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Key         string         `gorm:"type:varchar(100);uniqueIndex;not null" json:"key"`
	Value       shared.JSONB   `gorm:"type:jsonb;not null" json:"value"`
	Description *string        `gorm:"type:text" json:"description"`
	Category    *string        `gorm:"type:varchar(50);index" json:"category"`
	IsPublic    bool           `gorm:"default:false" json:"is_public"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (SystemConfig) TableName() string {
	return "system_configs"
}

// OperationLog 操作日志持久化实体
type OperationLog struct {
	ID           uint          `gorm:"primaryKey" json:"id"`
	UserID       *uint         `gorm:"index" json:"user_id"`
	Action       string        `gorm:"type:varchar(50);not null;index" json:"action"`
	ResourceType string        `gorm:"type:varchar(50);not null;index" json:"resource_type"`
	ResourceID   *uint         `gorm:"index" json:"resource_id"`
	IPAddress    *string       `gorm:"type:varchar(45)" json:"ip_address"`
	UserAgent    *string       `gorm:"type:text" json:"user_agent"`
	RequestData  *shared.JSONB `gorm:"type:jsonb" json:"request_data"`
	ResponseData *shared.JSONB `gorm:"type:jsonb" json:"response_data"`
	StatusCode   *int          `json:"status_code"`
	ErrorMessage *string       `gorm:"type:text" json:"error_message"`
	CreatedAt    time.Time     `gorm:"index" json:"created_at"`
}

// TableName 指定表名
func (OperationLog) TableName() string {
	return "operation_logs"
}

// AppLog 应用运行日志实体
type AppLog struct {
	ID        uint          `gorm:"primaryKey" json:"id"`
	LoggedAt  time.Time     `gorm:"index" json:"logged_at"`
	Level     string        `gorm:"type:varchar(16);not null;index" json:"level"`
	Owner     string        `gorm:"type:varchar(32);not null;index" json:"owner"`
	Code      int           `gorm:"index" json:"code"`
	Message   string        `gorm:"type:text;not null" json:"message"`
	FilePath  *string       `gorm:"type:text" json:"file_path"`
	Context   *shared.JSONB `gorm:"type:jsonb" json:"context"`
	CreatedAt time.Time     `gorm:"index" json:"created_at"`
}

// TableName 指定表名
func (AppLog) TableName() string {
	return "app_logs"
}

// Statistics 数据统计持久化实体
type Statistics struct {
	ID             uint           `gorm:"primaryKey" json:"id"`
	Date           time.Time      `gorm:"type:date;not null;index" json:"date"`
	MetricType     string         `gorm:"type:varchar(50);not null;index" json:"metric_type"`
	MetricValue    int64          `gorm:"not null" json:"metric_value"`
	Dimension      *string        `gorm:"type:varchar(50)" json:"dimension"`
	DimensionValue *string        `gorm:"type:varchar(100)" json:"dimension_value"`
	Metadata       *shared.JSONB  `gorm:"type:jsonb" json:"metadata"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	DeletedAt      gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Statistics) TableName() string {
	return "statistics"
}

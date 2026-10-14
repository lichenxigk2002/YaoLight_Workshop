package models

import (
	"gorm.io/gorm"
	"time"
	"yaolight-workshop/backend/infrastructure/shared"
)

// ModelPricingConfig 模型计费配置表
// 用于存储所有模型（系统预设和用户自定义）的计费规则
type ModelPricingConfig struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Provider    string         `gorm:"type:varchar(50);not null;index:idx_provider_model,unique" json:"provider"`
	ModelName   string         `gorm:"type:varchar(100);not null;index:idx_provider_model,unique" json:"model_name"`
	PricingType string         `gorm:"type:varchar(50);not null;default:'unified'" json:"pricing_type"` // unified, separate, multi_type, segmented, per_image
	Currency    string         `gorm:"type:varchar(10);default:'USD'" json:"currency"`                  // USD, CNY
	PricingData shared.JSONB   `gorm:"type:jsonb;not null;default:'{}'" json:"pricing_data"`            // 详细的计费规则（JSONB）
	IsActive    bool           `gorm:"default:true;index" json:"is_active"`                             // 是否启用此计费配置
	Description *string        `gorm:"type:text" json:"description"`                                    // 计费规则说明
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (ModelPricingConfig) TableName() string {
	return "model_pricing_configs"
}

// PricingDataStructure 计费数据结构的JSON格式说明
// 根据 PricingType 的不同，PricingData 字段会有不同的结构：

// 1. unified (统一计费):
// {
//   "price_per_million_tokens": 0.5
// }

// 2. separate (分离计费):
// {
//   "input_price_per_million": 0.2,
//   "output_price_per_million": 0.5
// }

// 3. multi_type (多类型计费):
// {
//   "input_price_per_million": 0.5,
//   "output_price_per_million": 3.0,
//   "audio_price_per_million": 1.0,
//   "cache_read_price_per_million": 0.05,
//   "cache_write_price_per_million": null,
//   "audio_cache_read_price_per_million": 0.10
// }

// 4. segmented (分段计费):
// {
//   "segments": [
//     {
//       "context_length_limit": 128000,
//       "input_price_per_million": 0.20,
//       "output_price_per_million": 0.50,
//       "cache_read_price_per_million": 0.05
//     },
//     {
//       "context_length_limit": null,
//       "input_price_per_million": 0.40,
//       "output_price_per_million": 1.00,
//       "cache_read_price_per_million": 0.05
//     }
//   ]
// }

// 5. per_image (按张计费):
// {
//   "text_to_image_price": 0.50,
//   "image_to_image_price": 0.60,
//   "price_per_image": 0.50
// }

package models

import "time"

const (
	PackageStatusActive   = "active"
	PackageStatusInactive = "inactive"
)

// StardustPackage 星尘充值套餐
type StardustPackage struct {
	ID            string    `gorm:"type:varchar(64);primaryKey" json:"id"`                    // 套餐ID
	Name          string    `gorm:"type:varchar(100);not null" json:"name"`                   // 套餐名称
	NameEn        string    `gorm:"type:varchar(100)" json:"nameEn,omitempty"`                // 英文套餐名称
	Price         float64   `gorm:"not null" json:"price"`                                    // 价格（CNY）
	Stardust      int64     `gorm:"not null" json:"stardust"`                                 // 包含星尘数
	Tag           string    `gorm:"type:varchar(32)" json:"tag,omitempty"`                    // 营销标签（可选）
	TagEn         string    `gorm:"type:varchar(32)" json:"tagEn,omitempty"`                  // 英文营销标签（可选）
	Description   string    `gorm:"type:varchar(255)" json:"description,omitempty"`           // 描述（可选）
	DescriptionEn string    `gorm:"type:varchar(255)" json:"descriptionEn,omitempty"`         // 英文描述（可选）
	Status        string    `gorm:"type:varchar(20);not null;default:'active'" json:"status"` // active | inactive
	SortOrder     int       `gorm:"not null;default:0" json:"sortOrder"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

func (StardustPackage) TableName() string {
	return "stardust_packages"
}

// GetDefaultPackages 获取默认套餐列表
func GetDefaultPackages() []StardustPackage {
	return []StardustPackage{
		{
			ID:            "pkg_s",
			Name:          "星火包",
			NameEn:        "Spark Pack",
			Price:         9.9,
			Stardust:      4000000,
			Tag:           "入门",
			TagEn:         "Starter",
			Description:   "适合新手用户，性价比高",
			DescriptionEn: "A cost-effective starter package for new users.",
			Status:        PackageStatusActive,
			SortOrder:     1,
		},
		{
			ID:            "pkg_m",
			Name:          "星云包",
			NameEn:        "Nebula Pack",
			Price:         49.9,
			Stardust:      20000000,
			Tag:           "热门",
			TagEn:         "Popular",
			Description:   "最受欢迎的选择，适合日常使用",
			DescriptionEn: "The most popular option for everyday platform usage.",
			Status:        PackageStatusActive,
			SortOrder:     2,
		},
		{
			ID:            "pkg_l",
			Name:          "星河包",
			NameEn:        "Galaxy Pack",
			Price:         199.9,
			Stardust:      80000000,
			Tag:           "超值",
			TagEn:         "Best Value",
			Description:   "超值大礼包，适合重度用户",
			DescriptionEn: "A high-value bundle for heavy usage.",
			Status:        PackageStatusActive,
			SortOrder:     3,
		},
	}
}

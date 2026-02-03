package models

// StardustPackage 星尘充值套餐
type StardustPackage struct {
	ID          string  `json:"id"`           // 套餐ID
	Name        string  `json:"name"`         // 套餐名称
	Price       float64 `json:"price"`        // 价格（CNY）
	Stardust    int64   `json:"stardust"`     // 包含星尘数
	Tag         string  `json:"tag,omitempty"` // 营销标签（可选）
	Description string  `json:"description,omitempty"` // 描述（可选）
}

// GetDefaultPackages 获取默认套餐列表
func GetDefaultPackages() []StardustPackage {
	return []StardustPackage{
		{
			ID:          "pkg_s",
			Name:        "星火包",
			Price:       9.9,
			Stardust:    4000000,
			Tag:         "入门",
			Description: "适合新手用户，性价比高",
		},
		{
			ID:          "pkg_m",
			Name:        "星云包",
			Price:       49.9,
			Stardust:    20000000,
			Tag:         "热门",
			Description: "最受欢迎的选择，适合日常使用",
		},
		{
			ID:          "pkg_l",
			Name:        "星河包",
			Price:       199.9,
			Stardust:    80000000,
			Tag:         "超值",
			Description: "超值大礼包，适合重度用户",
		},
	}
}


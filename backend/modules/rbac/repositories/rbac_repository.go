package repositories

import (
	"yaolight-workshop/backend/modules/rbac/models"

	"gorm.io/gorm"
)

type RBACRepository struct {
	db *gorm.DB
}

func NewRBACRepository(db *gorm.DB) *RBACRepository {
	return &RBACRepository{db: db}
}

func (r *RBACRepository) ListPermissionKeysByUserID(userID uint) ([]string, error) {
	var permissions []string
	err := r.db.
		Table("permissions AS p").
		Select("CONCAT(p.resource_key, ':', p.action)").
		Joins("JOIN role_permissions rp ON rp.permission_id = p.id").
		Joins("JOIN user_roles ur ON ur.role_id = rp.role_id").
		Where("ur.user_id = ?", userID).
		Order("p.resource_key ASC, p.action ASC").
		Scan(&permissions).Error
	if err != nil {
		return nil, err
	}
	return permissions, nil
}

func (r *RBACRepository) HasPermission(userID uint, permission string) (bool, error) {
	var count int64
	err := r.db.
		Table("permissions AS p").
		Joins("JOIN role_permissions rp ON rp.permission_id = p.id").
		Joins("JOIN user_roles ur ON ur.role_id = rp.role_id").
		Where("ur.user_id = ? AND CONCAT(p.resource_key, ':', p.action) = ?", userID, permission).
		Count(&count).Error
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *RBACRepository) GetRoleByCode(code string) (*models.Role, error) {
	var role models.Role
	if err := r.db.Where("code = ?", code).First(&role).Error; err != nil {
		return nil, err
	}
	return &role, nil
}

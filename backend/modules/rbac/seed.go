package rbac

import (
	"errors"
	"fmt"

	rbacModels "yaolight-workshop/backend/modules/rbac/models"
	userModels "yaolight-workshop/backend/modules/user/models"

	"gorm.io/gorm"
)

func SeedRBAC(db *gorm.DB) error {
	if err := seedRoles(db); err != nil {
		return err
	}
	if err := seedPermissions(db); err != nil {
		return err
	}
	if err := seedRolePermissions(db); err != nil {
		return err
	}
	if err := bindExistingAdminsToSuperAdmin(db); err != nil {
		return err
	}
	return nil
}

func seedRoles(db *gorm.DB) error {
	for _, def := range DefaultRoleDefinitions {
		var role rbacModels.Role
		err := db.Where("code = ?", def.Code).First(&role).Error
		if err == nil {
			updates := map[string]interface{}{
				"name":        def.Name,
				"description": nullableString(def.Description),
			}
			if err := db.Model(&role).Updates(updates).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		role = rbacModels.Role{
			Code:        def.Code,
			Name:        def.Name,
			Description: nullableString(def.Description),
		}
		if err := db.Create(&role).Error; err != nil {
			return err
		}
	}
	return nil
}

func seedPermissions(db *gorm.DB) error {
	for _, resource := range ResourceDefinitions {
		for _, action := range []string{"view", "edit"} {
			var permission rbacModels.Permission
			err := db.
				Where("resource_key = ? AND action = ?", resource.Key, action).
				First(&permission).Error
			description := fmt.Sprintf("%s %s", resource.Description, map[string]string{"view": "查看", "edit": "编辑"}[action])
			if err == nil {
				if err := db.Model(&permission).Update("description", nullableString(description)).Error; err != nil {
					return err
				}
				continue
			}
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			permission = rbacModels.Permission{
				ResourceKey: resource.Key,
				Action:      action,
				Description: nullableString(description),
			}
			if err := db.Create(&permission).Error; err != nil {
				return err
			}
		}
	}
	return nil
}

func seedRolePermissions(db *gorm.DB) error {
	var superAdmin rbacModels.Role
	if err := db.Where("code = ?", "super_admin").First(&superAdmin).Error; err != nil {
		return err
	}

	var permissions []rbacModels.Permission
	if err := db.Find(&permissions).Error; err != nil {
		return err
	}

	for _, permission := range permissions {
		var count int64
		if err := db.Model(&rbacModels.RolePermission{}).
			Where("role_id = ? AND permission_id = ?", superAdmin.ID, permission.ID).
			Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if err := db.Create(&rbacModels.RolePermission{
			RoleID:       superAdmin.ID,
			PermissionID: permission.ID,
		}).Error; err != nil {
			return err
		}
	}

	return nil
}

func bindExistingAdminsToSuperAdmin(db *gorm.DB) error {
	var superAdmin rbacModels.Role
	if err := db.Where("code = ?", "super_admin").First(&superAdmin).Error; err != nil {
		return err
	}

	var admins []userModels.User
	if err := db.Where("role = ? AND deleted_at IS NULL", "admin").Find(&admins).Error; err != nil {
		return err
	}

	for _, admin := range admins {
		var count int64
		if err := db.Model(&rbacModels.UserRole{}).Where("user_id = ?", admin.ID).Count(&count).Error; err != nil {
			return err
		}
		if count > 0 {
			continue
		}
		if err := db.Create(&rbacModels.UserRole{
			UserID: admin.ID,
			RoleID: superAdmin.ID,
		}).Error; err != nil {
			return err
		}
	}

	return nil
}

func nullableString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

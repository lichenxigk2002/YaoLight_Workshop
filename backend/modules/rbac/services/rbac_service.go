package services

import (
	"sort"

	"yaolight-workshop/backend/modules/rbac/repositories"

	"gorm.io/gorm"
)

type RBACService struct {
	repo *repositories.RBACRepository
}

func NewRBACService(db *gorm.DB) *RBACService {
	return &RBACService{
		repo: repositories.NewRBACRepository(db),
	}
}

func (s *RBACService) GetUserPermissions(userID uint) ([]string, error) {
	permissions, err := s.repo.ListPermissionKeysByUserID(userID)
	if err != nil {
		return nil, err
	}
	if len(permissions) == 0 {
		return []string{}, nil
	}

	seen := make(map[string]struct{}, len(permissions))
	result := make([]string, 0, len(permissions))
	for _, permission := range permissions {
		if _, exists := seen[permission]; exists {
			continue
		}
		seen[permission] = struct{}{}
		result = append(result, permission)
	}
	sort.Strings(result)
	return result, nil
}

func (s *RBACService) HasPermission(userID uint, permission string) (bool, error) {
	return s.repo.HasPermission(userID, permission)
}

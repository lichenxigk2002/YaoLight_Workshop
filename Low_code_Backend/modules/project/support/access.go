package support

import (
	"errors"

	"gorm.io/gorm"
	projectModels "yaolight-workshop/backend/modules/project/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var ErrProjectAccessDenied = errors.New("project access denied")
var ErrWorkflowAccessDenied = errors.New("workflow access denied")

func EnsureProjectOwner(db *gorm.DB, projectID uint, userID uint) error {
	var count int64
	if err := db.Model(&projectModels.Project{}).
		Where("id = ? AND user_id = ? AND deleted_at IS NULL", projectID, userID).
		Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return ErrProjectAccessDenied
	}
	return nil
}

func EnsureWorkflowInProject(db *gorm.DB, workflowID uint, projectID uint, userID uint) error {
	var count int64
	if err := db.Model(&workflowModels.Workflow{}).
		Where("id = ? AND user_id = ? AND project_id = ? AND deleted_at IS NULL", workflowID, userID, projectID).
		Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return ErrWorkflowAccessDenied
	}
	return nil
}

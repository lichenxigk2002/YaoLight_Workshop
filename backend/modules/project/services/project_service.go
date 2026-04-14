package services

import (
	"errors"
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/modules/project/models"
)

var (
	ErrProjectNotFound = errors.New("project not found")
	ErrProjectExists   = errors.New("project already exists")
)

// ProjectService 项目服务
type ProjectService struct {
	projectRepo repository.ProjectRepository
}

// NewProjectService 创建项目服务
func NewProjectService(projectRepo repository.ProjectRepository) *ProjectService {
	return &ProjectService{projectRepo: projectRepo}
}

// CreateProjectRequest 创建项目请求
type CreateProjectRequest struct {
	Name        string  `json:"name" binding:"required,min=1,max=200"`
	Description *string `json:"description,omitempty"`
	UserID      uint    `json:"-"`
}

// UpdateProjectRequest 更新项目请求
type UpdateProjectRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Status      *string `json:"status,omitempty"`
}

// CreateProject 创建项目
func (s *ProjectService) CreateProject(req *CreateProjectRequest) (*models.Project, error) {
	// 创建项目领域实体
	project := &entity.Project{
		UserID:      req.UserID,
		Name:        req.Name,
		Description: req.Description,
		Status:      "active",
	}

	// 通过仓储创建项目
	if err := s.projectRepo.Create(project); err != nil {
		return nil, err
	}

	// 转换为持久化实体返回（保持向后兼容）
	return toPersistenceModel(project), nil
}

// GetProjectByID 根据ID获取项目
func (s *ProjectService) GetProjectByID(id uint) (*models.Project, error) {
	project, err := s.projectRepo.FindByID(id)
	if err != nil {
		return nil, ErrProjectNotFound
	}

	return toPersistenceModel(project), nil
}

// GetProjectsByUserID 根据用户ID获取项目列表
func (s *ProjectService) GetProjectsByUserID(userID uint, page, pageSize int) ([]*models.Project, int64, error) {
	offset := (page - 1) * pageSize
	projects, total, err := s.projectRepo.FindByUserID(userID, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}

	// 转换为持久化模型
	modelsList := make([]*models.Project, len(projects))
	for i, project := range projects {
		modelsList[i] = toPersistenceModel(project)
	}

	return modelsList, total, nil
}

// UpdateProject 更新项目
func (s *ProjectService) UpdateProject(id uint, req *UpdateProjectRequest) (*models.Project, error) {
	project, err := s.projectRepo.FindByID(id)
	if err != nil {
		return nil, ErrProjectNotFound
	}

	// 更新字段
	if req.Name != nil {
		project.Name = *req.Name
	}
	if req.Description != nil {
		project.Description = req.Description
	}
	if req.Status != nil {
		project.Status = *req.Status
	}

	if err := s.projectRepo.Update(project); err != nil {
		return nil, err
	}

	return toPersistenceModel(project), nil
}

// DeleteProject 删除项目
func (s *ProjectService) DeleteProject(id uint) error {
	_, err := s.projectRepo.FindByID(id)
	if err != nil {
		return ErrProjectNotFound
	}

	return s.projectRepo.Delete(id)
}

// toPersistenceModel 将领域实体转换为持久化模型（用于返回给 Controller）
func toPersistenceModel(project *entity.Project) *models.Project {
	return &models.Project{
		ID:          project.ID,
		UserID:      project.UserID,
		Name:        project.Name,
		Description: project.Description,
		Status:      project.Status,
		CreatedAt:   project.CreatedAt,
		UpdatedAt:   project.UpdatedAt,
	}
}

package services

import (
	"time"

	"yaolight-workshop/backend/modules/system/repositories"
)

type AdminOperationLogListParams struct {
	Page         int
	PageSize     int
	Keyword      string
	UserID       *uint
	Action       string
	ResourceType string
	ResourceID   *uint
	Result       string
	StatusCode   *int
	CreatedFrom  *time.Time
	CreatedTo    *time.Time
}

type AdminOperationLogService struct {
	repo *repositories.OperationLogRepository
}

func NewAdminOperationLogService(repo *repositories.OperationLogRepository) *AdminOperationLogService {
	return &AdminOperationLogService{repo: repo}
}

func (s *AdminOperationLogService) List(params AdminOperationLogListParams) ([]repositories.AdminOperationLogListItem, int64, int, int, error) {
	page, pageSize := normalizeAdminOperationLogPage(params.Page, params.PageSize)

	list, total, err := s.repo.List(repositories.AdminOperationLogListQuery{
		Page:         page,
		PageSize:     pageSize,
		Keyword:      params.Keyword,
		UserID:       params.UserID,
		Action:       params.Action,
		ResourceType: params.ResourceType,
		ResourceID:   params.ResourceID,
		Result:       params.Result,
		StatusCode:   params.StatusCode,
		CreatedFrom:  params.CreatedFrom,
		CreatedTo:    params.CreatedTo,
	})
	if err != nil {
		return nil, 0, page, pageSize, err
	}
	return list, total, page, pageSize, nil
}

func (s *AdminOperationLogService) GetByID(id uint) (*repositories.AdminOperationLogDetail, error) {
	return s.repo.GetByID(id)
}

func normalizeAdminOperationLogPage(page, pageSize int) (int, int) {
	if page <= 0 {
		page = 1
	}
	switch {
	case pageSize <= 0:
		pageSize = 20
	case pageSize > 100:
		pageSize = 100
	}
	return page, pageSize
}

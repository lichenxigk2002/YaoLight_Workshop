package services

import (
	"time"

	"yaolight-workshop/backend/modules/system/repositories"
)

type AdminAppLogListParams struct {
	Page        int
	PageSize    int
	Keyword     string
	Level       string
	Owner       string
	Code        *int
	FilePath    string
	CreatedFrom *time.Time
	CreatedTo   *time.Time
}

type AppLogService struct {
	repo *repositories.AppLogRepository
}

func NewAppLogService(repo *repositories.AppLogRepository) *AppLogService {
	return &AppLogService{repo: repo}
}

func (s *AppLogService) List(params AdminAppLogListParams) ([]repositories.AdminAppLogListItem, int64, int, int, error) {
	page, pageSize := normalizeAdminOperationLogPage(params.Page, params.PageSize)

	list, total, err := s.repo.List(repositories.AdminAppLogListQuery{
		Page:        page,
		PageSize:    pageSize,
		Keyword:     params.Keyword,
		Level:       params.Level,
		Owner:       params.Owner,
		Code:        params.Code,
		FilePath:    params.FilePath,
		CreatedFrom: params.CreatedFrom,
		CreatedTo:   params.CreatedTo,
	})
	if err != nil {
		return nil, 0, page, pageSize, err
	}
	return list, total, page, pageSize, nil
}

func (s *AppLogService) GetByID(id uint) (*repositories.AdminAppLogDetail, error) {
	return s.repo.GetByID(id)
}

func (s *AppLogService) DeleteByID(id uint) error {
	return s.repo.DeleteByID(id)
}

func (s *AppLogService) DeleteAll() (int64, error) {
	return s.repo.DeleteAll()
}

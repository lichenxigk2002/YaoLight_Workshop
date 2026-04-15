package repositories

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
)

type AdminAppLogListQuery struct {
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

type AdminAppLogListItem struct {
	ID        uint      `json:"id"`
	LoggedAt  time.Time `json:"logged_at"`
	Level     string    `json:"level"`
	Owner     string    `json:"owner"`
	Code      int       `json:"code"`
	Message   string    `json:"message"`
	FilePath  *string   `json:"file_path"`
	CreatedAt time.Time `json:"created_at"`
}

type AdminAppLogDetail struct {
	ID        uint          `json:"id"`
	LoggedAt  time.Time     `json:"logged_at"`
	Level     string        `json:"level"`
	Owner     string        `json:"owner"`
	Code      int           `json:"code"`
	Message   string        `json:"message"`
	FilePath  *string       `json:"file_path"`
	Context   *shared.JSONB `json:"context"`
	CreatedAt time.Time     `json:"created_at"`
}

type AppLogRepository struct {
	db *gorm.DB
}

func NewAppLogRepository(db *gorm.DB) *AppLogRepository {
	return &AppLogRepository{db: db}
}

func (r *AppLogRepository) List(query AdminAppLogListQuery) ([]AdminAppLogListItem, int64, error) {
	baseQuery := r.buildListQuery(query)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (query.Page - 1) * query.PageSize
	if offset < 0 {
		offset = 0
	}

	var items []AdminAppLogListItem
	err := r.buildListQuery(query).
		Table("app_logs").
		Select("id, logged_at, level, owner, code, message, file_path, created_at").
		Order("logged_at DESC, id DESC").
		Offset(offset).
		Limit(query.PageSize).
		Scan(&items).Error
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (r *AppLogRepository) GetByID(id uint) (*AdminAppLogDetail, error) {
	var item AdminAppLogDetail
	tx := r.db.Table("app_logs").
		Select("id, logged_at, level, owner, code, message, file_path, context, created_at").
		Where("id = ?", id).
		Limit(1).
		Scan(&item)
	if tx.Error != nil {
		return nil, tx.Error
	}
	if tx.RowsAffected == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	return &item, nil
}

func (r *AppLogRepository) DeleteByID(id uint) error {
	tx := r.db.Exec(`DELETE FROM app_logs WHERE id = ?`, id)
	if tx.Error != nil {
		return tx.Error
	}
	if tx.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *AppLogRepository) DeleteAll() (int64, error) {
	var total int64
	if err := r.db.Table("app_logs").Count(&total).Error; err != nil {
		return 0, err
	}
	tx := r.db.Exec(`TRUNCATE TABLE app_logs RESTART IDENTITY`)
	return total, tx.Error
}

func (r *AppLogRepository) buildListQuery(query AdminAppLogListQuery) *gorm.DB {
	tx := r.db.Table("app_logs")

	if level := strings.TrimSpace(strings.ToLower(query.Level)); level != "" {
		tx = tx.Where("level = ?", level)
	}
	if owner := strings.TrimSpace(query.Owner); owner != "" {
		tx = tx.Where("owner = ?", owner)
	}
	if query.Code != nil {
		tx = tx.Where("code = ?", *query.Code)
	}
	if filePath := strings.TrimSpace(query.FilePath); filePath != "" {
		tx = tx.Where("file_path ILIKE ?", "%"+filePath+"%")
	}
	if query.CreatedFrom != nil {
		tx = tx.Where("logged_at >= ?", *query.CreatedFrom)
	}
	if query.CreatedTo != nil {
		tx = tx.Where("logged_at <= ?", *query.CreatedTo)
	}
	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where(`
			message ILIKE ?
			OR owner ILIKE ?
			OR file_path ILIKE ?
			OR CAST(code AS TEXT) = ?
		`, like, like, like, keyword)
	}

	return tx
}

package repositories

import (
	"strings"
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
)

type AdminOperationLogListQuery struct {
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

type AdminOperationLogListItem struct {
	ID           uint      `json:"id"`
	UserID       *uint     `json:"user_id"`
	Username     *string   `json:"username"`
	RealName     *string   `json:"real_name"`
	Email        *string   `json:"email"`
	AvatarURL    *string   `json:"avatar_url"`
	Action       string    `json:"action"`
	ResourceType string    `json:"resource_type"`
	ResourceID   *uint     `json:"resource_id"`
	IPAddress    *string   `json:"ip_address"`
	StatusCode   *int      `json:"status_code"`
	ErrorMessage *string   `json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

type AdminOperationLogDetail struct {
	ID           uint          `json:"id"`
	UserID       *uint         `json:"user_id"`
	Username     *string       `json:"username"`
	RealName     *string       `json:"real_name"`
	Email        *string       `json:"email"`
	AvatarURL    *string       `json:"avatar_url"`
	Action       string        `json:"action"`
	ResourceType string        `json:"resource_type"`
	ResourceID   *uint         `json:"resource_id"`
	IPAddress    *string       `json:"ip_address"`
	UserAgent    *string       `json:"user_agent"`
	RequestData  *shared.JSONB `json:"request_data"`
	ResponseData *shared.JSONB `json:"response_data"`
	StatusCode   *int          `json:"status_code"`
	ErrorMessage *string       `json:"error_message"`
	CreatedAt    time.Time     `json:"created_at"`
}

type OperationLogRepository struct {
	db *gorm.DB
}

func NewOperationLogRepository(db *gorm.DB) *OperationLogRepository {
	return &OperationLogRepository{db: db}
}

func (r *OperationLogRepository) List(query AdminOperationLogListQuery) ([]AdminOperationLogListItem, int64, error) {
	baseQuery := r.buildListQuery(query)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (query.Page - 1) * query.PageSize
	if offset < 0 {
		offset = 0
	}

	var items []AdminOperationLogListItem
	err := r.buildListQuery(query).
		Select(`
			operation_logs.id,
			operation_logs.user_id,
			users.username,
			users.real_name,
			users.email,
			users.avatar_url,
			operation_logs.action,
			operation_logs.resource_type,
			operation_logs.resource_id,
			operation_logs.ip_address,
			operation_logs.status_code,
			operation_logs.error_message,
			operation_logs.created_at
		`).
		Order("operation_logs.created_at DESC").
		Offset(offset).
		Limit(query.PageSize).
		Scan(&items).Error
	if err != nil {
		return nil, 0, err
	}

	return items, total, nil
}

func (r *OperationLogRepository) GetByID(id uint) (*AdminOperationLogDetail, error) {
	var item AdminOperationLogDetail
	tx := r.db.
		Table("operation_logs").
		Joins("LEFT JOIN users ON users.id = operation_logs.user_id").
		Select(`
			operation_logs.id,
			operation_logs.user_id,
			users.username,
			users.real_name,
			users.email,
			users.avatar_url,
			operation_logs.action,
			operation_logs.resource_type,
			operation_logs.resource_id,
			operation_logs.ip_address,
			operation_logs.user_agent,
			operation_logs.request_data,
			operation_logs.response_data,
			operation_logs.status_code,
			operation_logs.error_message,
			operation_logs.created_at
		`).
		Where("operation_logs.id = ?", id).
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

func (r *OperationLogRepository) buildListQuery(query AdminOperationLogListQuery) *gorm.DB {
	tx := r.db.Table("operation_logs").Joins("LEFT JOIN users ON users.id = operation_logs.user_id")

	if query.UserID != nil {
		tx = tx.Where("operation_logs.user_id = ?", *query.UserID)
	}
	if query.Action != "" {
		tx = tx.Where("operation_logs.action = ?", query.Action)
	}
	if query.ResourceType != "" {
		tx = tx.Where("operation_logs.resource_type = ?", query.ResourceType)
	}
	if query.ResourceID != nil {
		tx = tx.Where("operation_logs.resource_id = ?", *query.ResourceID)
	}
	if query.StatusCode != nil {
		tx = tx.Where("operation_logs.status_code = ?", *query.StatusCode)
	}
	if query.CreatedFrom != nil {
		tx = tx.Where("operation_logs.created_at >= ?", *query.CreatedFrom)
	}
	if query.CreatedTo != nil {
		tx = tx.Where("operation_logs.created_at <= ?", *query.CreatedTo)
	}

	switch strings.ToLower(strings.TrimSpace(query.Result)) {
	case "success":
		tx = tx.Where("(operation_logs.status_code IS NULL OR operation_logs.status_code < 400) AND (operation_logs.error_message IS NULL OR operation_logs.error_message = '')")
	case "failed":
		tx = tx.Where("(operation_logs.status_code >= 400) OR (operation_logs.error_message IS NOT NULL AND operation_logs.error_message <> '')")
	}

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		tx = tx.Where(`
			users.username ILIKE ?
			OR users.email ILIKE ?
			OR users.real_name ILIKE ?
			OR operation_logs.action ILIKE ?
			OR operation_logs.resource_type ILIKE ?
			OR operation_logs.error_message ILIKE ?
			OR CAST(operation_logs.resource_id AS TEXT) = ?
		`, like, like, like, like, like, like, keyword)
	}

	return tx
}

package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	paymentModels "yaolight-workshop/backend/modules/payment/models"
	projectModels "yaolight-workshop/backend/modules/project/models"
	taskModels "yaolight-workshop/backend/modules/task/models"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var (
	ErrAdminUserNotFound      = errors.New("user not found")
	ErrAdminUserInvalidStatus = errors.New("invalid user status")
	ErrAdminUserInvalidPass   = errors.New("password must be at least 6 characters")
	ErrAdminUserDisableSelf   = errors.New("cannot disable or suspend your own account")
)

type AdminUserService struct {
	db *gorm.DB
}

type AdminUserListParams struct {
	Page        int
	PageSize    int
	Keyword     string
	Status      string
	Role        string
	CreatedFrom string
	CreatedTo   string
}

type AdminUserSummary struct {
	Total        int64 `json:"total"`
	Active       int64 `json:"active"`
	Admins       int64 `json:"admins"`
	NewLast7Days int64 `json:"new_last_7_days"`
}

type AdminUserListItem struct {
	ID           uint       `json:"id"`
	UserNo       int64      `json:"user_no"`
	Username     string     `json:"username"`
	Email        string     `json:"email"`
	AvatarURL    *string    `json:"avatar_url"`
	Role         string     `json:"role"`
	Status       string     `json:"status"`
	TokenBalance int64      `json:"token_balance"`
	LoginCount   int        `json:"login_count"`
	LastLoginAt  *time.Time `json:"last_login_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

type AdminUserInviter struct {
	ID       uint   `json:"id"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type AdminUserStats struct {
	ProjectCount   int64   `json:"project_count"`
	WorkflowCount  int64   `json:"workflow_count"`
	TaskCount      int64   `json:"task_count"`
	InviteCount    int64   `json:"invite_count"`
	PaidOrderCount int64   `json:"paid_order_count"`
	TotalPaid      float64 `json:"total_paid"`
}

type AdminUserDetail struct {
	AdminUserListItem
	Phone             *string           `json:"phone"`
	RealName          *string           `json:"real_name"`
	LastLoginIP       *string           `json:"last_login_ip"`
	LastLoginLocation string            `json:"last_login_location"`
	UpdatedAt         time.Time         `json:"updated_at"`
	HasPassword       bool              `json:"has_password"`
	Inviter           *AdminUserInviter `json:"inviter"`
	Stats             AdminUserStats    `json:"stats"`
}

func NewAdminUserService(db *gorm.DB) *AdminUserService {
	return &AdminUserService{db: db}
}

func (s *AdminUserService) GetSummary() (*AdminUserSummary, error) {
	summary := &AdminUserSummary{}
	if err := s.db.Model(&userModels.User{}).Count(&summary.Total).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&userModels.User{}).Where("status = ?", "active").Count(&summary.Active).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&userModels.User{}).Where("role = ?", "admin").Count(&summary.Admins).Error; err != nil {
		return nil, err
	}
	if err := s.db.Model(&userModels.User{}).Where("created_at >= ?", time.Now().AddDate(0, 0, -7)).Count(&summary.NewLast7Days).Error; err != nil {
		return nil, err
	}
	return summary, nil
}

func (s *AdminUserService) ListUsers(params AdminUserListParams) ([]AdminUserListItem, int64, error) {
	page, pageSize := normalizePage(params.Page, params.PageSize)
	db := s.applyFilters(s.db.Model(&userModels.User{}), params)

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var users []userModels.User
	if err := db.Order("created_at DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}

	items := make([]AdminUserListItem, 0, len(users))
	for i := range users {
		items = append(items, toAdminUserListItem(&users[i]))
	}

	return items, total, nil
}

func (s *AdminUserService) GetUserDetail(userID uint) (*AdminUserDetail, error) {
	var user userModels.User
	if err := s.db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAdminUserNotFound
		}
		return nil, err
	}

	stats, err := s.getUserStats(user.ID)
	if err != nil {
		return nil, err
	}

	detail := &AdminUserDetail{
		AdminUserListItem: toAdminUserListItem(&user),
		Phone:             user.Phone,
		RealName:          user.RealName,
		LastLoginIP:       user.LastLoginIP,
		LastLoginLocation: resolveIPLocation(ptrString(user.LastLoginIP)),
		UpdatedAt:         user.UpdatedAt,
		HasPassword:       strings.TrimSpace(user.Password) != "",
		Stats:             stats,
	}

	if user.InviterID != nil {
		var inviter userModels.User
		if err := s.db.Select("id", "username", "email").First(&inviter, *user.InviterID).Error; err == nil {
			detail.Inviter = &AdminUserInviter{
				ID:       inviter.ID,
				Username: inviter.Username,
				Email:    inviter.Email,
			}
		}
	}

	return detail, nil
}

func ptrString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func (s *AdminUserService) UpdateUserStatus(operatorID, userID uint, status string) (*AdminUserListItem, error) {
	if !isValidAdminUserStatus(status) {
		return nil, ErrAdminUserInvalidStatus
	}
	if operatorID == userID && status != "active" {
		return nil, ErrAdminUserDisableSelf
	}

	var user userModels.User
	if err := s.db.First(&user, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrAdminUserNotFound
		}
		return nil, err
	}

	user.Status = status
	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	item := toAdminUserListItem(&user)
	return &item, nil
}

func (s *AdminUserService) ResetPassword(userID uint, password string) error {
	if len(strings.TrimSpace(password)) < 6 {
		return ErrAdminUserInvalidPass
	}

	hashed, err := hashPasswordForStorage(password)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	result := s.db.Model(&userModels.User{}).Where("id = ?", userID).Update("password", string(hashed))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrAdminUserNotFound
	}

	return nil
}

func (s *AdminUserService) applyFilters(db *gorm.DB, params AdminUserListParams) *gorm.DB {
	keyword := strings.TrimSpace(params.Keyword)
	if keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		db = db.Where(
			"LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR CAST(id AS TEXT) LIKE ? OR CAST(user_no AS TEXT) LIKE ?",
			like, like, like, like,
		)
	}
	if isValidAdminUserStatus(params.Status) && params.Status != "" {
		db = db.Where("status = ?", params.Status)
	}
	if params.Role == "admin" || params.Role == "user" {
		db = db.Where("role = ?", params.Role)
	}
	if params.CreatedFrom != "" {
		if t, err := time.Parse("2006-01-02", params.CreatedFrom); err == nil {
			db = db.Where("created_at >= ?", t)
		}
	}
	if params.CreatedTo != "" {
		if t, err := time.Parse("2006-01-02", params.CreatedTo); err == nil {
			db = db.Where("created_at <= ?", t.Add(24*time.Hour-time.Nanosecond))
		}
	}
	return db
}

func (s *AdminUserService) getUserStats(userID uint) (AdminUserStats, error) {
	stats := AdminUserStats{}

	if err := s.db.Model(&projectModels.Project{}).Where("user_id = ?", userID).Count(&stats.ProjectCount).Error; err != nil {
		return stats, err
	}
	if err := s.db.Model(&workflowModels.Workflow{}).Where("user_id = ?", userID).Count(&stats.WorkflowCount).Error; err != nil {
		return stats, err
	}
	if err := s.db.Model(&taskModels.Task{}).Where("user_id = ?", userID).Count(&stats.TaskCount).Error; err != nil {
		return stats, err
	}
	if err := s.db.Model(&userModels.UserInvitation{}).Where("inviter_id = ?", userID).Count(&stats.InviteCount).Error; err != nil {
		return stats, err
	}
	if err := s.db.Model(&paymentModels.Order{}).
		Where("user_id = ? AND status = ?", userID, paymentModels.OrderStatusPaid).
		Count(&stats.PaidOrderCount).Error; err != nil {
		return stats, err
	}
	if err := s.db.Model(&paymentModels.Order{}).
		Where("user_id = ? AND status = ?", userID, paymentModels.OrderStatusPaid).
		Select("COALESCE(SUM(amount), 0)").
		Scan(&stats.TotalPaid).Error; err != nil {
		return stats, err
	}

	return stats, nil
}

func normalizePage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 10
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func isValidAdminUserStatus(status string) bool {
	switch status {
	case "", "active", "inactive", "suspended":
		return true
	default:
		return false
	}
}

func toAdminUserListItem(user *userModels.User) AdminUserListItem {
	return AdminUserListItem{
		ID:           user.ID,
		UserNo:       user.UserNo,
		Username:     user.Username,
		Email:        user.Email,
		AvatarURL:    user.AvatarURL,
		Role:         user.Role,
		Status:       user.Status,
		TokenBalance: user.TokenBalance,
		LoginCount:   user.LoginCount,
		LastLoginAt:  user.LastLoginAt,
		CreatedAt:    user.CreatedAt,
	}
}

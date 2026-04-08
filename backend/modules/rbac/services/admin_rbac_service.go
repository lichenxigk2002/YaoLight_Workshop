package services

import (
	"crypto/md5"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	rbacModels "yaolight-workshop/backend/modules/rbac/models"
	userModels "yaolight-workshop/backend/modules/user/models"
)

const superAdminRoleCode = "super_admin"

var (
	ErrRBACRoleNotFound          = errors.New("role not found")
	ErrRBACRoleProtected         = errors.New("system role cannot be edited")
	ErrRBACRoleCodeRequired      = errors.New("role code is required")
	ErrRBACRoleCodeInvalid       = errors.New("role code must contain only lowercase letters, numbers, and underscores")
	ErrRBACRoleNameRequired      = errors.New("role name is required")
	ErrRBACRoleCodeTaken         = errors.New("role code already exists")
	ErrRBACPermissionRequired    = errors.New("at least one permission is required")
	ErrRBACPermissionNotFound    = errors.New("permission not found")
	ErrRBACAdminNotFound         = errors.New("admin account not found")
	ErrRBACAdminRolesRequired    = errors.New("at least one role is required")
	ErrRBACAdminUsernameRequired = errors.New("username is required")
	ErrRBACAdminEmailRequired    = errors.New("email is required")
	ErrRBACAdminUsernameTaken    = errors.New("username already exists")
	ErrRBACAdminEmailTaken       = errors.New("email already exists")
	ErrRBACAdminPasswordInvalid  = errors.New("password must be at least 6 characters")
	ErrRBACAdminSelfRoleEdit     = errors.New("cannot update your own role assignments here")
	ErrRBACAdminInvalidStatus    = errors.New("invalid admin status")
	ErrRBACAdminDisableSelf      = errors.New("cannot disable or suspend your own account")
	ErrRBACUserNotFound          = errors.New("user not found")
	ErrRBACAdminAlreadyExists    = errors.New("user is already an admin")
	ErrRBACAdminSelfDemote       = errors.New("cannot demote your own account")
	ErrRBACAdminLastAdmin        = errors.New("cannot demote the last admin account")
)

var rbacRoleCodePattern = regexp.MustCompile(`^[a-z0-9_]+$`)

type AdminRBACService struct {
	db          *gorm.DB
	rbacService *RBACService
}

type PermissionOption struct {
	ID          uint    `json:"id"`
	ResourceKey string  `json:"resource_key"`
	Action      string  `json:"action"`
	Key         string  `json:"key"`
	Description *string `json:"description"`
}

type RoleListItem struct {
	ID            uint               `json:"id"`
	Code          string             `json:"code"`
	Name          string             `json:"name"`
	Description   *string            `json:"description"`
	IsSystem      bool               `json:"is_system"`
	AdminCount    int64              `json:"admin_count"`
	PermissionIDs []uint             `json:"permission_ids"`
	Permissions   []PermissionOption `json:"permissions"`
}

type AdminRoleSummary struct {
	ID   uint   `json:"id"`
	Code string `json:"code"`
	Name string `json:"name"`
}

type AdminAccountItem struct {
	ID          uint               `json:"id"`
	UserNo      int64              `json:"user_no"`
	Username    string             `json:"username"`
	Email       string             `json:"email"`
	Phone       *string            `json:"phone"`
	Status      string             `json:"status"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
	Roles       []AdminRoleSummary `json:"roles"`
	Permissions []string           `json:"permissions"`
}

type PromotableUserOption struct {
	ID        uint    `json:"id"`
	UserNo    int64   `json:"user_no"`
	Username  string  `json:"username"`
	Email     string  `json:"email"`
	AvatarURL *string `json:"avatar_url"`
	Status    string  `json:"status"`
}

type CreateRoleInput struct {
	Code          string `json:"code"`
	Name          string `json:"name"`
	Description   string `json:"description"`
	PermissionIDs []uint `json:"permission_ids"`
}

type UpdateRoleInput struct {
	Name          string `json:"name"`
	Description   string `json:"description"`
	PermissionIDs []uint `json:"permission_ids"`
}

type CreateAdminInput struct {
	Username string  `json:"username"`
	Email    string  `json:"email"`
	Password string  `json:"password"`
	Phone    *string `json:"phone"`
	RoleIDs  []uint  `json:"role_ids"`
}

type UpdateAdminRolesInput struct {
	RoleIDs []uint `json:"role_ids"`
}

type PromoteAdminInput struct {
	UserID  uint   `json:"user_id"`
	RoleIDs []uint `json:"role_ids"`
}

func NewAdminRBACService(db *gorm.DB) *AdminRBACService {
	return &AdminRBACService{
		db:          db,
		rbacService: NewRBACService(db),
	}
}

func (s *AdminRBACService) ListPermissions() ([]PermissionOption, error) {
	var permissions []rbacModels.Permission
	if err := s.db.Order("resource_key ASC, action ASC").Find(&permissions).Error; err != nil {
		return nil, err
	}

	result := make([]PermissionOption, 0, len(permissions))
	for _, permission := range permissions {
		result = append(result, toPermissionOption(permission))
	}
	return result, nil
}

func (s *AdminRBACService) ListRoles() ([]RoleListItem, error) {
	var roles []rbacModels.Role
	if err := s.db.Order("created_at ASC, id ASC").Find(&roles).Error; err != nil {
		return nil, err
	}

	permissions, err := s.ListPermissions()
	if err != nil {
		return nil, err
	}
	permissionByID := make(map[uint]PermissionOption, len(permissions))
	for _, permission := range permissions {
		permissionByID[permission.ID] = permission
	}

	var rolePermissions []rbacModels.RolePermission
	if err := s.db.Find(&rolePermissions).Error; err != nil {
		return nil, err
	}

	rolePermissionIDs := make(map[uint][]uint)
	for _, row := range rolePermissions {
		rolePermissionIDs[row.RoleID] = append(rolePermissionIDs[row.RoleID], row.PermissionID)
	}

	type roleCountRow struct {
		RoleID uint
		Count  int64
	}
	var roleCountRows []roleCountRow
	if err := s.db.
		Model(&rbacModels.UserRole{}).
		Select("role_id, COUNT(*) AS count").
		Group("role_id").
		Scan(&roleCountRows).Error; err != nil {
		return nil, err
	}
	roleAdminCount := make(map[uint]int64, len(roleCountRows))
	for _, row := range roleCountRows {
		roleAdminCount[row.RoleID] = row.Count
	}

	result := make([]RoleListItem, 0, len(roles))
	for _, role := range roles {
		permissionIDs := rolePermissionIDs[role.ID]
		sort.Slice(permissionIDs, func(i, j int) bool { return permissionIDs[i] < permissionIDs[j] })

		items := make([]PermissionOption, 0, len(permissionIDs))
		for _, permissionID := range permissionIDs {
			if item, ok := permissionByID[permissionID]; ok {
				items = append(items, item)
			}
		}
		sort.Slice(items, func(i, j int) bool { return items[i].Key < items[j].Key })

		result = append(result, RoleListItem{
			ID:            role.ID,
			Code:          role.Code,
			Name:          role.Name,
			Description:   role.Description,
			IsSystem:      role.Code == superAdminRoleCode,
			AdminCount:    roleAdminCount[role.ID],
			PermissionIDs: permissionIDs,
			Permissions:   items,
		})
	}

	return result, nil
}

func (s *AdminRBACService) CreateRole(input CreateRoleInput) (*RoleListItem, error) {
	code := strings.TrimSpace(input.Code)
	name := strings.TrimSpace(input.Name)
	description := normalizeOptionalString(input.Description)

	if code == "" {
		return nil, ErrRBACRoleCodeRequired
	}
	if !rbacRoleCodePattern.MatchString(code) {
		return nil, ErrRBACRoleCodeInvalid
	}
	if name == "" {
		return nil, ErrRBACRoleNameRequired
	}
	if len(input.PermissionIDs) == 0 {
		return nil, ErrRBACPermissionRequired
	}

	var existingCount int64
	if err := s.db.Model(&rbacModels.Role{}).Where("code = ?", code).Count(&existingCount).Error; err != nil {
		return nil, err
	}
	if existingCount > 0 {
		return nil, ErrRBACRoleCodeTaken
	}

	permissionIDs, err := s.ensurePermissionIDs(input.PermissionIDs)
	if err != nil {
		return nil, err
	}

	var createdRoleID uint
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		role := &rbacModels.Role{
			Code:        code,
			Name:        name,
			Description: description,
		}
		if err := tx.Create(role).Error; err != nil {
			return err
		}
		createdRoleID = role.ID
		return s.replaceRolePermissions(tx, role.ID, permissionIDs)
	}); err != nil {
		return nil, err
	}

	return s.GetRole(createdRoleID)
}

func (s *AdminRBACService) UpdateRole(roleID uint, input UpdateRoleInput) (*RoleListItem, error) {
	name := strings.TrimSpace(input.Name)
	description := normalizeOptionalString(input.Description)
	if name == "" {
		return nil, ErrRBACRoleNameRequired
	}
	if len(input.PermissionIDs) == 0 {
		return nil, ErrRBACPermissionRequired
	}

	permissionIDs, err := s.ensurePermissionIDs(input.PermissionIDs)
	if err != nil {
		return nil, err
	}

	var role rbacModels.Role
	if err := s.db.First(&role, roleID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRBACRoleNotFound
		}
		return nil, err
	}
	if role.Code == superAdminRoleCode {
		return nil, ErrRBACRoleProtected
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&role).Updates(map[string]interface{}{
			"name":        name,
			"description": description,
		}).Error; err != nil {
			return err
		}
		return s.replaceRolePermissions(tx, role.ID, permissionIDs)
	}); err != nil {
		return nil, err
	}

	return s.GetRole(roleID)
}

func (s *AdminRBACService) GetRole(roleID uint) (*RoleListItem, error) {
	roles, err := s.ListRoles()
	if err != nil {
		return nil, err
	}
	for _, role := range roles {
		if role.ID == roleID {
			item := role
			return &item, nil
		}
	}
	return nil, ErrRBACRoleNotFound
}

func (s *AdminRBACService) ListAdminAccounts() ([]AdminAccountItem, error) {
	var admins []userModels.User
	if err := s.db.Where("role = ?", "admin").Order("created_at DESC, id DESC").Find(&admins).Error; err != nil {
		return nil, err
	}
	if len(admins) == 0 {
		return []AdminAccountItem{}, nil
	}

	userIDs := make([]uint, 0, len(admins))
	for _, admin := range admins {
		userIDs = append(userIDs, admin.ID)
	}

	var userRoles []rbacModels.UserRole
	if err := s.db.Where("user_id IN ?", userIDs).Find(&userRoles).Error; err != nil {
		return nil, err
	}

	roleIDSet := make(map[uint]struct{})
	userRoleMap := make(map[uint][]uint)
	for _, row := range userRoles {
		roleIDSet[row.RoleID] = struct{}{}
		userRoleMap[row.UserID] = append(userRoleMap[row.UserID], row.RoleID)
	}

	roleIDs := make([]uint, 0, len(roleIDSet))
	for roleID := range roleIDSet {
		roleIDs = append(roleIDs, roleID)
	}

	roleMap := make(map[uint]rbacModels.Role)
	if len(roleIDs) > 0 {
		var roles []rbacModels.Role
		if err := s.db.Where("id IN ?", roleIDs).Find(&roles).Error; err != nil {
			return nil, err
		}
		for _, role := range roles {
			roleMap[role.ID] = role
		}
	}

	result := make([]AdminAccountItem, 0, len(admins))
	for _, admin := range admins {
		roleSummaries := make([]AdminRoleSummary, 0, len(userRoleMap[admin.ID]))
		for _, roleID := range userRoleMap[admin.ID] {
			if role, ok := roleMap[roleID]; ok {
				roleSummaries = append(roleSummaries, AdminRoleSummary{
					ID:   role.ID,
					Code: role.Code,
					Name: role.Name,
				})
			}
		}
		sort.Slice(roleSummaries, func(i, j int) bool { return roleSummaries[i].Code < roleSummaries[j].Code })

		permissionKeys, err := s.rbacService.GetUserPermissions(admin.ID)
		if err != nil {
			return nil, err
		}

		result = append(result, AdminAccountItem{
			ID:          admin.ID,
			UserNo:      admin.UserNo,
			Username:    admin.Username,
			Email:       admin.Email,
			Phone:       admin.Phone,
			Status:      admin.Status,
			CreatedAt:   admin.CreatedAt,
			UpdatedAt:   admin.UpdatedAt,
			Roles:       roleSummaries,
			Permissions: permissionKeys,
		})
	}

	return result, nil
}

func (s *AdminRBACService) CreateAdminAccount(input CreateAdminInput) (*AdminAccountItem, error) {
	username := strings.TrimSpace(input.Username)
	email := strings.TrimSpace(strings.ToLower(input.Email))
	password := strings.TrimSpace(input.Password)
	phone := normalizeOptionalStringValue(input.Phone)

	if username == "" {
		return nil, ErrRBACAdminUsernameRequired
	}
	if email == "" {
		return nil, ErrRBACAdminEmailRequired
	}
	if len(password) < 6 {
		return nil, ErrRBACAdminPasswordInvalid
	}
	if len(input.RoleIDs) == 0 {
		return nil, ErrRBACAdminRolesRequired
	}

	roleIDs, err := s.ensureRoleIDs(input.RoleIDs)
	if err != nil {
		return nil, err
	}

	hashedPassword, err := hashRBACPasswordForStorage(password)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	var createdUserID uint
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var usernameCount int64
		if err := tx.Model(&userModels.User{}).Where("username = ?", username).Count(&usernameCount).Error; err != nil {
			return err
		}
		if usernameCount > 0 {
			return ErrRBACAdminUsernameTaken
		}

		var emailCount int64
		if err := tx.Model(&userModels.User{}).Where("email = ?", email).Count(&emailCount).Error; err != nil {
			return err
		}
		if emailCount > 0 {
			return ErrRBACAdminEmailTaken
		}

		admin := &userModels.User{
			UserNo:       generateRBACUserNo(tx),
			Username:     username,
			Email:        email,
			Password:     string(hashedPassword),
			Phone:        phone,
			Role:         "admin",
			Status:       "active",
			TokenBalance: 0,
		}
		if err := tx.Create(admin).Error; err != nil {
			return err
		}
		createdUserID = admin.ID
		return s.replaceUserRoles(tx, admin.ID, roleIDs)
	}); err != nil {
		return nil, err
	}

	return s.GetAdminAccount(createdUserID)
}

func (s *AdminRBACService) ListPromotableUsers(keyword string) ([]PromotableUserOption, error) {
	db := s.db.Model(&userModels.User{}).Where("role = ?", "user")

	trimmedKeyword := strings.TrimSpace(keyword)
	if trimmedKeyword != "" {
		like := "%" + strings.ToLower(trimmedKeyword) + "%"
		db = db.Where(
			"LOWER(username) LIKE ? OR LOWER(email) LIKE ? OR CAST(id AS TEXT) LIKE ? OR CAST(user_no AS TEXT) LIKE ?",
			like, like, like, like,
		)
	}

	var users []userModels.User
	if err := db.Order("created_at DESC, id DESC").Limit(20).Find(&users).Error; err != nil {
		return nil, err
	}

	result := make([]PromotableUserOption, 0, len(users))
	for _, user := range users {
		result = append(result, PromotableUserOption{
			ID:        user.ID,
			UserNo:    user.UserNo,
			Username:  user.Username,
			Email:     user.Email,
			AvatarURL: user.AvatarURL,
			Status:    user.Status,
		})
	}

	return result, nil
}

func (s *AdminRBACService) PromoteUserToAdmin(input PromoteAdminInput) (*AdminAccountItem, error) {
	if input.UserID == 0 {
		return nil, ErrRBACUserNotFound
	}
	if len(input.RoleIDs) == 0 {
		return nil, ErrRBACAdminRolesRequired
	}

	roleIDs, err := s.ensureRoleIDs(input.RoleIDs)
	if err != nil {
		return nil, err
	}

	var promotedUserID uint
	if err := s.db.Transaction(func(tx *gorm.DB) error {
		var user userModels.User
		if err := tx.First(&user, input.UserID).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrRBACUserNotFound
			}
			return err
		}
		if user.Role == "admin" {
			return ErrRBACAdminAlreadyExists
		}

		if err := tx.Model(&user).Update("role", "admin").Error; err != nil {
			return err
		}
		promotedUserID = user.ID
		return s.replaceUserRoles(tx, user.ID, roleIDs)
	}); err != nil {
		return nil, err
	}

	return s.GetAdminAccount(promotedUserID)
}

func (s *AdminRBACService) UpdateAdminRoles(operatorID, userID uint, input UpdateAdminRolesInput) (*AdminAccountItem, error) {
	if operatorID == userID {
		return nil, ErrRBACAdminSelfRoleEdit
	}
	if len(input.RoleIDs) == 0 {
		return nil, ErrRBACAdminRolesRequired
	}

	roleIDs, err := s.ensureRoleIDs(input.RoleIDs)
	if err != nil {
		return nil, err
	}

	var admin userModels.User
	if err := s.db.First(&admin, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRBACAdminNotFound
		}
		return nil, err
	}
	if admin.Role != "admin" {
		return nil, ErrRBACAdminNotFound
	}

	if err := s.db.Transaction(func(tx *gorm.DB) error {
		return s.replaceUserRoles(tx, admin.ID, roleIDs)
	}); err != nil {
		return nil, err
	}

	return s.GetAdminAccount(userID)
}

func (s *AdminRBACService) DemoteAdminToUser(operatorID, userID uint) error {
	if operatorID == userID {
		return ErrRBACAdminSelfDemote
	}

	var admin userModels.User
	if err := s.db.First(&admin, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrRBACAdminNotFound
		}
		return err
	}
	if admin.Role != "admin" {
		return ErrRBACAdminNotFound
	}

	var adminCount int64
	if err := s.db.Model(&userModels.User{}).Where("role = ?", "admin").Count(&adminCount).Error; err != nil {
		return err
	}
	if adminCount <= 1 {
		return ErrRBACAdminLastAdmin
	}

	return s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&admin).Update("role", "user").Error; err != nil {
			return err
		}
		return s.replaceUserRoles(tx, admin.ID, nil)
	})
}

func (s *AdminRBACService) UpdateAdminStatus(operatorID, userID uint, status string) (*AdminAccountItem, error) {
	normalizedStatus := strings.TrimSpace(status)
	if !isValidRBACAdminStatus(normalizedStatus) {
		return nil, ErrRBACAdminInvalidStatus
	}
	if operatorID == userID && normalizedStatus != "active" {
		return nil, ErrRBACAdminDisableSelf
	}

	var admin userModels.User
	if err := s.db.First(&admin, userID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrRBACAdminNotFound
		}
		return nil, err
	}
	if admin.Role != "admin" {
		return nil, ErrRBACAdminNotFound
	}

	if err := s.db.Model(&admin).Update("status", normalizedStatus).Error; err != nil {
		return nil, err
	}
	return s.GetAdminAccount(userID)
}

func (s *AdminRBACService) ResetAdminPassword(userID uint, password string) error {
	trimmedPassword := strings.TrimSpace(password)
	if len(trimmedPassword) < 6 {
		return ErrRBACAdminPasswordInvalid
	}

	hashedPassword, err := hashRBACPasswordForStorage(trimmedPassword)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	result := s.db.Model(&userModels.User{}).Where("id = ? AND role = ?", userID, "admin").Update("password", string(hashedPassword))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrRBACAdminNotFound
	}
	return nil
}

func (s *AdminRBACService) GetAdminAccount(userID uint) (*AdminAccountItem, error) {
	admins, err := s.ListAdminAccounts()
	if err != nil {
		return nil, err
	}
	for _, admin := range admins {
		if admin.ID == userID {
			item := admin
			return &item, nil
		}
	}
	return nil, ErrRBACAdminNotFound
}

func (s *AdminRBACService) ensurePermissionIDs(permissionIDs []uint) ([]uint, error) {
	ids := uniqueUintIDs(permissionIDs)
	if len(ids) == 0 {
		return nil, ErrRBACPermissionRequired
	}

	var count int64
	if err := s.db.Model(&rbacModels.Permission{}).Where("id IN ?", ids).Count(&count).Error; err != nil {
		return nil, err
	}
	if count != int64(len(ids)) {
		return nil, ErrRBACPermissionNotFound
	}

	return ids, nil
}

func (s *AdminRBACService) ensureRoleIDs(roleIDs []uint) ([]uint, error) {
	ids := uniqueUintIDs(roleIDs)
	if len(ids) == 0 {
		return nil, ErrRBACAdminRolesRequired
	}

	var count int64
	if err := s.db.Model(&rbacModels.Role{}).Where("id IN ?", ids).Count(&count).Error; err != nil {
		return nil, err
	}
	if count != int64(len(ids)) {
		return nil, ErrRBACRoleNotFound
	}

	return ids, nil
}

func (s *AdminRBACService) replaceRolePermissions(tx *gorm.DB, roleID uint, permissionIDs []uint) error {
	if err := tx.Where("role_id = ?", roleID).Delete(&rbacModels.RolePermission{}).Error; err != nil {
		return err
	}

	rows := make([]rbacModels.RolePermission, 0, len(permissionIDs))
	for _, permissionID := range permissionIDs {
		rows = append(rows, rbacModels.RolePermission{
			RoleID:       roleID,
			PermissionID: permissionID,
		})
	}

	return tx.Create(&rows).Error
}

func (s *AdminRBACService) replaceUserRoles(tx *gorm.DB, userID uint, roleIDs []uint) error {
	if err := tx.Where("user_id = ?", userID).Delete(&rbacModels.UserRole{}).Error; err != nil {
		return err
	}

	rows := make([]rbacModels.UserRole, 0, len(roleIDs))
	for _, roleID := range roleIDs {
		rows = append(rows, rbacModels.UserRole{
			UserID: userID,
			RoleID: roleID,
		})
	}

	if len(rows) == 0 {
		return nil
	}

	return tx.Create(&rows).Error
}

func toPermissionOption(permission rbacModels.Permission) PermissionOption {
	return PermissionOption{
		ID:          permission.ID,
		ResourceKey: permission.ResourceKey,
		Action:      permission.Action,
		Key:         permission.ResourceKey + ":" + permission.Action,
		Description: permission.Description,
	}
}

func uniqueUintIDs(values []uint) []uint {
	if len(values) == 0 {
		return nil
	}
	seen := make(map[uint]struct{}, len(values))
	result := make([]uint, 0, len(values))
	for _, value := range values {
		if value == 0 {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	sort.Slice(result, func(i, j int) bool { return result[i] < result[j] })
	return result
}

func normalizeOptionalStringValue(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func normalizeOptionalString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func isValidRBACAdminStatus(status string) bool {
	switch status {
	case "active", "inactive", "suspended":
		return true
	default:
		return false
	}
}

func hashRBACPasswordForStorage(input string) ([]byte, error) {
	return bcrypt.GenerateFromPassword([]byte(normalizeRBACPasswordDigest(input)), bcrypt.DefaultCost)
}

func normalizeRBACPasswordDigest(input string) string {
	trimmed := strings.TrimSpace(input)
	if isRBACMD5Digest(trimmed) {
		return strings.ToLower(trimmed)
	}

	sum := md5.Sum([]byte(input))
	return fmt.Sprintf("%x", sum)
}

func isRBACMD5Digest(value string) bool {
	if len(value) != 32 {
		return false
	}

	for _, ch := range value {
		if (ch < '0' || ch > '9') && (ch < 'a' || ch > 'f') && (ch < 'A' || ch > 'F') {
			return false
		}
	}

	return true
}

func generateRBACUserNo(db *gorm.DB) int64 {
	const minNo int64 = 20000000
	const maxNo int64 = 99999999

	for i := 0; i < 20; i++ {
		candidate := minNo + time.Now().UnixNano()%int64(maxNo-minNo+1) + int64(i)
		candidate = minNo + candidate%int64(maxNo-minNo+1)
		var count int64
		if err := db.Model(&userModels.User{}).Where("user_no = ?", candidate).Count(&count).Error; err == nil && count == 0 {
			return candidate
		}
	}

	var maxUserNo int64
	if err := db.Model(&userModels.User{}).Where("user_no >= ?", minNo).Select("COALESCE(MAX(user_no), 0)").Scan(&maxUserNo).Error; err == nil {
		if maxUserNo < minNo {
			return minNo
		}
		if maxUserNo+1 <= maxNo {
			return maxUserNo + 1
		}
	}

	return minNo + time.Now().UnixNano()%int64(maxNo-minNo+1)
}

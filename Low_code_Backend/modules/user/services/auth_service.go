package services

import (
	"errors"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"workflow-management-system/backend/domain/entity"
	"workflow-management-system/backend/domain/repository"
	"workflow-management-system/backend/infrastructure/jwt"
	"workflow-management-system/backend/modules/user/models"
)

var (
	ErrUserNotFound     = errors.New("user not found")
	ErrInvalidPassword  = errors.New("invalid password")
	ErrUserExists       = errors.New("user already exists")
	ErrInvalidEmail     = errors.New("invalid email format")
	ErrPasswordTooShort = errors.New("password must be at least 6 characters")
)

// AuthService 认证服务
type AuthService struct {
	userRepo repository.UserRepository
}

// NewAuthService 创建认证服务
func NewAuthService(userRepo repository.UserRepository) *AuthService {
	return &AuthService{userRepo: userRepo}
}

// RegisterRequest 注册请求
type RegisterRequest struct {
	Username string `json:"username" binding:"required,min=3,max=50"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Phone    string `json:"phone,omitempty"`
}

// LoginRequest 登录请求
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse 登录响应
type LoginResponse struct {
	Token string       `json:"token"`
	User  *models.User `json:"user"`
}

// Register 用户注册
func (s *AuthService) Register(req *RegisterRequest) (*models.User, error) {
	// 检查用户名是否已存在
	_, err := s.userRepo.FindByUsernameOrEmail(req.Username, req.Email)
	if err == nil {
		// 用户已存在
		return nil, ErrUserExists
	}
	// 如果错误是记录不存在，这是正常的，继续注册流程
	// 如果是其他错误（如数据库连接错误），需要返回
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		// 不是"记录不存在"错误，返回错误
		return nil, err
	}

	// 使用 bcrypt 加密密码（前端传来的已经是 MD5，这里再用 bcrypt 加盐）
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 创建用户领域实体
	user := &entity.User{
		Username: req.Username,
		Email:    req.Email,
		Password: string(hashedPassword),
		Role:     "user",
		Status:   "active",
	}

	if req.Phone != "" {
		user.Phone = &req.Phone
	}

	// 通过仓储创建用户
	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// 转换为持久化实体返回（保持向后兼容）
	return toPersistenceModel(user), nil
}

// Login 用户登录
func (s *AuthService) Login(req *LoginRequest) (*LoginResponse, error) {
	// 查找用户
	user, err := s.userRepo.FindByUsername(req.Username)
	if err != nil {
		return nil, ErrUserNotFound
	}

	// 检查用户状态
	if !user.IsActive() {
		return nil, errors.New("user account is inactive")
	}

	// 验证密码（前端传来的已经是 MD5，这里验证 bcrypt）
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, ErrInvalidPassword
	}

	// 更新登录信息
	now := time.Now()
	user.LastLoginAt = &now
	user.LoginCount++
	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	// 生成 JWT Token
	token, err := jwt.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, err
	}

	// 清除密码字段
	user.Password = ""

	// 转换为持久化实体返回（保持向后兼容）
	return &LoginResponse{
		Token: token,
		User:  toPersistenceModel(user),
	}, nil
}

// GetUserByID 根据 ID 获取用户
func (s *AuthService) GetUserByID(userID uint) (*models.User, error) {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return nil, ErrUserNotFound
	}

	// 清除密码字段
	user.Password = ""

	// 转换为持久化实体返回（保持向后兼容）
	return toPersistenceModel(user), nil
}

// toPersistenceModel 将领域实体转换为持久化模型（用于返回给 Controller）
func toPersistenceModel(user *entity.User) *models.User {
	return &models.User{
		ID:          user.ID,
		Username:    user.Username,
		Email:       user.Email,
		Password:    user.Password,
		Phone:       user.Phone,
		RealName:    user.RealName,
		AvatarURL:   user.AvatarURL,
		Role:        user.Role,
		Status:      user.Status,
		LastLoginAt: user.LastLoginAt,
		LastLoginIP: user.LastLoginIP,
		LoginCount:  user.LoginCount,
		CreatedAt:   user.CreatedAt,
		UpdatedAt:   user.UpdatedAt,
	}
}

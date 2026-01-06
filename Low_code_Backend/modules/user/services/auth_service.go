package services

import (
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/cache"
	"yaolight-workshop/backend/infrastructure/email"
	"yaolight-workshop/backend/infrastructure/jwt"
	"yaolight-workshop/backend/modules/user/models"
)

var (
	ErrUserNotFound        = errors.New("user not found")
	ErrInvalidPassword     = errors.New("invalid password")
	ErrUserExists          = errors.New("user already exists")
	ErrInvalidEmail        = errors.New("invalid email format")
	ErrPasswordTooShort    = errors.New("password must be at least 6 characters")
	ErrInvalidCode         = errors.New("invalid verification code")
	ErrCodeExpired         = errors.New("verification code expired")
	ErrSendTooFrequent     = errors.New("send verification code too frequent")
	ErrEmailServiceNotInit = errors.New("email service not initialized")
)

// AuthService 认证服务
type AuthService struct {
	userRepo     repository.UserRepository
	emailService *email.EmailService
	verifyCache  cache.VerificationCacheInterface
}

// NewAuthService 创建认证服务
func NewAuthService(userRepo repository.UserRepository) *AuthService {
	// 尝试使用 Redis，如果失败则降级到内存缓存
	useRedis := true // 可以从配置读取
	return &AuthService{
		userRepo:     userRepo,
		emailService: email.NewEmailService(),
		verifyCache:  cache.GetVerificationCacheService(useRedis),
	}
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

// EmailLoginRequest 邮箱验证码登录请求
type EmailLoginRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

// SendCodeRequest 发送验证码请求
type SendCodeRequest struct {
	Email string `json:"email" binding:"required,email"`
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

// SendVerificationCode 发送邮箱验证码（登录/注册通用）
func (s *AuthService) SendVerificationCode(req *SendCodeRequest) error {
	// 检查发送频率
	canSend, err := s.verifyCache.CheckRateLimit(req.Email)
	if err != nil {
		return err
	}
	if !canSend {
		remaining, _ := s.verifyCache.GetRemainingTime(req.Email)
		return fmt.Errorf("发送太频繁，请%d秒后再试", remaining)
	}

	// 不再检查邮箱是否已注册，支持自动注册

	// 生成验证码
	code := s.verifyCache.GenerateCode()

	// 发送邮件
	if err := s.emailService.SendVerificationCode(req.Email, code); err != nil {
		log.Printf("发送验证码邮件失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}

	// 保存验证码到缓存
	if err := s.verifyCache.Set(req.Email, code); err != nil {
		return err
	}

	// 设置发送频率限制
	if err := s.verifyCache.SetRateLimit(req.Email); err != nil {
		log.Printf("设置频率限制失败: %v", err)
	}

	return nil
}

// SendRegisterCode 发送注册验证码（注册用）
func (s *AuthService) SendRegisterCode(req *SendCodeRequest) error {
	// 检查发送频率
	canSend, err := s.verifyCache.CheckRateLimit(req.Email)
	if err != nil {
		return err
	}
	if !canSend {
		remaining, _ := s.verifyCache.GetRemainingTime(req.Email)
		return fmt.Errorf("发送太频繁，请%d秒后再试", remaining)
	}

	// 检查邮箱是否已注册
	_, err = s.userRepo.FindByUsernameOrEmail("", req.Email)
	if err == nil {
		// 邮箱已存在
		return errors.New("该邮箱已注册，请直接登录")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 生成验证码
	code := s.verifyCache.GenerateCode()

	// 发送邮件
	if err := s.emailService.SendVerificationCode(req.Email, code); err != nil {
		log.Printf("发送验证码邮件失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}

	// 保存验证码到缓存
	if err := s.verifyCache.Set(req.Email, code); err != nil {
		return err
	}

	// 设置发送频率限制
	if err := s.verifyCache.SetRateLimit(req.Email); err != nil {
		log.Printf("设置频率限制失败: %v", err)
	}

	return nil
}

// EmailLogin 邮箱验证码登录（如果邮箱未注册则自动注册）
func (s *AuthService) EmailLogin(req *EmailLoginRequest) (*LoginResponse, error) {
	// 验证验证码
	isValid, err := s.verifyCache.Verify(req.Email, req.Code)
	if err != nil {
		return nil, err
	}
	if !isValid {
		return nil, ErrInvalidCode
	}

	// 查找用户
	user, err := s.userRepo.FindByUsernameOrEmail("", req.Email)

	// 如果用户不存在，自动注册
	if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
		// 生成随机用户名
		username := generateRandomUsername()

		// 创建新用户
		user = &entity.User{
			Username: username,
			Email:    req.Email,
			Password: "", // 邮箱注册无密码
			Role:     "user",
			Status:   "active",
		}

		// 创建用户
		if err := s.userRepo.Create(user); err != nil {
			return nil, fmt.Errorf("自动注册失败: %v", err)
		}

		log.Printf("用户自动注册成功: %s (%s)", user.Username, user.Email)
	} else if err != nil {
		// 其他数据库错误
		return nil, err
	}

	// 检查用户状态
	if !user.IsActive() {
		return nil, errors.New("user account is inactive")
	}

	// 删除已使用的验证码
	if err := s.verifyCache.Delete(req.Email); err != nil {
		log.Printf("删除验证码失败: %v", err)
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

	// 转换为持久化实体返回
	return &LoginResponse{
		Token: token,
		User:  toPersistenceModel(user),
	}, nil
}

// EmailRegister 邮箱验证码注册
func (s *AuthService) EmailRegister(req *EmailLoginRequest) (*LoginResponse, error) {
	// 验证验证码
	isValid, err := s.verifyCache.Verify(req.Email, req.Code)
	if err != nil {
		return nil, err
	}
	if !isValid {
		return nil, ErrInvalidCode
	}

	// 检查邮箱是否已注册
	_, err = s.userRepo.FindByUsernameOrEmail("", req.Email)
	if err == nil {
		return nil, ErrUserExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// 生成随机用户名
	username := generateRandomUsername()

	// 创建用户（无需密码）
	user := &entity.User{
		Username: username,
		Email:    req.Email,
		Password: "", // 邮箱注册无密码
		Role:     "user",
		Status:   "active",
	}

	// 通过仓储创建用户
	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// 删除已使用的验证码
	if err := s.verifyCache.Delete(req.Email); err != nil {
		log.Printf("删除验证码失败: %v", err)
	}

	// 更新登录信息
	now := time.Now()
	user.LastLoginAt = &now
	user.LoginCount = 1
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

	// 转换为持久化实体返回
	return &LoginResponse{
		Token: token,
		User:  toPersistenceModel(user),
	}, nil
}

// generateRandomUsername 生成随机用户名
func generateRandomUsername() string {
	rand.Seed(time.Now().UnixNano())
	// 生成格式：user_123456
	return fmt.Sprintf("user_%d", rand.Intn(900000)+100000)
}

// UpdateUsername 修改用户名
func (s *AuthService) UpdateUsername(userID uint, newUsername string) error {
	// 检查用户名长度
	if len(newUsername) < 3 || len(newUsername) > 50 {
		return errors.New("用户名长度必须在3-50个字符之间")
	}

	// 检查用户名是否已存在
	_, err := s.userRepo.FindByUsername(newUsername)
	if err == nil {
		return errors.New("该用户名已被使用")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// 获取用户
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}

	// 更新用户名
	user.Username = newUsername
	return s.userRepo.Update(user)
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

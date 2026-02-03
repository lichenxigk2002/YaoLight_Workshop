package services

import (
	"errors"
	"fmt"
	"io"
	"log"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/cache"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/email"
	"yaolight-workshop/backend/infrastructure/jwt"
	"yaolight-workshop/backend/infrastructure/shared"
	userModels "yaolight-workshop/backend/modules/user/models"
	"yaolight-workshop/backend/modules/user/repositories"
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
	userRepo         repository.UserRepository
	oauthBindingRepo *repositories.OAuthBindingRepository
	emailService     *email.EmailService
	verifyCache      cache.VerificationCacheInterface
}

// NewAuthService 创建认证服务
func NewAuthService(userRepo repository.UserRepository, oauthBindingRepo *repositories.OAuthBindingRepository) *AuthService {
	// 尝试使用 Redis，如果失败则降级到内存缓存
	useRedis := true // 可以从配置读取
	return &AuthService{
		userRepo:         userRepo,
		oauthBindingRepo: oauthBindingRepo,
		emailService:     email.NewEmailService(),
		verifyCache:      cache.GetVerificationCacheService(useRedis),
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
	Token string           `json:"token"`
	User  *userModels.User `json:"user"`
}

// Register 用户注册
func (s *AuthService) Register(req *RegisterRequest) (*userModels.User, error) {
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
	// 注册赠送200万星尘
	const registerBonusStardust = 2000000 // 200万星尘
	user := &entity.User{
		Username:     req.Username,
		Email:        req.Email,
		Password:     string(hashedPassword),
		Role:         "user",
		Status:       "active",
		TokenBalance: registerBonusStardust, // 注册赠送200万星尘
	}

	if req.Phone != "" {
		user.Phone = &req.Phone
	}

	// 通过仓储创建用户
	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// 记录注册赠送星尘的流水
	transaction := userModels.TokenTransaction{
		UserID:      user.ID,
		Amount:      registerBonusStardust, // 增加星尘
		Type:        "bonus",               // 类型：奖励/赠送
		RelatedID:   fmt.Sprintf("register_%d", user.ID),
		Description: "注册赠送200万星尘",
		Cost:        0, // 赠送无费用
		Currency:    "CNY",
	}
	if err := database.DB.Create(&transaction).Error; err != nil {
		// 记录流水失败不影响注册流程，只记录日志
		log.Printf("⚠️ Failed to create register bonus transaction for user %d: %v", user.ID, err)
	} else {
		log.Printf("✅ Registered user %d (%s) with 2,000,000 stardust bonus", user.ID, user.Username)
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
func (s *AuthService) GetUserByID(userID uint) (*userModels.User, error) {
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
		// 注册赠送200万星尘
		const registerBonusStardust = 2000000 // 200万星尘
		user = &entity.User{
			Username:     username,
			Email:        req.Email,
			Password:     "", // 邮箱注册无密码
			Role:         "user",
			Status:       "active",
			TokenBalance: registerBonusStardust, // 注册赠送200万星尘
		}

		// 创建用户
		if err := s.userRepo.Create(user); err != nil {
			return nil, fmt.Errorf("自动注册失败: %v", err)
		}

		// 记录注册赠送星尘的流水
		transaction := userModels.TokenTransaction{
			UserID:      user.ID,
			Amount:      registerBonusStardust, // 增加星尘
			Type:        "bonus",               // 类型：奖励/赠送
			RelatedID:   fmt.Sprintf("email_login_%d", user.ID),
			Description: "注册赠送200万星尘",
			Cost:        0, // 赠送无费用
			Currency:    "CNY",
		}
		if err := database.DB.Create(&transaction).Error; err != nil {
			log.Printf("⚠️ Failed to create register bonus transaction for user %d: %v", user.ID, err)
		} else {
			log.Printf("✅ Registered user %d (%s) with 2,000,000 stardust bonus via email login", user.ID, user.Username)
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
	// 注册赠送200万星尘
	const registerBonusStardust = 2000000 // 200万星尘
	user := &entity.User{
		Username:     username,
		Email:        req.Email,
		Password:     "", // 邮箱注册无密码
		Role:         "user",
		Status:       "active",
		TokenBalance: registerBonusStardust, // 注册赠送200万星尘
	}

	// 通过仓储创建用户
	if err := s.userRepo.Create(user); err != nil {
		return nil, err
	}

	// 记录注册赠送星尘的流水
	transaction := userModels.TokenTransaction{
		UserID:      user.ID,
		Amount:      registerBonusStardust, // 增加星尘
		Type:        "bonus",               // 类型：奖励/赠送
		RelatedID:   fmt.Sprintf("email_register_%d", user.ID),
		Description: "注册赠送200万星尘",
		Cost:        0, // 赠送无费用
		Currency:    "CNY",
	}
	if err := database.DB.Create(&transaction).Error; err != nil {
		log.Printf("⚠️ Failed to create register bonus transaction for user %d: %v", user.ID, err)
	} else {
		log.Printf("✅ Registered user %d (%s) with 2,000,000 stardust bonus via email register", user.ID, user.Username)
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

// OAuthLogin 第三方登录：按 provider+oauth_id 或 email 查找/创建用户，返回 JWT
func (s *AuthService) OAuthLogin(provider, oauthID, email, name, avatarURL string) (*LoginResponse, error) {
	if provider == "" || oauthID == "" {
		return nil, errors.New("invalid oauth provider or id")
	}
	// 邮箱为空时用占位（如 GitHub 未公开邮箱）
	if email == "" {
		email = fmt.Sprintf("%s_%s@oauth.local", provider, oauthID)
	}
	// 用户名：优先用 name，否则生成
	username := name
	if username == "" {
		username = generateRandomUsername()
	}
	// 限制长度
	if len(username) > 50 {
		username = username[:50]
	}

	var user *entity.User
	var err error
	// 1) 优先按 user_oauth_bindings 表查找（支持多平台绑定）
	if uid, ok := s.oauthBindingRepo.FindUserID(provider, oauthID); ok {
		user, err = s.userRepo.FindByID(uid)
		if err != nil {
			return nil, err
		}
		if avatarURL != "" && !hasLocalAvatar(user.AvatarURL) {
			if localPath, e := saveOAuthAvatarToLocal(avatarURL, user.ID); e == nil {
				user.AvatarURL = &localPath
			} else {
				log.Printf("save oauth avatar to local failed: %v", e)
			}
		}
	} else {
		// 2) 按邮箱查找（同邮箱则写入绑定表）
		user, err = s.userRepo.FindByUsernameOrEmail("", email)
		if err == nil {
			if err := s.oauthBindingRepo.Add(user.ID, provider, oauthID); err != nil {
				return nil, err
			}
			if avatarURL != "" && !hasLocalAvatar(user.AvatarURL) {
				if localPath, e := saveOAuthAvatarToLocal(avatarURL, user.ID); e == nil {
					user.AvatarURL = &localPath
					_ = s.userRepo.Update(user)
				} else {
					log.Printf("save oauth avatar to local failed: %v", e)
				}
			}
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		} else {
			// 3) 新用户：创建用户并写入绑定表
			for {
				_, err = s.userRepo.FindByUsername(username)
				if err != nil && errors.Is(err, gorm.ErrRecordNotFound) {
					break
				}
				if err != nil {
					return nil, err
				}
				username = generateRandomUsername()
			}
			const registerBonusStardust = 2000000
			user = &entity.User{
				Username:     username,
				Email:        email,
				Password:     "",
				Role:         "user",
				Status:       "active",
				TokenBalance: registerBonusStardust,
			}
			if err := s.userRepo.Create(user); err != nil {
				return nil, err
			}
			if err := s.oauthBindingRepo.Add(user.ID, provider, oauthID); err != nil {
				return nil, err
			}
			if avatarURL != "" {
				if localPath, e := saveOAuthAvatarToLocal(avatarURL, user.ID); e == nil {
					user.AvatarURL = &localPath
					_ = s.userRepo.Update(user)
				} else {
					log.Printf("save oauth avatar to local failed: %v", e)
				}
			}
			transaction := userModels.TokenTransaction{
				UserID:      user.ID,
				Amount:      registerBonusStardust,
				Type:        "bonus",
				RelatedID:   fmt.Sprintf("oauth_%s_%d", provider, user.ID),
				Description: "OAuth 注册赠送200万星尘",
				Cost:        0,
				Currency:    "CNY",
			}
			_ = database.DB.Create(&transaction).Error
		}
	}

	if !user.IsActive() {
		return nil, errors.New("user account is inactive")
	}

	now := time.Now()
	user.LastLoginAt = &now
	user.LoginCount++
	if err := s.userRepo.Update(user); err != nil {
		return nil, err
	}

	token, err := jwt.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		return nil, err
	}
	user.Password = ""
	return &LoginResponse{
		Token: token,
		User:  toPersistenceModel(user),
	}, nil
}

// hasLocalAvatar 判断是否已是本地头像（非第三方外链）。
// 包含：OAuth 导入后保存的本地路径、以及用户自定义上传的头像；有则不再用 OAuth 头像覆盖。
func hasLocalAvatar(avatarURL *string) bool {
	if avatarURL == nil || *avatarURL == "" {
		return false
	}
	return !strings.HasPrefix(*avatarURL, "http://") && !strings.HasPrefix(*avatarURL, "https://")
}

// saveOAuthAvatarToLocal 从 OAuth 头像 URL 下载并保存到本地，返回相对路径 avatars/xxx
func saveOAuthAvatarToLocal(imageURL string, userID uint) (relativePath string, err error) {
	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Get(imageURL)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("avatar url returned %d", resp.StatusCode)
	}
	ct := resp.Header.Get("Content-Type")
	if !strings.HasPrefix(ct, "image/") {
		return "", fmt.Errorf("not an image: %s", ct)
	}
	const maxSize = 5 * 1024 * 1024 // 5MB
	body := io.LimitReader(resp.Body, maxSize+1)
	data, err := io.ReadAll(body)
	if err != nil {
		return "", err
	}
	if len(data) > maxSize {
		return "", fmt.Errorf("image too large")
	}
	ext := ".jpg"
	switch {
	case strings.Contains(ct, "png"):
		ext = ".png"
	case strings.Contains(ct, "gif"):
		ext = ".gif"
	case strings.Contains(ct, "webp"):
		ext = ".webp"
	}
	uploadDir := filepath.Join(config.UploadPath, "avatars")
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", err
	}
	filename := fmt.Sprintf("%d_%d%s", userID, time.Now().Unix(), ext)
	fullPath := filepath.Join(uploadDir, filename)
	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		return "", err
	}
	return filepath.Join("avatars", filename), nil
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

// GetOAuthBindings 返回当前用户 GitHub/Google 绑定状态（基于 user_oauth_bindings 表，支持多平台同时绑定）
func (s *AuthService) GetOAuthBindings(userID uint) (githubBound, googleBound bool, err error) {
	providers, err := s.oauthBindingRepo.GetByUser(userID)
	if err != nil {
		return false, false, err
	}
	for _, p := range providers {
		switch p {
		case "github":
			githubBound = true
		case "google":
			googleBound = true
		}
	}
	return githubBound, googleBound, nil
}

// OAuthBind 将已登录用户绑定指定第三方（写入 user_oauth_bindings，可同时绑定多个；可选更新头像）
func (s *AuthService) OAuthBind(userID uint, provider, oauthID, email, name, avatarURL string) error {
	if err := s.oauthBindingRepo.Add(userID, provider, oauthID); err != nil {
		return err
	}
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return err
	}
	if avatarURL != "" && !hasLocalAvatar(user.AvatarURL) {
		if localPath, err := saveOAuthAvatarToLocal(avatarURL, user.ID); err == nil {
			user.AvatarURL = &localPath
			_ = s.userRepo.Update(user)
		}
	}
	return nil
}

// UnbindOAuth 解绑指定第三方（从 user_oauth_bindings 中删除该 provider）
func (s *AuthService) UnbindOAuth(userID uint, provider string) error {
	return s.oauthBindingRepo.Remove(userID, provider)
}

// --- 账号注销（确认 + 邮箱验证码）---

const cacheKeyDeactivatePrefix = "deactivate:"
const cacheKeyEmailChangePrefix = "email_change:"
const cacheKeyEmailChangeNewPrefix = "email_change_new:" // 换绑：验证码发到新邮箱
const cacheKeyEmailBindNewPrefix = "email_bind_new:"
const cacheKeyEmailUnbindPrefix = "email_unbind:"

// SendDeactivateCode 发送注销验证码到当前用户邮箱
func (s *AuthService) SendDeactivateCode(userID uint) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.Email == "" || strings.HasPrefix(user.Email, "unbound_") {
		return errors.New("当前账号未绑定有效邮箱，无法发送验证码")
	}
	key := cacheKeyDeactivatePrefix + user.Email
	canSend, err := s.verifyCache.CheckRateLimit(key)
	if err != nil {
		return err
	}
	if !canSend {
		remaining, _ := s.verifyCache.GetRemainingTime(key)
		return fmt.Errorf("发送太频繁，请%d秒后再试", remaining)
	}
	code := s.verifyCache.GenerateCode()
	if err := s.emailService.SendVerificationCode(user.Email, code); err != nil {
		log.Printf("发送注销验证码失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}
	if err := s.verifyCache.Set(key, code); err != nil {
		return err
	}
	if err := s.verifyCache.SetRateLimit(key); err != nil {
		log.Printf("设置频率限制失败: %v", err)
	}
	return nil
}

// ConfirmDeactivate 校验验证码与确认文案后软删除账号（GitHub 风格：需输入用户名确认）
func (s *AuthService) ConfirmDeactivate(userID uint, code, confirmText string) error {
	if strings.TrimSpace(confirmText) == "" {
		return errors.New("请输入确认内容（当前用户名）")
	}
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.Email == "" || strings.HasPrefix(user.Email, "unbound_") {
		return errors.New("当前账号未绑定有效邮箱")
	}
	key := cacheKeyDeactivatePrefix + user.Email
	ok, err := s.verifyCache.Verify(key, code)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidCode
	}
	if confirmText != user.Username {
		return errors.New("确认内容与当前用户名不一致，请重新输入")
	}
	_ = s.verifyCache.Delete(key)
	return s.userRepo.Delete(userID)
}

// --- 邮箱换绑（验证码验证当前邮箱后更换为新邮箱）---

// SendEmailBindCode 发送绑定邮箱验证码到新邮箱（当前未绑定时使用）
func (s *AuthService) SendEmailBindCode(userID uint, newEmail string) error {
	newEmail = strings.TrimSpace(strings.ToLower(newEmail))
	if newEmail == "" || !strings.Contains(newEmail, "@") {
		return ErrInvalidEmail
	}
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.Email != "" && !strings.HasPrefix(user.Email, "unbound_") {
		return errors.New("当前已绑定邮箱，请使用换绑")
	}
	// 新邮箱已被其他用户使用则不允许（用 Count 检查，避免 First 产生 record not found 日志）
	taken, err := s.userRepo.EmailTakenByOther(newEmail, userID)
	if err != nil {
		return err
	}
	if taken {
		return errors.New("该邮箱已被其他账号使用")
	}
	key := cacheKeyEmailBindNewPrefix + newEmail
	canSend, err := s.verifyCache.CheckRateLimit(key)
	if err != nil {
		return err
	}
	if !canSend {
		remaining, _ := s.verifyCache.GetRemainingTime(key)
		return fmt.Errorf("发送太频繁，请%d秒后再试", remaining)
	}
	code := s.verifyCache.GenerateCode()
	if err := s.emailService.SendVerificationCode(newEmail, code); err != nil {
		log.Printf("发送绑定邮箱验证码失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}
	if err := s.verifyCache.Set(key, code); err != nil {
		return err
	}
	if err := s.verifyCache.SetRateLimit(key); err != nil {
		log.Printf("设置频率限制失败: %v", err)
	}
	return nil
}

// SendEmailChangeCodeToNew 发送换绑验证码到新邮箱（换绑时向新邮箱发验证码）
func (s *AuthService) SendEmailChangeCodeToNew(userID uint, newEmail string) error {
	newEmail = strings.TrimSpace(strings.ToLower(newEmail))
	if newEmail == "" || !strings.Contains(newEmail, "@") {
		return ErrInvalidEmail
	}
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.Email == "" || strings.HasPrefix(user.Email, "unbound_") {
		return errors.New("当前账号未绑定有效邮箱，请使用绑定邮箱")
	}
	taken, err := s.userRepo.EmailTakenByOther(newEmail, userID)
	if err != nil {
		return err
	}
	if taken {
		return errors.New("该邮箱已被其他账号使用")
	}
	key := cacheKeyEmailChangeNewPrefix + newEmail
	canSend, err := s.verifyCache.CheckRateLimit(key)
	if err != nil {
		return err
	}
	if !canSend {
		remaining, _ := s.verifyCache.GetRemainingTime(key)
		return fmt.Errorf("发送太频繁，请%d秒后再试", remaining)
	}
	code := s.verifyCache.GenerateCode()
	if err := s.emailService.SendVerificationCode(newEmail, code); err != nil {
		log.Printf("发送换绑验证码到新邮箱失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}
	if err := s.verifyCache.Set(key, code); err != nil {
		return err
	}
	if err := s.verifyCache.SetRateLimit(key); err != nil {
		log.Printf("设置频率限制失败: %v", err)
	}
	return nil
}

// ConfirmEmailChange 校验验证码后将当前用户邮箱更新为新邮箱（支持换绑与未绑定时绑定）
func (s *AuthService) ConfirmEmailChange(userID uint, code, newEmail string) error {
	newEmail = strings.TrimSpace(strings.ToLower(newEmail))
	if newEmail == "" {
		return ErrInvalidEmail
	}
	if !strings.Contains(newEmail, "@") {
		return ErrInvalidEmail
	}
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	var key string
	if user.Email == "" || strings.HasPrefix(user.Email, "unbound_") {
		key = cacheKeyEmailBindNewPrefix + newEmail
	} else {
		key = cacheKeyEmailChangeNewPrefix + newEmail
	}
	ok, err := s.verifyCache.Verify(key, code)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidCode
	}
	taken, err := s.userRepo.EmailTakenByOther(newEmail, userID)
	if err != nil {
		return err
	}
	if taken {
		return errors.New("该邮箱已被其他账号使用")
	}
	_ = s.verifyCache.Delete(key)
	user.Email = newEmail
	return s.userRepo.Update(user)
}

// --- 邮箱解绑（验证码验证后置为未绑定，需至少保留一种登录方式）---

// SendEmailUnbindCode 发送解绑邮箱验证码到当前邮箱
func (s *AuthService) SendEmailUnbindCode(userID uint) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	if user.Email == "" || strings.HasPrefix(user.Email, "unbound_") {
		return errors.New("当前账号未绑定邮箱，无需解绑")
	}
	providers, _ := s.oauthBindingRepo.GetByUser(userID)
	hasPassword := user.Password != ""
	if !hasPassword && len(providers) == 0 {
		return errors.New("解绑邮箱后将无法登录，请先绑定第三方账号或设置密码")
	}
	key := cacheKeyEmailUnbindPrefix + fmt.Sprintf("%d", userID)
	canSend, err := s.verifyCache.CheckRateLimit(key)
	if err != nil {
		return err
	}
	if !canSend {
		remaining, _ := s.verifyCache.GetRemainingTime(key)
		return fmt.Errorf("发送太频繁，请%d秒后再试", remaining)
	}
	code := s.verifyCache.GenerateCode()
	if err := s.emailService.SendVerificationCode(user.Email, code); err != nil {
		log.Printf("发送解绑验证码失败: %v", err)
		return errors.New("发送验证码失败，请稍后重试")
	}
	if err := s.verifyCache.Set(key, code); err != nil {
		return err
	}
	if err := s.verifyCache.SetRateLimit(key); err != nil {
		log.Printf("设置频率限制失败: %v", err)
	}
	return nil
}

// ConfirmEmailUnbind 校验验证码后解绑邮箱（置为占位邮箱）
func (s *AuthService) ConfirmEmailUnbind(userID uint, code string) error {
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}
	key := cacheKeyEmailUnbindPrefix + fmt.Sprintf("%d", userID)
	ok, err := s.verifyCache.Verify(key, code)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidCode
	}
	_ = s.verifyCache.Delete(key)
	user.Email = fmt.Sprintf("unbound_%d@local", userID)
	return s.userRepo.Update(user)
}

// UpdateAvatar 更新用户头像
func (s *AuthService) UpdateAvatar(userID uint, avatarPath string) error {
	// 获取用户
	user, err := s.userRepo.FindByID(userID)
	if err != nil {
		return ErrUserNotFound
	}

	// 更新头像路径
	user.AvatarURL = &avatarPath
	return s.userRepo.Update(user)
}

// toPersistenceModel 将领域实体转换为持久化模型（用于返回给 Controller）
func toPersistenceModel(user *entity.User) *userModels.User {
	return &userModels.User{
		ID:           user.ID,
		Username:     user.Username,
		Email:        user.Email,
		Password:     user.Password,
		Phone:        user.Phone,
		RealName:     user.RealName,
		AvatarURL:    user.AvatarURL,
		Role:         user.Role,
		Status:       user.Status,
		LastLoginAt:  user.LastLoginAt,
		LastLoginIP:  user.LastLoginIP,
		LoginCount:   user.LoginCount,
		TokenBalance: user.TokenBalance,
		CreatedAt:    user.CreatedAt,
		UpdatedAt:    user.UpdatedAt,
	}
}

// NotificationPrefs 通知偏好：类型 -> 是否开启（新用户默认全开）
var DefaultNotificationPrefs = map[string]bool{
	"task_completed": true,
}

// GetNotificationPreferences 获取当前用户的通知偏好，未设置的项默认 true
func (s *AuthService) GetNotificationPreferences(userID uint) (map[string]bool, error) {
	var user userModels.User
	if err := database.DB.Select("id", "preferences").First(&user, userID).Error; err != nil {
		return nil, ErrUserNotFound
	}
	out := make(map[string]bool)
	for k, v := range DefaultNotificationPrefs {
		out[k] = v
	}
	if user.Preferences.Data == nil {
		return out, nil
	}
	prefs, ok := user.Preferences.Data.(map[string]interface{})
	if !ok {
		return out, nil
	}
	notifications, ok := prefs["notifications"].(map[string]interface{})
	if !ok {
		return out, nil
	}
	for k, v := range notifications {
		if b, ok := v.(bool); ok {
			out[k] = b
		}
	}
	return out, nil
}

// UpdateNotificationPreferences 更新通知偏好（只更新传入的项，其余保持）
func (s *AuthService) UpdateNotificationPreferences(userID uint, prefs map[string]bool) error {
	var user userModels.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		return ErrUserNotFound
	}
	var prefsMap map[string]interface{}
	if user.Preferences.Data != nil {
		if m, ok := user.Preferences.Data.(map[string]interface{}); ok {
			prefsMap = m
		}
	}
	if prefsMap == nil {
		prefsMap = make(map[string]interface{})
	}
	notifications, _ := prefsMap["notifications"].(map[string]interface{})
	if notifications == nil {
		notifications = make(map[string]interface{})
	}
	for k, v := range prefs {
		notifications[k] = v
	}
	prefsMap["notifications"] = notifications
	user.Preferences = shared.JSONB{Data: prefsMap}
	return database.DB.Model(&user).Update("preferences", user.Preferences).Error
}

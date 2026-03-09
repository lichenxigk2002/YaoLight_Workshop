package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/modules/user/repositories"
	userModels "yaolight-workshop/backend/modules/user/models"
)

const inviteBonusStardust = 200000 // 邀请奖励：20万星尘

// InvitationService 邀请服务
type InvitationService struct {
	inviteRepo *repositories.InvitationRepository
}

// NewInvitationService 创建邀请服务
func NewInvitationService() *InvitationService {
	return &InvitationService{
		inviteRepo: repositories.NewInvitationRepository(database.DB),
	}
}

// generateInviteCode 生成8位随机邀请码
func generateInviteCode() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)[:8]
}

// GetInviteLink 获取或生成用户的专属邀请链接
func (s *InvitationService) GetInviteLink(userID uint, baseURL string) (string, string, error) {
	code, err := s.inviteRepo.GetOrCreateInviteCode(userID, generateInviteCode)
	if err != nil {
		return "", "", err
	}
	inviteURL := fmt.Sprintf("%s/login?invite=%s", baseURL, code)
	return code, inviteURL, nil
}

// ProcessInviteReward 处理邀请奖励：给邀请人增加20万星尘，写流水，创建邀请记录
// 在注册事务成功后调用，inviterID 必须有效且不等于 inviteeID
func (s *InvitationService) ProcessInviteReward(tx *gorm.DB, inviterID, inviteeID uint, inviteCode string) error {
	if inviterID == 0 || inviterID == inviteeID {
		return nil
	}
	// 1. 增加邀请人星尘余额
	if err := tx.Model(&userModels.User{}).Where("id = ?", inviterID).
		Update("token_balance", gorm.Expr("token_balance + ?", inviteBonusStardust)).Error; err != nil {
		return fmt.Errorf("增加邀请人余额失败: %w", err)
	}
	// 2. 创建邀请人流水（收入）
	transaction := userModels.TokenTransaction{
		UserID:       inviterID,
		Amount:       inviteBonusStardust,
		Type:         "bonus",
		RelatedID:    fmt.Sprintf("invite_%d", inviteeID),
		Description:  "邀请新用户",
		TotalTokens:  int(inviteBonusStardust),
		Cost:         0,
		Currency:     "CNY",
	}
	if err := tx.Create(&transaction).Error; err != nil {
		return fmt.Errorf("创建邀请流水失败: %w", err)
	}
	// 3. 创建邀请记录
	if err := tx.Create(&userModels.UserInvitation{
		InviterID:  inviterID,
		InviteeID:  inviteeID,
		InviteCode: inviteCode,
	}).Error; err != nil {
		return fmt.Errorf("创建邀请记录失败: %w", err)
	}
	log.Printf("✅ 邀请奖励成功: 用户 %d 邀请用户 %d，获得 %d 星尘", inviterID, inviteeID, inviteBonusStardust)
	return nil
}

// GetInviterID 根据邀请码获取邀请人ID，无效返回0
func (s *InvitationService) GetInviterID(inviteCode string) uint {
	if inviteCode == "" {
		return 0
	}
	id, err := s.inviteRepo.GetInviterIDByCode(inviteCode)
	if err != nil {
		return 0
	}
	return id
}

// GetInviteCount 获取已邀请人数
func (s *InvitationService) GetInviteCount(inviterID uint) (int64, error) {
	return s.inviteRepo.GetInviteCount(inviterID)
}

// InviteRecord 邀请记录（含被邀请人信息）
type InviteRecord struct {
	ID         uint   `json:"id"`
	InviteeID  uint   `json:"invitee_id"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	InviteCode string `json:"invite_code"`
	CreatedAt  string `json:"created_at"`
}

// GetInvitationList 获取邀请记录列表（含被邀请人用户名、邮箱）
func (s *InvitationService) GetInvitationList(inviterID uint, page, pageSize int) ([]InviteRecord, int64, error) {
	list, total, err := s.inviteRepo.GetInvitationList(inviterID, page, pageSize)
	if err != nil {
		return nil, 0, err
	}
	records := make([]InviteRecord, 0, len(list))
	for _, inv := range list {
		var u userModels.User
		_ = database.DB.Select("username", "email").First(&u, inv.InviteeID).Error
		records = append(records, InviteRecord{
			ID:         inv.ID,
			InviteeID:  inv.InviteeID,
			Username:   u.Username,
			Email:      u.Email,
			InviteCode: inv.InviteCode,
			CreatedAt:  inv.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	return records, total, nil
}

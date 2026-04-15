package repositories

import (
	"errors"

	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/user/models"
)

// InvitationRepository 邀请相关仓储
type InvitationRepository struct {
	db *gorm.DB
}

// NewInvitationRepository 创建邀请仓储
func NewInvitationRepository(db *gorm.DB) *InvitationRepository {
	return &InvitationRepository{db: db}
}

// GetOrCreateInviteCode 获取或创建用户的邀请码
func (r *InvitationRepository) GetOrCreateInviteCode(userID uint, generateCode func() string) (string, error) {
	var code models.UserInviteCode
	err := r.db.Where("user_id = ?", userID).First(&code).Error
	if err == nil {
		return code.Code, nil
	}
	if err != gorm.ErrRecordNotFound {
		return "", err
	}
	// 创建新邀请码（最多重试10次避免唯一冲突）
	for i := 0; i < 10; i++ {
		code = models.UserInviteCode{
			UserID: userID,
			Code:   generateCode(),
		}
		if err := r.db.Create(&code).Error; err == nil {
			return code.Code, nil
		}
	}
	return "", errors.New("生成邀请码失败，请重试")
}

// GetInviterIDByCode 根据邀请码获取邀请人ID
func (r *InvitationRepository) GetInviterIDByCode(code string) (uint, error) {
	var c models.UserInviteCode
	if err := r.db.Where("code = ?", code).First(&c).Error; err != nil {
		return 0, err
	}
	return c.UserID, nil
}

// CreateInvitation 创建邀请记录
func (r *InvitationRepository) CreateInvitation(inviterID, inviteeID uint, inviteCode string) error {
	return r.db.Create(&models.UserInvitation{
		InviterID:  inviterID,
		InviteeID:  inviteeID,
		InviteCode: inviteCode,
	}).Error
}

// GetInviteCount 获取用户已邀请人数
func (r *InvitationRepository) GetInviteCount(inviterID uint) (int64, error) {
	var count int64
	err := r.db.Model(&models.UserInvitation{}).Where("inviter_id = ?", inviterID).Count(&count).Error
	return count, err
}

// GetInvitationList 获取邀请记录列表（分页）
func (r *InvitationRepository) GetInvitationList(inviterID uint, page, pageSize int) ([]models.UserInvitation, int64, error) {
	var list []models.UserInvitation
	var total int64
	if err := r.db.Model(&models.UserInvitation{}).Where("inviter_id = ?", inviterID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	offset := (page - 1) * pageSize
	if offset < 0 {
		offset = 0
	}
	err := r.db.Where("inviter_id = ?", inviterID).Order("created_at DESC").
		Offset(offset).Limit(pageSize).Find(&list).Error
	return list, total, err
}

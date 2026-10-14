package services

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	interactionModels "yaolight-workshop/backend/modules/interaction/models"
	notificationModule "yaolight-workshop/backend/modules/notification"
	notificationServices "yaolight-workshop/backend/modules/notification/services"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var (
	ErrInvalidResource         = errors.New("invalid interaction resource")
	ErrCommentNotFound         = errors.New("comment not found")
	ErrCommentForbidden        = errors.New("comment operation forbidden")
	ErrCommentContentEmpty     = errors.New("comment content is empty")
	ErrInvalidModerationAction = errors.New("invalid moderation action")
)

var validResourceTypePattern = regexp.MustCompile(`^[a-z][a-z0-9_]{1,79}$`)

type InteractionService struct {
	db *gorm.DB
}

type commentRow struct {
	interactionModels.ResourceComment
	Username  string  `gorm:"column:username"`
	AvatarURL *string `gorm:"column:avatar_url"`
}

type CreateCommentRequest struct {
	ParentID    *uint  `json:"parentId"`
	Content     string `json:"content"`
	Location    string `json:"location"`
	DeviceModel string `json:"deviceModel"`
}

type ToggleReactionRequest struct {
	Emoji string `json:"emoji"`
}

type LikeSummary struct {
	Count int64 `json:"count"`
	Liked bool  `json:"liked"`
}

type ReactionSummary struct {
	Emoji   string `json:"emoji"`
	Count   int64  `json:"count"`
	Reacted bool   `json:"reacted"`
}

type CommentUser struct {
	ID        uint    `json:"id"`
	Username  string  `json:"username"`
	AvatarURL *string `json:"avatarUrl,omitempty"`
}

type CommentItem struct {
	ID           uint              `json:"id"`
	ResourceType string            `json:"resourceType"`
	ResourceID   uint              `json:"resourceId"`
	ParentID     *uint             `json:"parentId,omitempty"`
	User         CommentUser       `json:"user"`
	Content      string            `json:"content"`
	Location     *string           `json:"location,omitempty"`
	DeviceModel  *string           `json:"deviceModel,omitempty"`
	Reactions    []ReactionSummary `json:"reactions"`
	Replies      []CommentItem     `json:"replies"`
	CreatedAt    time.Time         `json:"createdAt"`
	UpdatedAt    time.Time         `json:"updatedAt"`
	CanDelete    bool              `json:"canDelete"`
}

type CommentsResponse struct {
	Items []CommentItem `json:"items"`
	Total int64         `json:"total"`
}

type AdminCommentListParams struct {
	Page         int
	PageSize     int
	Keyword      string
	Status       string
	ResourceType string
	ResourceID   *uint
	UserID       *uint
}

type AdminCommentListItem struct {
	ID               uint       `json:"id"`
	ResourceType     string     `json:"resourceType"`
	ResourceID       uint       `json:"resourceId"`
	ResourceTitle    *string    `json:"resourceTitle,omitempty"`
	ParentID         *uint      `json:"parentId,omitempty"`
	UserID           uint       `json:"userId"`
	Username         string     `json:"username"`
	AvatarURL        *string    `json:"avatarUrl,omitempty"`
	Content          string     `json:"content"`
	Status           string     `json:"status"`
	Location         *string    `json:"location,omitempty"`
	DeviceModel      *string    `json:"deviceModel,omitempty"`
	ModerationReason *string    `json:"moderationReason,omitempty"`
	ModeratedBy      *uint      `json:"moderatedBy,omitempty"`
	ModeratedAt      *time.Time `json:"moderatedAt,omitempty"`
	CreatedAt        time.Time  `json:"createdAt"`
	UpdatedAt        time.Time  `json:"updatedAt"`
	DeletedAt        *time.Time `json:"deletedAt,omitempty"`
}

type AdminCommentListResponse struct {
	List     []AdminCommentListItem `json:"list"`
	Total    int64                  `json:"total"`
	Page     int                    `json:"page"`
	PageSize int                    `json:"pageSize"`
}

type AdminModerateCommentRequest struct {
	Action string `json:"action"`
	Reason string `json:"reason"`
}

func NewInteractionService(db *gorm.DB) *InteractionService {
	return &InteractionService{db: db}
}

func (s *InteractionService) GetLikeSummary(resourceType string, resourceID uint, userID uint) (*LikeSummary, error) {
	if err := s.validateResourceAccess(resourceType, resourceID); err != nil {
		return nil, err
	}
	var count int64
	if err := s.db.Model(&interactionModels.ResourceLike{}).
		Where("resource_type = ? AND resource_id = ?", resourceType, resourceID).
		Count(&count).Error; err != nil {
		return nil, err
	}
	var mine int64
	if err := s.db.Model(&interactionModels.ResourceLike{}).
		Where("resource_type = ? AND resource_id = ? AND user_id = ?", resourceType, resourceID, userID).
		Count(&mine).Error; err != nil {
		return nil, err
	}
	return &LikeSummary{Count: count, Liked: mine > 0}, nil
}

func (s *InteractionService) ToggleLike(resourceType string, resourceID uint, userID uint) (*LikeSummary, error) {
	if err := s.validateResourceAccess(resourceType, resourceID); err != nil {
		return nil, err
	}
	var like interactionModels.ResourceLike
	err := s.db.Where("resource_type = ? AND resource_id = ? AND user_id = ?", resourceType, resourceID, userID).First(&like).Error
	if err == nil {
		if err := s.db.Delete(&like).Error; err != nil {
			return nil, err
		}
		return s.GetLikeSummary(resourceType, resourceID, userID)
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if err := s.db.Create(&interactionModels.ResourceLike{
		ResourceType: resourceType,
		ResourceID:   resourceID,
		UserID:       userID,
	}).Error; err != nil {
		return nil, err
	}
	return s.GetLikeSummary(resourceType, resourceID, userID)
}

func (s *InteractionService) ListComments(resourceType string, resourceID uint, userID uint) (*CommentsResponse, error) {
	if err := s.validateResourceAccess(resourceType, resourceID); err != nil {
		return nil, err
	}

	var rows []commentRow
	if err := s.db.Table("resource_comments").
		Select("resource_comments.*, users.username, users.avatar_url").
		Joins("JOIN users ON users.id = resource_comments.user_id").
		Where("resource_comments.resource_type = ? AND resource_comments.resource_id = ? AND resource_comments.status = ? AND resource_comments.deleted_at IS NULL", resourceType, resourceID, "visible").
		Order("resource_comments.created_at ASC").
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	reactions, err := s.loadReactionSummaries(rows, userID)
	if err != nil {
		return nil, err
	}

	byID := make(map[uint]*CommentItem, len(rows))
	roots := make([]*CommentItem, 0)
	for _, row := range rows {
		item := &CommentItem{
			ID:           row.ID,
			ResourceType: row.ResourceType,
			ResourceID:   row.ResourceID,
			ParentID:     row.ParentID,
			User: CommentUser{
				ID:        row.UserID,
				Username:  row.Username,
				AvatarURL: row.AvatarURL,
			},
			Content:     row.Content,
			Location:    row.Location,
			DeviceModel: row.DeviceModel,
			Reactions:   reactions[row.ID],
			Replies:     []CommentItem{},
			CreatedAt:   row.CreatedAt,
			UpdatedAt:   row.UpdatedAt,
			CanDelete:   row.UserID == userID,
		}
		byID[item.ID] = item
	}
	for _, item := range byID {
		if item.ParentID != nil {
			if parent, ok := byID[*item.ParentID]; ok {
				parent.Replies = append(parent.Replies, *item)
			}
			continue
		}
		roots = append(roots, item)
	}
	sort.Slice(roots, func(i, j int) bool { return roots[i].CreatedAt.Before(roots[j].CreatedAt) })
	items := make([]CommentItem, 0, len(roots))
	for _, root := range roots {
		sortCommentReplies(root)
		items = append(items, *root)
	}
	return &CommentsResponse{Items: items, Total: int64(len(rows))}, nil
}

func (s *InteractionService) CreateComment(resourceType string, resourceID uint, userID uint, userAgent string, req CreateCommentRequest) (*CommentsResponse, error) {
	if err := s.validateResourceAccess(resourceType, resourceID); err != nil {
		return nil, err
	}
	content := strings.TrimSpace(req.Content)
	if content == "" {
		return nil, ErrCommentContentEmpty
	}
	if len([]rune(content)) > 2000 {
		content = string([]rune(content)[:2000])
	}
	if req.ParentID != nil {
		var parent interactionModels.ResourceComment
		if err := s.db.Where("id = ? AND resource_type = ? AND resource_id = ? AND status = ?", *req.ParentID, resourceType, resourceID, "visible").First(&parent).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrCommentNotFound
			}
			return nil, err
		}
	}
	comment := interactionModels.ResourceComment{
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ParentID:     req.ParentID,
		UserID:       userID,
		Content:      content,
		Status:       "visible",
		Location:     stringPtrMax(req.Location, 120),
		DeviceModel:  stringPtrMax(req.DeviceModel, 160),
		UserAgent:    stringPtrMax(userAgent, 512),
	}
	if err := s.db.Create(&comment).Error; err != nil {
		return nil, err
	}
	return s.ListComments(resourceType, resourceID, userID)
}

func (s *InteractionService) DeleteComment(commentID uint, userID uint) error {
	var comment interactionModels.ResourceComment
	if err := s.db.First(&comment, commentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrCommentNotFound
		}
		return err
	}
	if comment.UserID != userID {
		return ErrCommentForbidden
	}
	return s.db.Transaction(func(tx *gorm.DB) error {
		ids, err := collectCommentTreeIDs(tx, comment.ID)
		if err != nil {
			return err
		}
		now := time.Now()
		if err := tx.Model(&interactionModels.ResourceComment{}).
			Where("id IN ?", ids).
			Updates(map[string]interface{}{
				"status":       "deleted",
				"moderated_at": now,
			}).Error; err != nil {
			return err
		}
		return tx.Where("id IN ?", ids).Delete(&interactionModels.ResourceComment{}).Error
	})
}

func (s *InteractionService) ToggleCommentReaction(commentID uint, userID uint, emoji string) (*ReactionSummary, error) {
	emoji = strings.TrimSpace(emoji)
	if emoji == "" || len([]rune(emoji)) > 8 {
		emoji = "👍"
	}
	var comment interactionModels.ResourceComment
	if err := s.db.First(&comment, commentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCommentNotFound
		}
		return nil, err
	}
	if err := s.validateResourceAccess(comment.ResourceType, comment.ResourceID); err != nil {
		return nil, err
	}
	if comment.Status != "visible" {
		return nil, ErrCommentNotFound
	}
	var reaction interactionModels.CommentReaction
	err := s.db.Where("comment_id = ? AND user_id = ? AND emoji = ?", commentID, userID, emoji).First(&reaction).Error
	if err == nil {
		if err := s.db.Delete(&reaction).Error; err != nil {
			return nil, err
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		if err := s.db.Create(&interactionModels.CommentReaction{CommentID: commentID, UserID: userID, Emoji: emoji}).Error; err != nil {
			return nil, err
		}
	} else {
		return nil, err
	}

	var count int64
	if err := s.db.Model(&interactionModels.CommentReaction{}).Where("comment_id = ? AND emoji = ?", commentID, emoji).Count(&count).Error; err != nil {
		return nil, err
	}
	var mine int64
	if err := s.db.Model(&interactionModels.CommentReaction{}).Where("comment_id = ? AND user_id = ? AND emoji = ?", commentID, userID, emoji).Count(&mine).Error; err != nil {
		return nil, err
	}
	return &ReactionSummary{Emoji: emoji, Count: count, Reacted: mine > 0}, nil
}

func (s *InteractionService) AdminListComments(params AdminCommentListParams) (*AdminCommentListResponse, error) {
	page := params.Page
	if page < 1 {
		page = 1
	}
	pageSize := params.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	type adminCommentRow struct {
		interactionModels.ResourceComment
		DeletedAtTime *time.Time `gorm:"column:deleted_at_time"`
		Username      string     `gorm:"column:username"`
		AvatarURL     *string    `gorm:"column:avatar_url"`
		ResourceTitle *string    `gorm:"column:resource_title"`
	}

	query := s.db.Unscoped().Table("resource_comments").
		Select(`
			resource_comments.*,
			resource_comments.deleted_at AS deleted_at_time,
			users.username,
			users.avatar_url,
			CASE
				WHEN resource_comments.resource_type = 'workflow_template' THEN workflows.name
				ELSE NULL
			END AS resource_title
		`).
		Joins("JOIN users ON users.id = resource_comments.user_id").
		Joins("LEFT JOIN workflows ON workflows.id = resource_comments.resource_id AND resource_comments.resource_type = 'workflow_template'")

	if keyword := strings.TrimSpace(params.Keyword); keyword != "" {
		like := "%" + strings.ToLower(keyword) + "%"
		query = query.Where("LOWER(resource_comments.content) LIKE ? OR LOWER(users.username) LIKE ? OR LOWER(COALESCE(workflows.name, '')) LIKE ?", like, like, like)
	}
	if status := strings.TrimSpace(params.Status); status != "" {
		query = query.Where("resource_comments.status = ?", status)
	}
	if resourceType := strings.TrimSpace(params.ResourceType); resourceType != "" {
		query = query.Where("resource_comments.resource_type = ?", resourceType)
	}
	if params.ResourceID != nil {
		query = query.Where("resource_comments.resource_id = ?", *params.ResourceID)
	}
	if params.UserID != nil {
		query = query.Where("resource_comments.user_id = ?", *params.UserID)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, err
	}

	var rows []adminCommentRow
	if err := query.Order("resource_comments.created_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Scan(&rows).Error; err != nil {
		return nil, err
	}

	list := make([]AdminCommentListItem, 0, len(rows))
	for _, row := range rows {
		list = append(list, AdminCommentListItem{
			ID:               row.ID,
			ResourceType:     row.ResourceType,
			ResourceID:       row.ResourceID,
			ResourceTitle:    row.ResourceTitle,
			ParentID:         row.ParentID,
			UserID:           row.UserID,
			Username:         row.Username,
			AvatarURL:        row.AvatarURL,
			Content:          row.Content,
			Status:           row.Status,
			Location:         row.Location,
			DeviceModel:      row.DeviceModel,
			ModerationReason: row.ModerationReason,
			ModeratedBy:      row.ModeratedBy,
			ModeratedAt:      row.ModeratedAt,
			CreatedAt:        row.CreatedAt,
			UpdatedAt:        row.UpdatedAt,
			DeletedAt:        row.DeletedAtTime,
		})
	}

	return &AdminCommentListResponse{List: list, Total: total, Page: page, PageSize: pageSize}, nil
}

func (s *InteractionService) AdminModerateComment(commentID uint, operatorID uint, req AdminModerateCommentRequest) (*AdminCommentListItem, error) {
	var comment interactionModels.ResourceComment
	if err := s.db.Unscoped().First(&comment, commentID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCommentNotFound
		}
		return nil, err
	}

	action := strings.TrimSpace(req.Action)
	reason := strings.TrimSpace(req.Reason)
	now := time.Now()
	updates := map[string]interface{}{
		"moderation_reason": stringPtrMax(reason, 500),
		"moderated_by":      operatorID,
		"moderated_at":      now,
	}

	switch action {
	case "hide":
		updates["status"] = "hidden"
	case "restore":
		updates["status"] = "visible"
		updates["deleted_at"] = nil
	case "delete":
		updates["status"] = "deleted"
	default:
		return nil, ErrInvalidModerationAction
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		ids, err := collectCommentTreeIDs(tx.Unscoped(), comment.ID)
		if err != nil {
			return err
		}
		if err := tx.Unscoped().Model(&interactionModels.ResourceComment{}).Where("id IN ?", ids).Updates(updates).Error; err != nil {
			return err
		}
		if action == "delete" {
			return tx.Where("id IN ?", ids).Delete(&interactionModels.ResourceComment{}).Error
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	if action != "restore" {
		s.notifyCommentModerated(comment, action, reason)
	}

	item, err := s.adminGetCommentItem(comment.ID)
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (s *InteractionService) notifyCommentModerated(comment interactionModels.ResourceComment, action string, reason string) {
	if notificationModule.DefaultService == nil {
		return
	}
	title := "评论已处理"
	actionText := map[string]string{"hide": "隐藏", "delete": "删除"}[action]
	if actionText == "" {
		actionText = "处理"
	}
	resourceTitle := s.resolveResourceTitle(comment.ResourceType, comment.ResourceID)
	content := fmt.Sprintf("你在「%s」下的评论已被%s。", resourceTitle, actionText)
	if reason = strings.TrimSpace(reason); reason != "" {
		content += "原因：" + reason
	}
	category := "moderation"
	resourceID := comment.ID
	resourceType := "comment"
	metadata := &shared.JSONB{Data: map[string]interface{}{
		"commentId":     comment.ID,
		"resourceType":  comment.ResourceType,
		"resourceId":    comment.ResourceID,
		"resourceTitle": resourceTitle,
		"action":        action,
		"reason":        reason,
		"excerpt":       truncateRunes(comment.Content, 120),
	}}
	_, _ = notificationModule.DefaultService.CreateAndNotify(notificationServices.CreateAndNotifyInput{
		UserID:              comment.UserID,
		Type:                "comment_moderation_notice",
		Category:            &category,
		Title:               title,
		Content:             &content,
		RelatedResourceType: &resourceType,
		RelatedResourceID:   &resourceID,
		Metadata:            metadata,
	})
}

func (s *InteractionService) adminGetCommentItem(commentID uint) (*AdminCommentListItem, error) {
	type adminCommentRow struct {
		interactionModels.ResourceComment
		DeletedAtTime *time.Time `gorm:"column:deleted_at_time"`
		Username      string     `gorm:"column:username"`
		AvatarURL     *string    `gorm:"column:avatar_url"`
		ResourceTitle *string    `gorm:"column:resource_title"`
	}
	var row adminCommentRow
	if err := s.db.Unscoped().Table("resource_comments").
		Select(`
			resource_comments.*,
			resource_comments.deleted_at AS deleted_at_time,
			users.username,
			users.avatar_url,
			CASE
				WHEN resource_comments.resource_type = 'workflow_template' THEN workflows.name
				ELSE NULL
			END AS resource_title
		`).
		Joins("JOIN users ON users.id = resource_comments.user_id").
		Joins("LEFT JOIN workflows ON workflows.id = resource_comments.resource_id AND resource_comments.resource_type = 'workflow_template'").
		Where("resource_comments.id = ?", commentID).
		Scan(&row).Error; err != nil {
		return nil, err
	}
	if row.ID == 0 {
		return nil, ErrCommentNotFound
	}
	return &AdminCommentListItem{
		ID:               row.ID,
		ResourceType:     row.ResourceType,
		ResourceID:       row.ResourceID,
		ResourceTitle:    row.ResourceTitle,
		ParentID:         row.ParentID,
		UserID:           row.UserID,
		Username:         row.Username,
		AvatarURL:        row.AvatarURL,
		Content:          row.Content,
		Status:           row.Status,
		Location:         row.Location,
		DeviceModel:      row.DeviceModel,
		ModerationReason: row.ModerationReason,
		ModeratedBy:      row.ModeratedBy,
		ModeratedAt:      row.ModeratedAt,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
		DeletedAt:        row.DeletedAtTime,
	}, nil
}

func (s *InteractionService) loadReactionSummaries(rows []commentRow, userID uint) (map[uint][]ReactionSummary, error) {
	commentIDs := make([]uint, 0, len(rows))
	for _, row := range rows {
		commentIDs = append(commentIDs, row.ID)
	}
	result := make(map[uint][]ReactionSummary, len(commentIDs))
	if len(commentIDs) == 0 {
		return result, nil
	}
	type reactionRow struct {
		CommentID uint
		Emoji     string
		Count     int64
	}
	var grouped []reactionRow
	if err := s.db.Model(&interactionModels.CommentReaction{}).
		Select("comment_id, emoji, COUNT(*) AS count").
		Where("comment_id IN ?", commentIDs).
		Group("comment_id, emoji").
		Scan(&grouped).Error; err != nil {
		return nil, err
	}
	var mine []interactionModels.CommentReaction
	if err := s.db.Where("comment_id IN ? AND user_id = ?", commentIDs, userID).Find(&mine).Error; err != nil {
		return nil, err
	}
	mineSet := make(map[uint]map[string]bool)
	for _, reaction := range mine {
		if mineSet[reaction.CommentID] == nil {
			mineSet[reaction.CommentID] = map[string]bool{}
		}
		mineSet[reaction.CommentID][reaction.Emoji] = true
	}
		for _, item := range grouped {
			result[item.CommentID] = append(result[item.CommentID], ReactionSummary{
				Emoji:   item.Emoji,
				Count:   item.Count,
				Reacted: mineSet[item.CommentID][item.Emoji],
			})
		}
		for _, commentID := range commentIDs {
			if result[commentID] == nil {
				result[commentID] = []ReactionSummary{}
			}
		}
		return result, nil
	}

func (s *InteractionService) validateResourceAccess(resourceType string, resourceID uint) error {
	if resourceID == 0 || !validResourceTypePattern.MatchString(resourceType) {
		return ErrInvalidResource
	}
	switch resourceType {
	case "workflow_template":
		var count int64
		if err := s.db.Model(&workflowModels.Workflow{}).
			Where("id = ? AND is_template = ? AND status = ? AND is_public = ?", resourceID, true, "published", true).
			Count(&count).Error; err != nil {
			return err
		}
		if count == 0 {
			return ErrInvalidResource
		}
		return nil
	default:
		return ErrInvalidResource
	}
}

func stringPtrMax(value string, max int) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	runes := []rune(value)
	if len(runes) > max {
		value = string(runes[:max])
	}
	return &value
}

func collectCommentTreeIDs(db *gorm.DB, rootID uint) ([]uint, error) {
	ids := []uint{rootID}
	queue := []uint{rootID}
	for len(queue) > 0 {
		var children []uint
		if err := db.Model(&interactionModels.ResourceComment{}).
			Where("parent_id IN ?", queue).
			Pluck("id", &children).Error; err != nil {
			return nil, err
		}
		if len(children) == 0 {
			break
		}
		ids = append(ids, children...)
		queue = children
	}
	return ids, nil
}

func (s *InteractionService) resolveResourceTitle(resourceType string, resourceID uint) string {
	switch resourceType {
	case "workflow_template":
		var workflow workflowModels.Workflow
		if err := s.db.Unscoped().Select("name").First(&workflow, resourceID).Error; err == nil && strings.TrimSpace(workflow.Name) != "" {
			return workflow.Name
		}
	}
	return fmt.Sprintf("%s #%d", resourceType, resourceID)
}

func truncateRunes(value string, max int) string {
	value = strings.TrimSpace(value)
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max]) + "..."
}

func sortCommentReplies(item *CommentItem) {
	sort.Slice(item.Replies, func(i, j int) bool { return item.Replies[i].CreatedAt.Before(item.Replies[j].CreatedAt) })
	for i := range item.Replies {
		sortCommentReplies(&item.Replies[i])
	}
}

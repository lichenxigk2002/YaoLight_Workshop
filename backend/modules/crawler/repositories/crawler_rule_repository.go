package repositories

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/crawler/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

type ListCrawlerRulesQuery struct {
	Keyword   string
	IsActive  *bool
	CreatedBy *uint
	Page      int
	PageSize  int
	SortBy    string
	SortOrder string
}

type CrawlerRuleUsage struct {
	WorkflowID   uint      `json:"workflow_id"`
	WorkflowName string    `json:"workflow_name"`
	NodeID       string    `json:"node_id"`
	NodeType     string    `json:"node_type"`
	ReferencedAt time.Time `json:"referenced_at"`
}

type CrawlerRuleRepository struct {
	db *gorm.DB
}

func NewCrawlerRuleRepository(db *gorm.DB) *CrawlerRuleRepository {
	return &CrawlerRuleRepository{db: db}
}

func (r *CrawlerRuleRepository) FindByID(id uint) (*models.CrawlerRule, error) {
	var rule models.CrawlerRule
	if err := r.db.First(&rule, id).Error; err != nil {
		return nil, err
	}
	return &rule, nil
}

func (r *CrawlerRuleRepository) List(query ListCrawlerRulesQuery) ([]models.CrawlerRule, int64, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	db := r.db.Model(&models.CrawlerRule{})

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		db = db.Where("name ILIKE ? OR description ILIKE ? OR url_pattern ILIKE ?", like, like, like)
	}
	if query.IsActive != nil {
		db = db.Where("is_active = ?", *query.IsActive)
	}
	if query.CreatedBy != nil {
		db = db.Where("created_by = ?", *query.CreatedBy)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	sortBy := sanitizeSortBy(query.SortBy)
	sortOrder := sanitizeSortOrder(query.SortOrder)

	var rules []models.CrawlerRule
	if err := db.Order(fmt.Sprintf("%s %s", sortBy, sortOrder)).
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rules).Error; err != nil {
		return nil, 0, err
	}

	return rules, total, nil
}

func (r *CrawlerRuleRepository) Create(rule *models.CrawlerRule) error {
	return r.db.Create(rule).Error
}

func (r *CrawlerRuleRepository) Update(rule *models.CrawlerRule) error {
	return r.db.Save(rule).Error
}

func (r *CrawlerRuleRepository) Delete(id uint) error {
	return r.db.Delete(&models.CrawlerRule{}, id).Error
}

func (r *CrawlerRuleRepository) UpdateStatus(id uint, isActive bool) error {
	return r.db.Model(&models.CrawlerRule{}).
		Where("id = ?", id).
		Update("is_active", isActive).Error
}

func (r *CrawlerRuleRepository) IncrementUsage(id uint) error {
	return r.db.Model(&models.CrawlerRule{}).
		Where("id = ?", id).
		UpdateColumn("usage_count", gorm.Expr("usage_count + ?", 1)).Error
}

func (r *CrawlerRuleRepository) UpdateMetrics(id uint, success bool) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var rule models.CrawlerRule
		if err := tx.First(&rule, id).Error; err != nil {
			return err
		}

		currentCount := rule.UsageCount
		if currentCount <= 0 {
			currentCount = 1
		}

		previousCount := currentCount - 1
		previousRate := 0.0
		if rule.SuccessRate != nil {
			previousRate = *rule.SuccessRate
		}
		successes := (previousRate / 100.0) * float64(previousCount)
		if success {
			successes++
		}
		newRate := (successes / float64(currentCount)) * 100.0

		return tx.Model(&models.CrawlerRule{}).
			Where("id = ?", id).
			Update("success_rate", newRate).Error
	})
}

func (r *CrawlerRuleRepository) FindUsages(ruleID uint) ([]CrawlerRuleUsage, error) {
	ruleIDStr := fmt.Sprintf("%d", ruleID)

	var usages []CrawlerRuleUsage
	err := r.db.Model(&workflowModels.WorkflowNode{}).
		Select("workflow_nodes.workflow_id, workflows.name AS workflow_name, workflow_nodes.node_id, workflow_nodes.node_type, workflow_nodes.updated_at AS referenced_at").
		Joins("JOIN workflows ON workflows.id = workflow_nodes.workflow_id").
		Where("(workflow_nodes.config->>'ruleId' = ? OR workflow_nodes.config->>'rule_id' = ?)", ruleIDStr, ruleIDStr).
		Where("workflows.deleted_at IS NULL").
		Order("workflow_nodes.updated_at DESC").
		Scan(&usages).Error

	return usages, err
}

func sanitizeSortBy(sortBy string) string {
	switch sortBy {
	case "name":
		return "name"
	case "version":
		return "version"
	case "usage_count":
		return "usage_count"
	case "success_rate":
		return "success_rate"
	case "created_at":
		return "created_at"
	case "updated_at":
		fallthrough
	default:
		return "updated_at"
	}
}

func sanitizeSortOrder(sortOrder string) string {
	switch strings.ToUpper(strings.TrimSpace(sortOrder)) {
	case "ASC":
		return "ASC"
	default:
		return "DESC"
	}
}

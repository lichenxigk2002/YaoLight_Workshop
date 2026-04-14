package services

import (
	"strings"
	"yaolight-workshop/backend/infrastructure/database"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	nodeModels "yaolight-workshop/backend/modules/node/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"

	"gorm.io/gorm"
)

// KnowledgeService 瑶光星知识库服务
type KnowledgeService struct{}

type KnowledgeSearchOptions struct {
	Query      string
	UserID     uint
	Limit      int
	Category   string
	Target     string
	ProjectID  uint
	WorkflowID uint
}

// GetAlkaidContext 获取瑶光星助手的全量上下文知识（系统级 + 用户个人 + 实战案例）
func (s *KnowledgeService) GetAlkaidContext(userID uint) (map[string]interface{}, error) {
	var nodeTypes []nodeModels.NodeType
	var providerTemplates []aiModels.ProviderTemplate
	var knowledges []alkaidModels.AlkaidKnowledge
	var exampleNodes []workflowModels.WorkflowNode

	// 1. 获取所有激活的节点规格 (硬约束)
	if err := database.DB.Where("is_active = ?", true).Find(&nodeTypes).Error; err != nil {
		return nil, err
	}

	// 2. 获取所有 AI 供应商模板 (硬约束)
	if err := database.DB.Where("is_active = ?", true).Find(&providerTemplates).Error; err != nil {
		return nil, err
	}

	// 3. 获取知识片段 (系统公共知识 + 该用户的个人知识)
	if err := applyKnowledgeScope(
		database.DB.Model(&alkaidModels.AlkaidKnowledge{}),
		userID,
		0,
		0,
	).Find(&knowledges).Error; err != nil {
		return nil, err
	}

	// 4. 获取实战案例 (从已有的工作流节点中抽取一些典型的配置作为参考)
	// 优先抽取模板工作流或者最近成功的节点配置
	database.DB.Table("workflow_nodes").
		Select("workflow_nodes.node_type, workflow_nodes.config, workflow_nodes.label").
		Limit(10).
		Find(&exampleNodes)

	// 5. 聚合数据
	context := map[string]interface{}{
		"node_specs":     nodeTypes,         // 官方定义
		"ai_providers":   providerTemplates, // AI 规格
		"knowledge_base": knowledges,        // 经验手册
		"real_examples":  exampleNodes,      // 实战案例：从 workflow_nodes 表里“学”到的
	}

	return context, nil
}

// SearchKnowledge 根据关键词搜索相关知识（简单的 RAG 模拟）
// limit: 期望返回条数；<=0 时默认 5；最大 10（避免 token 过多）
func (s *KnowledgeService) SearchKnowledge(query string, userID uint, limit int) ([]alkaidModels.AlkaidKnowledge, error) {
	return s.SearchKnowledgeScoped(KnowledgeSearchOptions{
		Query:  query,
		UserID: userID,
		Limit:  limit,
	})
}

func (s *KnowledgeService) SearchKnowledgeScoped(opts KnowledgeSearchOptions) ([]alkaidModels.AlkaidKnowledge, error) {
	limit := opts.Limit
	if limit <= 0 {
		limit = 5
	}
	if limit > 10 {
		limit = 10
	}

	query := strings.TrimSpace(opts.Query)
	category := strings.TrimSpace(opts.Category)
	target := strings.TrimSpace(opts.Target)

	var results []alkaidModels.AlkaidKnowledge
	db := database.DB.Model(&alkaidModels.AlkaidKnowledge{}).
		Scopes(func(tx *gorm.DB) *gorm.DB {
			return applyKnowledgeScope(tx, opts.UserID, opts.ProjectID, opts.WorkflowID)
		})

	if category != "" {
		db = db.Where("category = ?", category)
	}
	if target != "" {
		db = db.Where("target = ?", target)
	}
	if query != "" {
		likeQuery := "%" + query + "%"
		db = db.Where("(title LIKE ? OR content LIKE ?)", likeQuery, likeQuery)
	}

	err := db.Order("category ASC").Order("updated_at DESC").Limit(limit).Find(&results).Error
	return results, err
}

// GetKnowledgeByTarget 根据目标节点类型获取相关知识
// 用于当用户提到特定节点时，加载该节点的使用说明和最佳实践
func (s *KnowledgeService) GetKnowledgeByTarget(target string, userID uint) ([]alkaidModels.AlkaidKnowledge, error) {
	return s.GetKnowledgeByTargetAndCategory(target, "", userID, 0)
}

func (s *KnowledgeService) GetKnowledgeByTargetAndCategory(target string, category string, userID uint, limit int) ([]alkaidModels.AlkaidKnowledge, error) {
	return s.GetKnowledgeByTargetAndCategoryScoped(target, category, userID, 0, 0, limit)
}

func (s *KnowledgeService) GetKnowledgeByTargetAndCategoryScoped(target string, category string, userID uint, projectID uint, workflowID uint, limit int) ([]alkaidModels.AlkaidKnowledge, error) {
	var results []alkaidModels.AlkaidKnowledge
	db := applyKnowledgeScope(database.DB.Model(&alkaidModels.AlkaidKnowledge{}), userID, projectID, workflowID).
		Where("target = ?", target)
	if strings.TrimSpace(category) != "" {
		db = db.Where("category = ?", strings.TrimSpace(category))
	}
	db = db.
		Order("category ASC").
		Order("updated_at DESC")
	if limit > 0 {
		db = db.Limit(limit)
	}
	err := db.Find(&results).Error
	return results, err
}

func (s *KnowledgeService) GetKnowledgeByCategory(category string, userID uint, limit int) ([]alkaidModels.AlkaidKnowledge, error) {
	return s.GetKnowledgeByCategoryScoped(category, userID, 0, 0, limit)
}

func (s *KnowledgeService) GetKnowledgeByCategoryScoped(category string, userID uint, projectID uint, workflowID uint, limit int) ([]alkaidModels.AlkaidKnowledge, error) {
	var results []alkaidModels.AlkaidKnowledge
	db := applyKnowledgeScope(database.DB.Model(&alkaidModels.AlkaidKnowledge{}), userID, projectID, workflowID).
		Where("category = ?", strings.TrimSpace(category)).
		Order("updated_at DESC")
	if limit > 0 {
		db = db.Limit(limit)
	}
	err := db.Find(&results).Error
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}
	return results, nil
}

func applyKnowledgeScope(db *gorm.DB, userID uint, projectID uint, workflowID uint) *gorm.DB {
	base := db.Where("is_active = ?", true)
	switch {
	case workflowID > 0:
		return base.Where(`
			(user_id IS NULL AND project_id IS NULL AND workflow_id IS NULL)
			OR (user_id = ? AND project_id IS NULL AND workflow_id IS NULL)
			OR (user_id = ? AND project_id = ? AND workflow_id IS NULL)
			OR (user_id = ? AND workflow_id = ?)
		`, userID, userID, projectID, userID, workflowID)
	case projectID > 0:
		return base.Where(`
			(user_id IS NULL AND project_id IS NULL AND workflow_id IS NULL)
			OR (user_id = ? AND project_id IS NULL AND workflow_id IS NULL)
			OR (user_id = ? AND project_id = ? AND workflow_id IS NULL)
		`, userID, userID, projectID)
	default:
		return base.Where(`
			(user_id IS NULL AND project_id IS NULL AND workflow_id IS NULL)
			OR (user_id = ? AND project_id IS NULL AND workflow_id IS NULL)
		`, userID)
	}
}

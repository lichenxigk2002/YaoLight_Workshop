package services

import (
	"yaolight-workshop/backend/infrastructure/database"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	nodeModels "yaolight-workshop/backend/modules/node/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

// KnowledgeService 瑶光星知识库服务
type KnowledgeService struct{}

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
	if err := database.DB.Where("is_active = ? AND (user_id IS NULL OR user_id = ?)", true, userID).Find(&knowledges).Error; err != nil {
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
func (s *KnowledgeService) SearchKnowledge(query string) ([]alkaidModels.AlkaidKnowledge, error) {
	var results []alkaidModels.AlkaidKnowledge
	err := database.DB.Where("is_active = ? AND (title LIKE ? OR content LIKE ?)",
		true, "%"+query+"%", "%"+query+"%").Limit(5).Find(&results).Error
	return results, err
}

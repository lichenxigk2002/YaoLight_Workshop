package services

import (
	"errors"
	"workflow-management-system/backend/domain/entity"
	"workflow-management-system/backend/domain/repository"
	"workflow-management-system/backend/infrastructure/shared"
	"workflow-management-system/backend/modules/workflow/models"
	workflowRepos "workflow-management-system/backend/modules/workflow/repositories"
)

var (
	ErrWorkflowNotFound = errors.New("workflow not found")
)

// WorkflowService 工作流服务
type WorkflowService struct {
	workflowRepo     repository.WorkflowRepository
	workflowNodeRepo *workflowRepos.WorkflowNodeRepository
}

// NewWorkflowService 创建工作流服务
func NewWorkflowService(workflowRepo repository.WorkflowRepository, workflowNodeRepo *workflowRepos.WorkflowNodeRepository) *WorkflowService {
	return &WorkflowService{
		workflowRepo:     workflowRepo,
		workflowNodeRepo: workflowNodeRepo,
	}
}

// CreateWorkflowRequest 创建工作流请求
type CreateWorkflowRequest struct {
	Name        string  `json:"name" binding:"required,min=1,max=200"`
	Description *string `json:"description,omitempty"`
	ProjectID   *uint   `json:"projectId,omitempty"` // 支持前端发送的 projectId
	UserID      uint    `json:"-"`
}

// UpdateWorkflowRequest 更新工作流请求
type UpdateWorkflowRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Status      *string `json:"status,omitempty"`
}

// CreateWorkflow 创建工作流
func (s *WorkflowService) CreateWorkflow(req *CreateWorkflowRequest) (*models.Workflow, error) {
	// 创建工作流领域实体
	workflow := &entity.Workflow{
		UserID:      req.UserID,
		ProjectID:   req.ProjectID,
		Name:        req.Name,
		Description: req.Description,
		Status:      "draft",
	}

	// 通过仓储创建工作流
	if err := s.workflowRepo.Create(workflow); err != nil {
		return nil, err
	}

	// 转换为持久化实体返回（保持向后兼容）
	return toPersistenceModel(workflow), nil
}

// GetWorkflowByID 根据ID获取工作流
func (s *WorkflowService) GetWorkflowByID(id uint) (*models.Workflow, error) {
	workflow, err := s.workflowRepo.FindByID(id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

	return toPersistenceModel(workflow), nil
}

// GetWorkflowsByProjectID 根据项目ID获取工作流列表
func (s *WorkflowService) GetWorkflowsByProjectID(projectID uint, page, pageSize int) ([]*models.Workflow, int64, error) {
	offset := (page - 1) * pageSize
	workflows, total, err := s.workflowRepo.FindByProjectID(projectID, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}

	// 转换为持久化模型
	modelsList := make([]*models.Workflow, len(workflows))
	for i, workflow := range workflows {
		modelsList[i] = toPersistenceModel(workflow)
	}

	return modelsList, total, nil
}

// GetWorkflowsByUserID 根据用户ID获取工作流列表
func (s *WorkflowService) GetWorkflowsByUserID(userID uint, page, pageSize int) ([]*models.Workflow, int64, error) {
	offset := (page - 1) * pageSize
	workflows, total, err := s.workflowRepo.FindByUserID(userID, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}

	// 转换为持久化模型
	modelsList := make([]*models.Workflow, len(workflows))
	for i, workflow := range workflows {
		modelsList[i] = toPersistenceModel(workflow)
	}

	return modelsList, total, nil
}

// UpdateWorkflow 更新工作流
func (s *WorkflowService) UpdateWorkflow(id uint, req *UpdateWorkflowRequest) (*models.Workflow, error) {
	workflow, err := s.workflowRepo.FindByID(id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

	// 更新字段
	if req.Name != nil {
		workflow.Name = *req.Name
	}
	if req.Description != nil {
		workflow.Description = req.Description
	}
	if req.Status != nil {
		workflow.Status = *req.Status
	}

	if err := s.workflowRepo.Update(workflow); err != nil {
		return nil, err
	}

	return toPersistenceModel(workflow), nil
}

// DeleteWorkflow 删除工作流
func (s *WorkflowService) DeleteWorkflow(id uint) error {
	_, err := s.workflowRepo.FindByID(id)
	if err != nil {
		return ErrWorkflowNotFound
	}

	return s.workflowRepo.Delete(id)
}

// SaveWorkflowNodesRequest 保存工作流节点和边请求
type SaveWorkflowNodesRequest struct {
	Nodes []WorkflowNodeData `json:"nodes"`
	Edges []EdgeData         `json:"edges"`
}

// WorkflowNodeData 工作流节点数据（用于保存/加载）
type WorkflowNodeData struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Position map[string]interface{} `json:"position"`
	Data     map[string]interface{} `json:"data"`
}

type EdgeData struct {
	ID     string `json:"id"`
	Source string `json:"source"`
	Target string `json:"target"`
}

// SaveWorkflowNodes 保存工作流节点和边
func (s *WorkflowService) SaveWorkflowNodes(workflowID uint, req *SaveWorkflowNodesRequest) error {
	// 验证工作流是否存在
	_, err := s.workflowRepo.FindByID(workflowID)
	if err != nil {
		return ErrWorkflowNotFound
	}

	// 收集所有节点ID，用于删除不存在的节点
	nodeIDs := make([]string, len(req.Nodes))

	// 转换并保存节点
	nodes := make([]*models.WorkflowNode, len(req.Nodes))
	for i, nodeData := range req.Nodes {
		nodeIDs[i] = nodeData.ID

		// 提取配置
		config := nodeData.Data["config"]
		if config == nil {
			config = map[string]interface{}{}
		}

		// 提取标签
		var label *string
		if labelVal, ok := nodeData.Data["label"].(string); ok {
			label = &labelVal
		}

		// 构建连接信息（从 edges 中提取）
		connections := []map[string]interface{}{}
		for _, edge := range req.Edges {
			if edge.Source == nodeData.ID {
				connections = append(connections, map[string]interface{}{
					"target": edge.Target,
					"edgeId": edge.ID,
				})
			}
		}

		nodes[i] = &models.WorkflowNode{
			WorkflowID:  workflowID,
			NodeID:      nodeData.ID,
			NodeType:    nodeData.Type,
			Label:       label,
			Position:    shared.JSONB{Data: nodeData.Position},
			Config:      shared.JSONB{Data: config},
			Connections: shared.JSONB{Data: connections},
			IsEnabled:   true,
		}
	}

	// 批量保存节点
	if err := s.workflowNodeRepo.BatchCreateOrUpdate(nodes); err != nil {
		return err
	}

	// 删除不存在的节点
	if err := s.workflowNodeRepo.DeleteByWorkflowIDAndNodeIDs(workflowID, nodeIDs); err != nil {
		return err
	}

	return nil
}

// GetWorkflowNodes 获取工作流的节点和边
func (s *WorkflowService) GetWorkflowNodes(workflowID uint) (*SaveWorkflowNodesRequest, error) {
	// 验证工作流是否存在
	_, err := s.workflowRepo.FindByID(workflowID)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

	// 查询节点
	dbNodes, err := s.workflowNodeRepo.FindByWorkflowID(workflowID)
	if err != nil {
		return nil, err
	}

	// 转换为前端格式
	nodes := make([]WorkflowNodeData, len(dbNodes))
	edges := []EdgeData{}

	for i, dbNode := range dbNodes {
		// 提取位置
		position := map[string]interface{}{}
		if dbNode.Position.Data != nil {
			if posMap, ok := dbNode.Position.Data.(map[string]interface{}); ok {
				position = posMap
			}
		}

		// 提取配置
		config := map[string]interface{}{}
		if dbNode.Config.Data != nil {
			if configMap, ok := dbNode.Config.Data.(map[string]interface{}); ok {
				config = configMap
			}
		}

		// 构建节点数据
		nodeData := map[string]interface{}{
			"label":  dbNode.Label,
			"type":   dbNode.NodeType,
			"config": config,
		}

		// 添加连接方向（如果有）
		if dbNode.Config.Data != nil {
			if configMap, ok := dbNode.Config.Data.(map[string]interface{}); ok {
				if direction, ok := configMap["connectionDirection"]; ok {
					nodeData["connectionDirection"] = direction
				}
			}
		}

		nodes[i] = WorkflowNodeData{
			ID:       dbNode.NodeID,
			Type:     dbNode.NodeType,
			Position: position,
			Data:     nodeData,
		}

		// 从 connections 中提取边
		if dbNode.Connections.Data != nil {
			if conns, ok := dbNode.Connections.Data.([]interface{}); ok {
				for _, conn := range conns {
					if connMap, ok := conn.(map[string]interface{}); ok {
						if target, ok := connMap["target"].(string); ok {
							edgeID := ""
							if edgeIDVal, ok := connMap["edgeId"].(string); ok {
								edgeID = edgeIDVal
							} else {
								edgeID = dbNode.NodeID + "-" + target
							}
							edges = append(edges, EdgeData{
								ID:     edgeID,
								Source: dbNode.NodeID,
								Target: target,
							})
						}
					}
				}
			}
		}
	}

	return &SaveWorkflowNodesRequest{
		Nodes: nodes,
		Edges: edges,
	}, nil
}

// toPersistenceModel 将领域实体转换为持久化模型（用于返回给 Controller）
func toPersistenceModel(workflow *entity.Workflow) *models.Workflow {
	return &models.Workflow{
		ID:          workflow.ID,
		UserID:      workflow.UserID,
		ProjectID:   workflow.ProjectID,
		Name:        workflow.Name,
		Description: workflow.Description,
		Status:      workflow.Status,
		CreatedAt:   workflow.CreatedAt,
		UpdatedAt:   workflow.UpdatedAt,
	}
}

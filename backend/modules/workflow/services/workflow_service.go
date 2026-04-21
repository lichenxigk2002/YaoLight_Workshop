package services

import (
	"errors"
	"fmt"
	"strings"

	"yaolight-workshop/backend/domain/entity"
	"yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/workflow/models"
	workflowRepos "yaolight-workshop/backend/modules/workflow/repositories"
)

var (
	ErrWorkflowNotFound                  = errors.New("workflow not found")
	ErrPublishedWorkflowAPICanvasInvalid = errors.New("published workflow api canvas invalid")
)

type WorkflowService struct {
	workflowRepo     repository.WorkflowRepository
	workflowNodeRepo *workflowRepos.WorkflowNodeRepository
	commentCardRepo  *workflowRepos.WorkflowCommentCardRepository
}

func NewWorkflowService(workflowRepo repository.WorkflowRepository, workflowNodeRepo *workflowRepos.WorkflowNodeRepository, commentCardRepo *workflowRepos.WorkflowCommentCardRepository) *WorkflowService {
	return &WorkflowService{
		workflowRepo:     workflowRepo,
		workflowNodeRepo: workflowNodeRepo,
		commentCardRepo:  commentCardRepo,
	}
}

type CreateWorkflowRequest struct {
	Name        string  `json:"name" binding:"required,min=1,max=200"`
	Description *string `json:"description,omitempty"`
	ProjectID   *uint   `json:"projectId,omitempty"`
	UserID      uint    `json:"-"`
}

type UpdateWorkflowRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Status      *string `json:"status,omitempty"`
}

func (s *WorkflowService) CreateWorkflow(req *CreateWorkflowRequest) (*models.Workflow, error) {
	workflow := &entity.Workflow{
		UserID:      req.UserID,
		ProjectID:   req.ProjectID,
		Name:        req.Name,
		Description: req.Description,
		Status:      "draft",
	}

	if err := s.workflowRepo.Create(workflow); err != nil {
		return nil, err
	}

	return toPersistenceModel(workflow), nil
}

func (s *WorkflowService) GetWorkflowByID(id uint) (*models.Workflow, error) {
	workflow, err := s.workflowRepo.FindByID(id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

	return toPersistenceModel(workflow), nil
}

func (s *WorkflowService) GetWorkflowsByProjectID(projectID uint, page, pageSize int) ([]*models.Workflow, int64, error) {
	offset := (page - 1) * pageSize
	workflows, total, err := s.workflowRepo.FindByProjectID(projectID, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}

	modelList := make([]*models.Workflow, len(workflows))
	for i, workflow := range workflows {
		modelList[i] = toPersistenceModel(workflow)
	}

	return modelList, total, nil
}

func (s *WorkflowService) GetWorkflowsByUserID(userID uint, page, pageSize int) ([]*models.Workflow, int64, error) {
	offset := (page - 1) * pageSize
	workflows, total, err := s.workflowRepo.FindByUserID(userID, offset, pageSize)
	if err != nil {
		return nil, 0, err
	}

	modelList := make([]*models.Workflow, len(workflows))
	for i, workflow := range workflows {
		modelList[i] = toPersistenceModel(workflow)
	}

	return modelList, total, nil
}

func (s *WorkflowService) UpdateWorkflow(id uint, req *UpdateWorkflowRequest) (*models.Workflow, error) {
	workflow, err := s.workflowRepo.FindByID(id)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

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

func (s *WorkflowService) DeleteWorkflow(id uint) error {
	_, err := s.workflowRepo.FindByID(id)
	if err != nil {
		return ErrWorkflowNotFound
	}

	return s.workflowRepo.Delete(id)
}

type SaveWorkflowNodesRequest struct {
	Nodes        []WorkflowNodeData        `json:"nodes"`
	Edges        []EdgeData                `json:"edges"`
	CommentCards []WorkflowCommentCardData `json:"commentCards,omitempty"`
	TemplateID   *uint                     `json:"templateId,omitempty"`
}

type WorkflowNodeData struct {
	ID       string                 `json:"id"`
	Type     string                 `json:"type"`
	Position map[string]interface{} `json:"position"`
	Data     map[string]interface{} `json:"data"`
}

type EdgeData struct {
	ID           string `json:"id"`
	Source       string `json:"source"`
	Target       string `json:"target"`
	SourceHandle string `json:"sourceHandle,omitempty"`
	TargetHandle string `json:"targetHandle,omitempty"`
}

type WorkflowCommentCardData struct {
	ID       string                 `json:"id"`
	Position map[string]interface{} `json:"position"`
	Data     map[string]interface{} `json:"data"`
}

func (s *WorkflowService) SaveWorkflowNodes(workflowID uint, req *SaveWorkflowNodesRequest) error {
	workflow, err := s.workflowRepo.FindByID(workflowID)
	if err != nil {
		return ErrWorkflowNotFound
	}
	if err := s.validatePublishedAPICanvasSave(workflowID, req.Nodes); err != nil {
		return err
	}

	nodeIDs := make([]string, len(req.Nodes))
	nodes := make([]*models.WorkflowNode, len(req.Nodes))

	for i, nodeData := range req.Nodes {
		nodeIDs[i] = nodeData.ID

		config := workflowNodeDataValue(nodeData, "config")
		if config == nil {
			config = map[string]interface{}{}
		}

		var label *string
		if labelVal, ok := workflowNodeDataValue(nodeData, "label").(string); ok {
			label = &labelVal
		}

		connections := []map[string]interface{}{}
		for _, edge := range req.Edges {
			if edge.Source != nodeData.ID {
				continue
			}

			connection := map[string]interface{}{
				"target": edge.Target,
				"edgeId": edge.ID,
			}
			if edge.SourceHandle != "" {
				connection["sourceHandle"] = edge.SourceHandle
			}
			if edge.TargetHandle != "" {
				connection["targetHandle"] = edge.TargetHandle
			}
			connections = append(connections, connection)
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

	if err := s.workflowNodeRepo.BatchCreateOrUpdate(nodes); err != nil {
		return err
	}
	if err := s.workflowNodeRepo.DeleteByWorkflowIDAndNodeIDs(workflowID, nodeIDs); err != nil {
		return err
	}

	if req.CommentCards != nil {
		cardIDs := make([]string, len(req.CommentCards))
		cards := make([]*models.WorkflowCommentCard, len(req.CommentCards))

		for i, cardData := range req.CommentCards {
			cardIDs[i] = cardData.ID

			var text *string
			if textVal, ok := cardData.Data["text"].(string); ok {
				text = &textVal
			}

			color := "#fffacd"
			if colorVal, ok := cardData.Data["color"].(string); ok {
				color = colorVal
			}

			cards[i] = &models.WorkflowCommentCard{
				WorkflowID: workflowID,
				CardID:     cardData.ID,
				Position:   shared.JSONB{Data: cardData.Position},
				Text:       text,
				Color:      color,
			}
		}

		if err := s.commentCardRepo.BatchCreateOrUpdate(cards); err != nil {
			return err
		}
		if err := s.commentCardRepo.DeleteByWorkflowIDAndCardIDs(workflowID, cardIDs); err != nil {
			return err
		}
	}

	if (workflow.TemplateID == nil) != (req.TemplateID == nil) || (workflow.TemplateID != nil && req.TemplateID != nil && *workflow.TemplateID != *req.TemplateID) {
		if err := s.workflowRepo.UpdateTemplateReference(workflowID, req.TemplateID); err != nil {
			return err
		}
	}

	return nil
}

type SaveWorkflowNodeRequest struct {
	Node WorkflowNodeData `json:"node"`
}

func (s *WorkflowService) SaveWorkflowNode(workflowID uint, nodeID string, req *SaveWorkflowNodeRequest) error {
	_, err := s.workflowRepo.FindByID(workflowID)
	if err != nil {
		return ErrWorkflowNotFound
	}

	nodeData := req.Node
	if err := s.validatePublishedAPISingleNodeSave(workflowID, nodeID, nodeData); err != nil {
		return err
	}

	config := workflowNodeDataValue(nodeData, "config")
	if config == nil {
		config = map[string]interface{}{}
	}

	var label *string
	if labelVal, ok := workflowNodeDataValue(nodeData, "label").(string); ok {
		label = &labelVal
	}

	node := &models.WorkflowNode{
		WorkflowID: workflowID,
		NodeID:     nodeID,
		NodeType:   nodeData.Type,
		Label:      label,
		Position:   shared.JSONB{Data: nodeData.Position},
		Config:     shared.JSONB{Data: config},
		IsEnabled:  true,
	}

	return s.workflowNodeRepo.CreateOrUpdate(node)
}

func (s *WorkflowService) validatePublishedAPICanvasSave(workflowID uint, nodes []WorkflowNodeData) error {
	hasPublishedAPI, err := s.workflowNodeRepo.HasPublishedAPIEndpoint(workflowID)
	if err != nil || !hasPublishedAPI {
		return err
	}
	return validatePublishedAPICanvasNodes(nodes)
}

func (s *WorkflowService) validatePublishedAPISingleNodeSave(workflowID uint, nodeID string, nodeData WorkflowNodeData) error {
	hasPublishedAPI, err := s.workflowNodeRepo.HasPublishedAPIEndpoint(workflowID)
	if err != nil || !hasPublishedAPI {
		return err
	}

	existing, err := s.workflowNodeRepo.FindByWorkflowID(workflowID)
	if err != nil {
		return err
	}

	nodes := make([]WorkflowNodeData, 0, len(existing)+1)
	replaced := false
	for _, existingNode := range existing {
		if existingNode.NodeID == nodeID {
			nodes = append(nodes, nodeData)
			replaced = true
			continue
		}
		nodes = append(nodes, workflowNodeModelToData(existingNode))
	}
	if !replaced {
		nodes = append(nodes, nodeData)
	}

	return validatePublishedAPICanvasNodes(nodes)
}

func validatePublishedAPICanvasNodes(nodes []WorkflowNodeData) error {
	hasAPIInput := false
	hasAPIOutput := false
	for _, node := range nodes {
		config := workflowNodeConfig(node)
		if node.Type == "start" && workflowNodeConfigString(config, "inputMode", "manual") == "api_input" {
			hasAPIInput = true
		}
		if node.Type == "output" && workflowNodeConfigString(config, "outputMode", "artifact_export") == "api_output" {
			hasAPIOutput = true
		}
	}

	if !hasAPIInput {
		return fmt.Errorf("%w: 已发布 API 工作流至少需要一个开始节点设置为 api_input 模式", ErrPublishedWorkflowAPICanvasInvalid)
	}
	if !hasAPIOutput {
		return fmt.Errorf("%w: 已发布 API 工作流至少需要一个输出节点设置为 api_output 模式", ErrPublishedWorkflowAPICanvasInvalid)
	}
	return nil
}

func workflowNodeModelToData(node *models.WorkflowNode) WorkflowNodeData {
	position, _ := node.Position.Data.(map[string]interface{})
	data := map[string]interface{}{
		"config": node.Config.Data,
	}
	if node.Label != nil {
		data["label"] = *node.Label
	}
	return WorkflowNodeData{
		ID:       node.NodeID,
		Type:     node.NodeType,
		Position: position,
		Data:     data,
	}
}

func workflowNodeConfig(node WorkflowNodeData) map[string]interface{} {
	raw, _ := workflowNodeDataValue(node, "config").(map[string]interface{})
	return raw
}

func workflowNodeDataValue(node WorkflowNodeData, key string) interface{} {
	if node.Data == nil {
		return nil
	}
	return node.Data[key]
}

func workflowNodeConfigString(config map[string]interface{}, key string, fallback string) string {
	if config == nil {
		return fallback
	}
	value, ok := config[key]
	if !ok {
		return fallback
	}
	text, ok := value.(string)
	if !ok || strings.TrimSpace(text) == "" {
		return fallback
	}
	return strings.TrimSpace(text)
}

func (s *WorkflowService) GetWorkflowNodes(workflowID uint) (*SaveWorkflowNodesRequest, error) {
	workflow, err := s.workflowRepo.FindByID(workflowID)
	if err != nil {
		return nil, ErrWorkflowNotFound
	}

	dbNodes, err := s.workflowNodeRepo.FindByWorkflowID(workflowID)
	if err != nil {
		return nil, err
	}

	nodes := make([]WorkflowNodeData, len(dbNodes))
	edges := make([]EdgeData, 0)

	for i, dbNode := range dbNodes {
		position := map[string]interface{}{}
		if posMap, ok := dbNode.Position.Data.(map[string]interface{}); ok {
			position = posMap
		}

		config := map[string]interface{}{}
		if configMap, ok := dbNode.Config.Data.(map[string]interface{}); ok {
			config = configMap
		}

		nodeData := map[string]interface{}{
			"label":  dbNode.Label,
			"type":   dbNode.NodeType,
			"config": config,
		}
		if direction, ok := config["connectionDirection"]; ok {
			nodeData["connectionDirection"] = direction
		}

		nodes[i] = WorkflowNodeData{
			ID:       dbNode.NodeID,
			Type:     dbNode.NodeType,
			Position: position,
			Data:     nodeData,
		}

		if conns, ok := dbNode.Connections.Data.([]interface{}); ok {
			for _, conn := range conns {
				connMap, ok := conn.(map[string]interface{})
				if !ok {
					continue
				}
				target, ok := connMap["target"].(string)
				if !ok {
					continue
				}

				edgeID := dbNode.NodeID + "-" + target
				if edgeIDVal, ok := connMap["edgeId"].(string); ok && edgeIDVal != "" {
					edgeID = edgeIDVal
				}

				edge := EdgeData{
					ID:     edgeID,
					Source: dbNode.NodeID,
					Target: target,
				}
				if sourceHandle, ok := connMap["sourceHandle"].(string); ok {
					edge.SourceHandle = sourceHandle
				}
				if targetHandle, ok := connMap["targetHandle"].(string); ok {
					edge.TargetHandle = targetHandle
				}
				edges = append(edges, edge)
			}
		}
	}

	dbCommentCards, err := s.commentCardRepo.FindByWorkflowID(workflowID)
	if err != nil {
		return nil, err
	}

	commentCards := make([]WorkflowCommentCardData, len(dbCommentCards))
	for i, dbCard := range dbCommentCards {
		position := map[string]interface{}{}
		if posMap, ok := dbCard.Position.Data.(map[string]interface{}); ok {
			position = posMap
		}

		cardData := map[string]interface{}{
			"text":  dbCard.Text,
			"color": dbCard.Color,
		}

		commentCards[i] = WorkflowCommentCardData{
			ID:       dbCard.CardID,
			Position: position,
			Data:     cardData,
		}
	}

	return &SaveWorkflowNodesRequest{
		Nodes:        nodes,
		Edges:        edges,
		CommentCards: commentCards,
		TemplateID:   workflow.TemplateID,
	}, nil
}

func toPersistenceModel(workflow *entity.Workflow) *models.Workflow {
	return &models.Workflow{
		ID:          workflow.ID,
		UserID:      workflow.UserID,
		ProjectID:   workflow.ProjectID,
		TemplateID:  workflow.TemplateID,
		Name:        workflow.Name,
		Description: workflow.Description,
		Status:      workflow.Status,
		CreatedAt:   workflow.CreatedAt,
		UpdatedAt:   workflow.UpdatedAt,
	}
}

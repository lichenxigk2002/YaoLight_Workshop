package services

import (
	"fmt"
	"strings"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/modules/ai/services/providers"
	"yaolight-workshop/backend/modules/ai/services/providers/deepseek"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

// AlkaidService 瑶光星服务
type AlkaidService struct {
	repo                *alkaidRepos.AlkaidRepository
	capabilitiesService *CapabilitiesService
	knowledgeService    *KnowledgeService
	aiProvider          providers.AIProvider
}

// NewAlkaidService 创建瑶光星服务
func NewAlkaidService() *AlkaidService {
	return &AlkaidService{
		repo:                alkaidRepos.NewAlkaidRepository(),
		capabilitiesService: NewCapabilitiesService(),
		knowledgeService:    &KnowledgeService{},
		aiProvider:          deepseek.NewDeepSeekProvider(),
	}
}

// CreateSessionRequest 创建会话请求
type CreateSessionRequest struct {
	UserID     uint   `json:"userId"`
	Title      string `json:"title"`
	WorkflowID *uint  `json:"workflowId,omitempty"`
}

// CreateSession 创建会话
func (s *AlkaidService) CreateSession(req CreateSessionRequest) (*alkaidModels.AlkaidSession, error) {
	session := &alkaidModels.AlkaidSession{
		UserID:     req.UserID,
		Title:      req.Title,
		WorkflowID: req.WorkflowID,
		Status:     "active",
	}

	if err := s.repo.CreateSession(session); err != nil {
		return nil, fmt.Errorf("创建会话失败: %w", err)
	}

	return session, nil
}

// GetSession 获取会话
func (s *AlkaidService) GetSession(sessionID uint) (*alkaidModels.AlkaidSession, error) {
	return s.repo.GetSessionByID(sessionID)
}

// GetUserSessions 获取用户的会话列表
func (s *AlkaidService) GetUserSessions(userID uint, page, pageSize int) ([]alkaidModels.AlkaidSession, int64, error) {
	offset := (page - 1) * pageSize
	return s.repo.GetSessionsByUserID(userID, pageSize, offset)
}

// UpdateSessionTitle 更新会话标题
func (s *AlkaidService) UpdateSessionTitle(sessionID uint, title string) error {
	session, err := s.repo.GetSessionByID(sessionID)
	if err != nil {
		return err
	}

	session.Title = title
	return s.repo.UpdateSession(session)
}

// DeleteSession 删除会话
func (s *AlkaidService) DeleteSession(sessionID uint) error {
	return s.repo.DeleteSession(sessionID)
}

// SendMessageRequest 发送消息请求
type SendMessageRequest struct {
	SessionID uint   `json:"sessionId"`
	UserID    uint   `json:"userId"`
	Content   string `json:"content"`
}

// SendMessageResponse 发送消息响应
type SendMessageResponse struct {
	Message          *alkaidModels.AlkaidMessage `json:"message"`
	AssistantMessage *alkaidModels.AlkaidMessage `json:"assistantMessage"`
}

// SendMessageStreamCallback 流式发送消息回调
type SendMessageStreamCallback func(content string, step string, done bool, err error)

// SendMessageStream 流式发送消息并获取AI回复
func (s *AlkaidService) SendMessageStream(req SendMessageRequest, callback SendMessageStreamCallback) (*alkaidModels.AlkaidMessage, error) {
	// 1. 验证会话存在且属于该用户
	session, err := s.repo.GetSessionByID(req.SessionID)
	if err != nil {
		callback("", "", true, fmt.Errorf("会话不存在"))
		return nil, fmt.Errorf("会话不存在")
	}
	if session.UserID != req.UserID {
		callback("", "", true, fmt.Errorf("无权访问该会话"))
		return nil, fmt.Errorf("无权访问该会话")
	}

	// 2. 保存用户消息
	userMessage := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "user",
		Content:   req.Content,
		Type:      "text",
	}
	if err := s.repo.CreateMessage(userMessage); err != nil {
		callback("", "", true, fmt.Errorf("保存用户消息失败: %w", err))
		return nil, fmt.Errorf("保存用户消息失败: %w", err)
	}

	// 通知前端：正在理解需求
	callback("", "understanding", false, nil)

	// 3. 构建AI配置（使用deepseek系统预设）
	aiConfig, err := s.buildAIConfig(req.UserID)
	if err != nil {
		callback("", "", true, fmt.Errorf("构建AI配置失败: %w", err))
		return nil, fmt.Errorf("构建AI配置失败: %w", err)
	}

	// 4. 获取对话历史（不包括刚保存的这条用户消息）
	historyMessages, err := s.repo.GetMessagesBySessionID(req.SessionID, 0) // 0表示获取所有消息
	if err != nil {
		callback("", "", true, fmt.Errorf("获取对话历史失败: %w", err))
		return nil, fmt.Errorf("获取对话历史失败: %w", err)
	}

	// 通知前端：正在检索知识库
	callback("", "retrieving", false, nil)

	// 5. 构建Prompt（首次对话时注入知识库上下文，后续对话按需检索）
	var systemPrompt string
	var conversationHistory string

	if len(historyMessages) <= 1 { // 只有刚保存的一条用户消息，说明是首次对话
		// 首次对话：根据用户问题智能检索相关知识库
		systemPrompt, err = s.buildSystemPrompt(req.UserID, req.Content)
		if err != nil {
			callback("", "", true, fmt.Errorf("构建系统Prompt失败: %w", err))
			return nil, fmt.Errorf("构建系统Prompt失败: %w", err)
		}
		conversationHistory = "" // 首次对话没有历史
	} else {
		// 后续对话：也根据当前用户消息按需检索知识库，并构建对话历史
		systemPrompt, err = s.buildSystemPrompt(req.UserID, req.Content)
		if err != nil {
			callback("", "", true, fmt.Errorf("构建系统Prompt失败: %w", err))
			return nil, fmt.Errorf("构建系统Prompt失败: %w", err)
		}
		// 排除刚保存的这条用户消息，只使用之前的消息构建历史
		prevMessages := historyMessages[:len(historyMessages)-1]
		conversationHistory = s.buildConversationHistory(prevMessages)
	}

	// 6. 构建用户消息（包含对话历史）
	userPrompt := req.Content
	if conversationHistory != "" {
		userPrompt = conversationHistory + "\n\n用户：" + req.Content
	}

	// 通知前端：正在生成工作流
	callback("", "generating", false, nil)

	// 7. 调用AI生成回复
	aiResponse, err := s.aiProvider.Chat(
		aiConfig,
		systemPrompt,
		userPrompt,
		map[string]interface{}{
			"stream":   false,
			"thinking": false, // 关闭thinking模式以提高速度
		},
	)
	if err != nil {
		callback("", "", true, fmt.Errorf("AI调用失败: %w", err))
		return nil, fmt.Errorf("AI调用失败: %w", err)
	}

	// 7. 保存AI回复
	assistantMessage := &alkaidModels.AlkaidMessage{
		SessionID: req.SessionID,
		Role:      "assistant",
		Content:   aiResponse.Content,
		Type:      "text",
	}
	if err := s.repo.CreateMessage(assistantMessage); err != nil {
		callback("", "", true, fmt.Errorf("保存AI回复失败: %w", err))
		return nil, fmt.Errorf("保存AI回复失败: %w", err)
	}

	// 8. 更新会话标题（如果是首次对话，从用户消息生成标题）
	if session.Title == "" || session.Title == "新对话" {
		title := s.generateSessionTitle(req.Content)
		// 使用rune来正确处理UTF-8字符，避免截断导致编码错误
		titleRunes := []rune(title)
		if len(titleRunes) > 200 {
			title = string(titleRunes[:200])
		}
		session.Title = title
		s.repo.UpdateSession(session)
	}

	// 通知前端：完成
	callback(aiResponse.Content, "completed", true, nil)

	return assistantMessage, nil
}

// SendMessage 发送消息并获取AI回复（保留原有接口，用于兼容）
func (s *AlkaidService) SendMessage(req SendMessageRequest) (*SendMessageResponse, error) {
	// 复用流式逻辑，但同步等待结果
	var assistantMessage *alkaidModels.AlkaidMessage
	var finalErr error

	_, err := s.SendMessageStream(req, func(content string, step string, done bool, err error) {
		if err != nil {
			finalErr = err
		}
	})

	if err != nil {
		return nil, err
	}
	if finalErr != nil {
		return nil, finalErr
	}

	// 由于SendMessageStream内部已经保存了消息，这里只需要重新查询一下
	// 或者修改SendMessageStream返回assistantMessage
	// 这里为了简单，重新查询最新的一条助手消息
	messages, err := s.repo.GetLatestMessages(req.SessionID, 1)
	if err != nil || len(messages) == 0 {
		return nil, fmt.Errorf("获取回复失败")
	}
	assistantMessage = &messages[0]

	// 获取用户消息
	userMessages, _ := s.repo.GetMessagesBySessionID(req.SessionID, 0)
	var userMessage *alkaidModels.AlkaidMessage
	// 找到刚才发送的用户消息（倒数第二条，因为最后一条是助手回复）
	if len(userMessages) >= 2 {
		userMessage = &userMessages[len(userMessages)-2]
	}

	return &SendMessageResponse{
		Message:          userMessage,
		AssistantMessage: assistantMessage,
	}, nil
}

// GetMessages 获取会话的消息列表
func (s *AlkaidService) GetMessages(sessionID uint, limit int) ([]alkaidModels.AlkaidMessage, error) {
	if limit > 0 {
		return s.repo.GetLatestMessages(sessionID, limit)
	}
	return s.repo.GetMessagesBySessionID(sessionID, 0)
}

// buildAIConfig 构建AI配置（使用deepseek系统预设）
func (s *AlkaidService) buildAIConfig(userID uint) (*providers.AIModelConfig, error) {
	// 检查系统是否配置了DeepSeek API Key
	if config.DeepSeekAPIKey == "" {
		return nil, fmt.Errorf("系统未配置DeepSeek API Key，请在.env中配置DEEPSEEK_API_KEY")
	}

	return &providers.AIModelConfig{
		Provider:     "deepseek",
		ModelName:    "deepseek-chat",
		APIKey:       config.DeepSeekAPIKey,
		BaseURL:      "https://api.deepseek.com",
		Temperature:  floatPtr(0.7),
		MaxTokens:    intPtr(4000), // 增大maxTokens以支持长上下文
		SystemPrompt: "",           // SystemPrompt在调用时传入
	}, nil
}

// buildSystemPrompt 构建系统Prompt（注入知识库上下文，按需检索）
func (s *AlkaidService) buildSystemPrompt(userID uint, userMessage string) (string, error) {
	// 1. 获取能力说明（硬约束，必须）
	capabilities, err := s.capabilitiesService.GetCapabilities()
	if err != nil {
		return "", err
	}

	// 2. 智能检索相关知识库（软知识，按需加载）
	// 默认检索5-8条，如果必要可以更多
	retriever := NewKnowledgeRetriever()
	relevantKnowledge, err := retriever.RetrieveRelevantKnowledge(userMessage, userID, 8)
	if err != nil {
		// 如果检索失败，继续使用 Capabilities（不影响核心功能）
		relevantKnowledge = []alkaidModels.AlkaidKnowledge{}
	}

	// 3. 构建Prompt（包含Capabilities和按需检索的知识库）
	promptBuilder := NewPromptBuilder(capabilities, relevantKnowledge)
	systemPrompt := promptBuilder.BuildSystemPrompt()

	return systemPrompt, nil
}

// buildConversationHistory 构建对话历史文本
func (s *AlkaidService) buildConversationHistory(messages []alkaidModels.AlkaidMessage) string {
	if len(messages) == 0 {
		return ""
	}

	var history strings.Builder
	for _, msg := range messages {
		roleLabel := "用户"
		if msg.Role == "assistant" {
			roleLabel = "助手"
		}
		history.WriteString(fmt.Sprintf("%s：%s\n", roleLabel, msg.Content))
	}

	return history.String()
}

// generateSessionTitle 生成会话标题（从用户消息提取）
func (s *AlkaidService) generateSessionTitle(userMessage string) string {
	// 使用rune来正确处理UTF-8字符，避免截断导致编码错误
	runes := []rune(userMessage)
	maxLength := 50
	if len(runes) <= maxLength {
		return userMessage
	}
	// 截取前50个字符（rune），确保不会破坏UTF-8编码
	return string(runes[:maxLength]) + "..."
}

// floatPtr 创建float64指针
func floatPtr(f float64) *float64 {
	return &f
}

// intPtr 创建int指针
func intPtr(i int) *int {
	return &i
}

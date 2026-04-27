package services

import (
	"context"
	"fmt"
	"strings"
	"yaolight-workshop/backend/infrastructure/config"
	aiServices "yaolight-workshop/backend/modules/ai/services"
	"yaolight-workshop/backend/modules/ai/services/providers"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
	userServices "yaolight-workshop/backend/modules/user/services"
)

// AlkaidService 瑶光星服务
type AlkaidService struct {
	repo                *alkaidRepos.AlkaidRepository
	capabilitiesService *CapabilitiesService
	knowledgeService    *KnowledgeService
	intentAnalyzer      *IntentAnalyzer
	aiProvider          providers.AIProvider
	transactionService  *userServices.TransactionService
}

// NewAlkaidService 创建瑶光星服务
func NewAlkaidService() *AlkaidService {
	return &AlkaidService{
		repo:                alkaidRepos.NewAlkaidRepository(),
		capabilitiesService: NewCapabilitiesService(),
		knowledgeService:    &KnowledgeService{},
		intentAnalyzer:      NewIntentAnalyzer(),
		aiProvider:          mustDefaultAlkaidAIProvider(),
		transactionService:  userServices.NewTransactionService(),
	}
}

func mustDefaultAlkaidAIProvider() providers.AIProvider {
	provider, err := aiServices.NewProviderFactory().GetProvider("gpt")
	if err != nil {
		panic(err)
	}
	return provider
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

	// 3. 获取对话历史（不包括刚保存的这条用户消息）
	historyMessages, err := s.repo.GetMessagesBySessionID(req.SessionID, 0) // 0表示获取所有消息
	if err != nil {
		callback("", "", true, fmt.Errorf("获取对话历史失败: %w", err))
		return nil, fmt.Errorf("获取对话历史失败: %w", err)
	}

	// 构建对话历史文本
	var conversationHistory string
	if len(historyMessages) > 1 {
		prevMessages := historyMessages[:len(historyMessages)-1]
		conversationHistory = s.buildConversationHistory(prevMessages)
	}

	// 4. **第一阶段：分析用户意图，判断是否需要生成工作流（不显示给用户，不存储）**
	needsWorkflow, err := s.intentAnalyzer.AnalyzeIntent(req.Content, conversationHistory)
	if err != nil {
		// 如果分析失败，默认需要生成工作流（保守策略）
		needsWorkflow = true
	}

	// 注意：意图分析结果不发送给前端，不存储，只在后端内部使用

	// 5. **根据分析结果决定是否加载工作流配置**
	var systemPrompt string
	if needsWorkflow {
		// 需要生成工作流：加载完整的工作流配置
		// 通知前端：正在理解需求（此时才开始显示给用户）
		callback("", "understanding", false, nil)
		callback("", "retrieving", false, nil)
		systemPrompt, err = s.buildSystemPrompt(req.UserID, req.Content)
		if err != nil {
			callback("", "", true, fmt.Errorf("构建系统Prompt失败: %w", err))
			return nil, fmt.Errorf("构建系统Prompt失败: %w", err)
		}
	} else {
		// 不需要生成工作流：使用简化的通用对话Prompt
		// 通知前端：正在理解需求（此时才开始显示给用户）
		callback("", "understanding", false, nil)
		systemPrompt = s.buildGeneralChatPrompt()
	}

	// 6. 构建AI配置（使用通义千问系统预设）
	aiConfig, err := s.buildAIConfig(req.UserID)
	if err != nil {
		callback("", "", true, fmt.Errorf("构建AI配置失败: %w", err))
		return nil, fmt.Errorf("构建AI配置失败: %w", err)
	}

	// 7. 构建用户消息（包含对话历史）
	userPrompt := req.Content
	if conversationHistory != "" {
		userPrompt = conversationHistory + "\n\n用户：" + req.Content
	}

	// 8. 根据意图决定通知前端的步骤
	if needsWorkflow {
		// 需要生成工作流：通知前端正在生成工作流
		callback("", "generating", false, nil)
	} else {
		// 不需要生成工作流：通知前端正在回复（跳过retrieving和generating步骤）
		callback("", "replying", false, nil)
	}

	// 9. 调用AI流式生成回复（强制启用流式输出）
	var fullContent strings.Builder
	var fullReasoningContent strings.Builder
	var streamErr error
	var assistantMessage *alkaidModels.AlkaidMessage
	var finalUsage *providers.TokenUsage // 用于捕获流式过程中返回的Token用量

	// 使用 context 来支持取消操作
	ctx := context.Background()

	err = s.aiProvider.ChatStream(
		ctx,
		aiConfig,
		systemPrompt,
		userPrompt,
		map[string]interface{}{
			"stream":   true,  // 强制启用流式输出
			"thinking": false, // 关闭thinking模式以提高速度
		},
		func(content string, done bool, err error, usage *providers.TokenUsage) {
			if err != nil {
				streamErr = err
				callback("", "", true, fmt.Errorf("AI流式调用失败: %w", err))
				return
			}

			// 捕获Usage信息（Provider可能会在done=false时发送Usage）
			if usage != nil {
				finalUsage = usage
			}

			// 处理流式内容
			if strings.HasPrefix(content, "[REASONING_DELTA]") {
				// 思考内容增量
				delta := strings.TrimPrefix(content, "[REASONING_DELTA]")
				fullReasoningContent.WriteString(delta)
				// 暂时不发送思考内容到前端，只累积
			} else if strings.HasPrefix(content, "[CONTENT_DELTA]") {
				// 正式内容增量
				delta := strings.TrimPrefix(content, "[CONTENT_DELTA]")
				fullContent.WriteString(delta)
				// 实时发送内容增量到前端
				callback(delta, "generating", false, nil)
			} else if strings.HasPrefix(content, "[REASONING]") && strings.Contains(content, "[/REASONING]") {
				// 完整的思考内容
				reasoningStart := strings.Index(content, "[REASONING]") + len("[REASONING]")
				reasoningEnd := strings.Index(content, "[/REASONING]")
				if reasoningEnd > reasoningStart {
					reasoning := content[reasoningStart:reasoningEnd]
					fullReasoningContent.WriteString(reasoning)
				}
			} else if strings.HasPrefix(content, "[CONTENT]") && strings.Contains(content, "[/CONTENT]") {
				// 完整的内容（通常在done=true时收到）
				// 注意：此时不应该再发送内容，因为内容已经在流式过程中通过[CONTENT_DELTA]逐字发送过了
				// fullContent中已经包含了所有内容，所以这里直接跳过
				// 如果fullContent为空（理论上不应该发生），才提取内容
				if fullContent.Len() == 0 {
					contentStart := strings.Index(content, "[CONTENT]") + len("[CONTENT]")
					contentEnd := strings.Index(content, "[/CONTENT]")
					if contentEnd > contentStart {
						actualContent := content[contentStart:contentEnd]
						fullContent.WriteString(actualContent)
					}
				}
				// 不发送给前端，因为内容已经在流式过程中发送过了
			} else if content != "" {
				// 普通内容增量（没有标记）
				fullContent.WriteString(content)
				callback(content, "generating", false, nil)
			}

			// 如果完成，保存完整回复
			if done {
				finalContent := fullContent.String()

				// 保存AI回复
				assistantMessage = &alkaidModels.AlkaidMessage{
					SessionID: req.SessionID,
					Role:      "assistant",
					Content:   finalContent,
					Type:      "text",
				}
				if err := s.repo.CreateMessage(assistantMessage); err != nil {
					streamErr = fmt.Errorf("保存AI回复失败: %w", err)
					callback("", "", true, streamErr)
					return
				}

				// 更新会话标题（如果是首次对话，从用户消息生成标题）
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
				callback("", "completed", true, nil)

				// 10. 记录Token使用情况（无论是否成功）
				if finalUsage != nil {
					// 瑶光星助手对话目前不扣费（cost=0），只记录使用量
					// 后续如果需要收费，可以将ModelMode改为"system"
					// 构造描述信息
					desc := fmt.Sprintf("瑶光星AI助手对话（会话ID: %d）", req.SessionID)

					// 使用 TransactionService 记录
					recordErr := s.transactionService.RecordTokenUsage(userServices.RecordTokenUsageRequest{
						UserID:    req.UserID,
						Usage:     finalUsage,
						Provider:  aiConfig.Provider,
						ModelName: aiConfig.ModelName,
						ModelMode: "system", // 使用 system 模式，启用扣费
						ModelID:   nil,      // 系统内置模型，无 ModelID
						RelatedID: fmt.Sprintf("%d", req.SessionID),
						Type:      "chat",
						Desc:      desc,
					})

					if recordErr != nil {
						fmt.Printf("记录Token使用失败: %v\n", recordErr)
					}
				}
			}
		},
	)

	if err != nil {
		callback("", "", true, fmt.Errorf("AI调用失败: %w", err))
		return nil, fmt.Errorf("AI调用失败: %w", err)
	}

	if streamErr != nil {
		return nil, streamErr
	}

	// 如果流式回调中没有创建消息，尝试获取最后保存的助手消息
	if assistantMessage == nil {
		messages, err := s.repo.GetLatestMessages(req.SessionID, 1)
		if err != nil || len(messages) == 0 {
			return nil, fmt.Errorf("获取AI回复失败")
		}
		assistantMessage = &messages[0]
	}

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

// GetConversationHistoryForAgentic 获取最近 N 条消息并格式化为对话历史，供 Agentic 流带入上下文
func (s *AlkaidService) GetConversationHistoryForAgentic(sessionID uint, maxMessages int) (string, error) {
	if maxMessages <= 0 {
		maxMessages = 20
	}
	messages, err := s.repo.GetLatestMessages(sessionID, maxMessages)
	if err != nil {
		return "", err
	}
	return s.buildConversationHistory(messages), nil
}

// GetCapabilities 获取瑶光星能力说明（节点类型、工作流格式、规则等），供智能体/前端使用
func (s *AlkaidService) GetCapabilities() (*WorkflowCapabilities, error) {
	return s.capabilitiesService.GetCapabilities()
}

// buildAIConfig 构建AI配置（默认使用 OpenRouter GPT 系统预设）
func (s *AlkaidService) buildAIConfig(userID uint) (*providers.AIModelConfig, error) {
	apiKey := strings.TrimSpace(config.OpenRouterAPIKey)
	if apiKey == "" {
		apiKey = strings.TrimSpace(config.OpenAIAPIKey)
	}
	if apiKey == "" {
		return nil, fmt.Errorf("系统未配置 OpenRouter API Key，请在.env中配置 OPENROUTER_API_KEY")
	}
	baseURL := strings.TrimSpace(config.OpenAIBaseURL)
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	modelName := strings.TrimSpace(config.OpenAIChatModel)
	if modelName == "" {
		modelName = "openai/gpt-5.4"
	}
	maxTokens := config.OpenAIMaxOutputTokens
	if maxTokens <= 0 {
		maxTokens = 8192
	}

	return &providers.AIModelConfig{
		Provider:              "gpt",
		ModelName:             modelName,
		APIKey:                apiKey,
		BaseURL:               baseURL,
		Temperature:           floatPtr(0.7),
		MaxTokens:             intPtr(maxTokens), // 增大maxTokens以支持长上下文
		SystemPrompt:          "",                // SystemPrompt在调用时传入
		RequestTimeoutSeconds: config.AIRequestTimeoutSeconds,
	}, nil
}

// BuildSystemPromptForAgentic 供 Agentic 流调用，构建生成工作流用的系统 Prompt
func (s *AlkaidService) BuildSystemPromptForAgentic(userID uint, userMessage string) (string, error) {
	return s.buildSystemPrompt(userID, userMessage)
}

// BuildGeneralChatPromptForAgentic 返回普通问答场景使用的轻量系统提示词。
func (s *AlkaidService) BuildGeneralChatPromptForAgentic() string {
	return s.buildGeneralChatPrompt()
}

// GetRelevantKnowledgeForAgentic 供 Agentic 流展示「检索知识库」步骤，返回检索到的知识库条目（可传入 nil 表示按需检索）
func (s *AlkaidService) GetRelevantKnowledgeForAgentic(userID uint, userMessage string, maxResults int) ([]alkaidModels.AlkaidKnowledge, error) {
	if maxResults <= 0 {
		maxResults = 8
	}
	retriever := NewKnowledgeRetriever()
	return retriever.RetrieveRelevantKnowledge(userMessage, userID, maxResults)
}

// BuildSystemPromptForAgenticWithKnowledge 使用已检索的知识库构建系统 Prompt，避免重复检索
func (s *AlkaidService) BuildSystemPromptForAgenticWithKnowledge(userID uint, userMessage string, relevantKnowledge []alkaidModels.AlkaidKnowledge, currentWorkflow interface{}) (string, error) {
	return s.buildSystemPromptWithKnowledge(userID, relevantKnowledge, currentWorkflow)
}

// buildSystemPrompt 构建系统Prompt（注入知识库上下文，按需检索）
func (s *AlkaidService) buildSystemPrompt(userID uint, userMessage string) (string, error) {
	relevantKnowledge, err := s.GetRelevantKnowledgeForAgentic(userID, userMessage, 8)
	if err != nil {
		relevantKnowledge = []alkaidModels.AlkaidKnowledge{}
	}
	return s.buildSystemPromptWithKnowledge(userID, relevantKnowledge, nil)
}

// buildSystemPromptWithKnowledge 使用指定知识库条目构建系统 Prompt
func (s *AlkaidService) buildSystemPromptWithKnowledge(userID uint, relevantKnowledge []alkaidModels.AlkaidKnowledge, currentWorkflow interface{}) (string, error) {
	capabilities, err := s.capabilitiesService.GetCapabilities()
	if err != nil {
		return "", err
	}
	promptBuilder := NewPromptBuilder(capabilities, relevantKnowledge, currentWorkflow)
	return promptBuilder.BuildSystemPrompt(), nil
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

// buildGeneralChatPrompt 构建通用对话Prompt（不需要生成工作流时使用）
func (s *AlkaidService) buildGeneralChatPrompt() string {
	return `你是一个友好的AI助手（瑶光星）。你可以与用户自然对话，回答他们的问题，提供帮助和建议。

## 对话规则

1. **自然对话**：保持自然、友好的语气，不要使用固定的模板话术
2. **回答问题**：如果用户询问功能使用方法、技术问题等，给出清晰的回答
3. **提供建议**：如果用户询问如何实现某个功能，可以提供建议和指导
4. **工作流相关**：如果用户想要生成工作流，可以引导他们描述具体需求
5. **工具使用**：必要时可以调用只读平台工具来补充事实，例如知识检索、节点规格、当前工作流、项目网站源、工作流列表和可用模型

## 注意事项

- 不要生成工作流JSON（除非用户明确要求）
- 不要假装已经修改、校验或试跑了工作流，除非相关模式真的执行了这些动作
- 保持对话的自然和流畅
- 根据用户的问题提供有用的信息`
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

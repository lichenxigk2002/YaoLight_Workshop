package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	"yaolight-workshop/backend/modules/ai/services/providers"
	systemModels "yaolight-workshop/backend/modules/system/models"
)

const (
	AIModelMonitoringConfigKey = "ai_model_monitoring_auto_enabled"
	defaultProbeInterval       = 15 * time.Minute
	maxProbeConcurrency        = 4
)

var ErrMonitoringAlreadyRunning = errors.New("ai model monitoring run already in progress")

type MonitoringSettings struct {
	AutoEnabled          bool `json:"auto_enabled"`
	ProbeIntervalMinutes int  `json:"probe_interval_minutes"`
}

type MonitoringSummary struct {
	TotalModels         int `json:"total_models"`
	HealthyModels       int `json:"healthy_models"`
	FailedModels        int `json:"failed_models"`
	UnknownModels       int `json:"unknown_models"`
	NotConfiguredModels int `json:"not_configured_models"`
	UnsupportedModels   int `json:"unsupported_models"`
}

type MonitoringModelItem struct {
	ManagedModelID      uint       `json:"managed_model_id"`
	Provider            string     `json:"provider"`
	ModelName           string     `json:"model_name"`
	DisplayName         string     `json:"display_name"`
	Status              string     `json:"status"`
	IsActive            bool       `json:"is_active"`
	ProbeStatus         string     `json:"probe_status"`
	LastCheckedAt       *time.Time `json:"last_checked_at,omitempty"`
	LastSuccessAt       *time.Time `json:"last_success_at,omitempty"`
	LastLatencyMs       *int       `json:"last_latency_ms,omitempty"`
	LastError           *string    `json:"last_error,omitempty"`
	LastResponsePreview *string    `json:"last_response_preview,omitempty"`
	LastProbeMode       *string    `json:"last_probe_mode,omitempty"`
	ConsecutiveFailures int        `json:"consecutive_failures"`
}

type MonitoringSnapshot struct {
	Settings   MonitoringSettings    `json:"settings"`
	Summary    MonitoringSummary     `json:"summary"`
	IsChecking bool                  `json:"is_checking"`
	Items      []MonitoringModelItem `json:"items"`
}

type AIModelMonitoringService struct {
	db               *gorm.DB
	managedModelRepo aiRepos.ManagedAIModelRepository
	capabilityRepo   aiRepos.CapabilityConfigRepository
	providerFactory  *ProviderFactory
	probeInterval    time.Duration
	running          int32
	lastRunMu        sync.Mutex
	lastRunAt        time.Time
}

func NewAIModelMonitoringService(db *gorm.DB) *AIModelMonitoringService {
	return &AIModelMonitoringService{
		db:               db,
		managedModelRepo: aiRepos.NewManagedAIModelRepository(db),
		capabilityRepo:   aiRepos.NewCapabilityConfigRepository(db),
		providerFactory:  NewProviderFactory(),
		probeInterval:    defaultProbeInterval,
	}
}

func (s *AIModelMonitoringService) Start(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if s.IsRunning() {
				continue
			}

			enabled, err := s.GetAutoEnabled()
			if err != nil {
				log.Printf("[AI Monitoring] load auto-enabled flag failed: %v", err)
				continue
			}
			if !enabled {
				continue
			}

			if !s.shouldRun() {
				continue
			}

			go func() {
				if _, err := s.RunFullProbe("auto"); err != nil && !errors.Is(err, ErrMonitoringAlreadyRunning) {
					log.Printf("[AI Monitoring] auto probe failed: %v", err)
				}
			}()
		}
	}
}

func (s *AIModelMonitoringService) GetSnapshot() (*MonitoringSnapshot, error) {
	autoEnabled, err := s.GetAutoEnabled()
	if err != nil {
		return nil, err
	}

	models, err := s.managedModelRepo.FindAll()
	if err != nil {
		return nil, err
	}

	var probeResults []aiModels.AIModelProbeResult
	if err := s.db.Find(&probeResults).Error; err != nil {
		return nil, err
	}

	resultByModelID := make(map[uint]aiModels.AIModelProbeResult, len(probeResults))
	for _, row := range probeResults {
		resultByModelID[row.ManagedModelID] = row
	}

	items := make([]MonitoringModelItem, 0, len(models))
	summary := MonitoringSummary{TotalModels: len(models)}
	for _, model := range models {
		item := MonitoringModelItem{
			ManagedModelID: model.ID,
			Provider:       model.Provider,
			ModelName:      model.ModelName,
			DisplayName:    model.DisplayName,
			Status:         model.Status,
			IsActive:       model.IsActive,
			ProbeStatus:    "unknown",
		}

		if row, ok := resultByModelID[model.ID]; ok {
			item.ProbeStatus = normalizeProbeStatus(row.ProbeStatus)
			item.LastCheckedAt = row.LastCheckedAt
			item.LastSuccessAt = row.LastSuccessAt
			item.LastLatencyMs = row.LastLatencyMs
			item.LastError = row.LastError
			item.LastResponsePreview = row.LastResponsePreview
			item.LastProbeMode = row.LastProbeMode
			item.ConsecutiveFailures = row.ConsecutiveFailures
		}

		switch item.ProbeStatus {
		case "healthy":
			summary.HealthyModels++
		case "failed":
			summary.FailedModels++
		case "not_configured":
			summary.NotConfiguredModels++
		case "unsupported":
			summary.UnsupportedModels++
		default:
			summary.UnknownModels++
		}

		items = append(items, item)
	}

	return &MonitoringSnapshot{
		Settings: MonitoringSettings{
			AutoEnabled:          autoEnabled,
			ProbeIntervalMinutes: int(s.probeInterval / time.Minute),
		},
		Summary:    summary,
		IsChecking: s.IsRunning(),
		Items:      items,
	}, nil
}

func (s *AIModelMonitoringService) GetAutoEnabled() (bool, error) {
	var cfg systemModels.SystemConfig
	err := s.db.Where("key = ?", AIModelMonitoringConfigKey).First(&cfg).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	if value, ok := cfg.Value.Data.(map[string]interface{}); ok {
		if enabled, ok := value["enabled"].(bool); ok {
			return enabled, nil
		}
	}

	return false, nil
}

func (s *AIModelMonitoringService) SetAutoEnabled(enabled bool) (*MonitoringSettings, error) {
	description := "AI model automatic monitoring toggle"
	category := "ai"
	payload := shared.JSONB{Data: map[string]interface{}{"enabled": enabled}}

	var cfg systemModels.SystemConfig
	err := s.db.Where("key = ?", AIModelMonitoringConfigKey).First(&cfg).Error
	switch {
	case errors.Is(err, gorm.ErrRecordNotFound):
		cfg = systemModels.SystemConfig{
			Key:         AIModelMonitoringConfigKey,
			Value:       payload,
			Description: &description,
			Category:    &category,
			IsPublic:    false,
		}
		if err := s.db.Create(&cfg).Error; err != nil {
			return nil, err
		}
	case err != nil:
		return nil, err
	default:
		cfg.Value = payload
		cfg.Description = &description
		cfg.Category = &category
		if err := s.db.Save(&cfg).Error; err != nil {
			return nil, err
		}
	}

	s.touchLastRun()

	return &MonitoringSettings{
		AutoEnabled:          enabled,
		ProbeIntervalMinutes: int(s.probeInterval / time.Minute),
	}, nil
}

func (s *AIModelMonitoringService) RunFullProbe(mode string) (*MonitoringSnapshot, error) {
	if !atomic.CompareAndSwapInt32(&s.running, 0, 1) {
		return nil, ErrMonitoringAlreadyRunning
	}
	defer atomic.StoreInt32(&s.running, 0)
	defer s.touchLastRun()

	models, err := s.managedModelRepo.FindAll()
	if err != nil {
		return nil, err
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, maxProbeConcurrency)
	for _, model := range models {
		model := model
		wg.Add(1)
		go func() {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			if _, err := s.runProbeForModel(&model, mode); err != nil {
				log.Printf("[AI Monitoring] probe failed for %s/%s: %v", model.Provider, model.ModelName, err)
			}
		}()
	}
	wg.Wait()

	return s.GetSnapshot()
}

func (s *AIModelMonitoringService) RunModelProbe(id uint, mode string) (*MonitoringModelItem, error) {
	if !atomic.CompareAndSwapInt32(&s.running, 0, 1) {
		return nil, ErrMonitoringAlreadyRunning
	}
	defer atomic.StoreInt32(&s.running, 0)
	defer s.touchLastRun()

	model, err := s.managedModelRepo.FindByID(id)
	if err != nil {
		return nil, err
	}
	return s.runProbeForModel(model, mode)
}

func (s *AIModelMonitoringService) IsRunning() bool {
	return atomic.LoadInt32(&s.running) == 1
}

func (s *AIModelMonitoringService) shouldRun() bool {
	s.lastRunMu.Lock()
	defer s.lastRunMu.Unlock()
	return s.lastRunAt.IsZero() || time.Since(s.lastRunAt) >= s.probeInterval
}

func (s *AIModelMonitoringService) touchLastRun() {
	s.lastRunMu.Lock()
	s.lastRunAt = time.Now()
	s.lastRunMu.Unlock()
}

func (s *AIModelMonitoringService) runProbeForModel(model *aiModels.ManagedAIModel, mode string) (*MonitoringModelItem, error) {
	probeTime := time.Now()
	result, existing, err := s.loadProbeResult(model.ID)
	if err != nil {
		return nil, err
	}

	status := "failed"
	latencyMs := 0
	var lastError *string
	var preview *string
	capability, capabilityErr := s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
	if capabilityErr != nil && !errors.Is(capabilityErr, gorm.ErrRecordNotFound) {
		return nil, capabilityErr
	}

	if shouldSkipChatProbe(model.ModelName, capability) {
		status = "unsupported"
		msg := "probe skipped: current model is not compatible with chat/completions probing"
		lastError = &msg
	} else {
		probeConfig, provider, err := s.resolveProbeConfig(model.Provider, model.ModelName)
		if err != nil {
			status = "not_configured"
			msg := err.Error()
			lastError = &msg
		} else {
			startedAt := time.Now()
			resp, probeErr := s.executeProbe(provider, probeConfig)
			latencyMs = int(time.Since(startedAt).Milliseconds())
			if probeErr != nil {
				msg := truncateForStorage(probeErr.Error(), 500)
				lastError = &msg
			} else {
				content := strings.TrimSpace(resp.Content)
				if content == "" {
					msg := "empty response"
					lastError = &msg
				} else {
					status = "healthy"
					previewText := truncateForStorage(content, 255)
					preview = &previewText
				}
			}
		}
	}

	result.ManagedModelID = model.ID
	result.Provider = model.Provider
	result.ModelName = model.ModelName
	result.ProbeStatus = status
	result.LastCheckedAt = &probeTime
	modeValue := mode
	result.LastProbeMode = &modeValue
	if latencyMs > 0 {
		result.LastLatencyMs = &latencyMs
	} else {
		result.LastLatencyMs = nil
	}
	result.LastError = lastError
	result.LastResponsePreview = preview

	if status == "healthy" {
		result.LastSuccessAt = &probeTime
		result.ConsecutiveFailures = 0
	} else if status == "unsupported" {
		result.LastSuccessAt = existingSuccessTime(existing)
		result.ConsecutiveFailures = 0
	} else if existing != nil {
		result.LastSuccessAt = existing.LastSuccessAt
		result.ConsecutiveFailures = existing.ConsecutiveFailures + 1
	} else {
		result.ConsecutiveFailures = 1
	}

	if err := s.saveProbeResult(result); err != nil {
		return nil, err
	}

	return &MonitoringModelItem{
		ManagedModelID:      model.ID,
		Provider:            model.Provider,
		ModelName:           model.ModelName,
		DisplayName:         model.DisplayName,
		Status:              model.Status,
		IsActive:            model.IsActive,
		ProbeStatus:         status,
		LastCheckedAt:       result.LastCheckedAt,
		LastSuccessAt:       result.LastSuccessAt,
		LastLatencyMs:       result.LastLatencyMs,
		LastError:           result.LastError,
		LastResponsePreview: result.LastResponsePreview,
		LastProbeMode:       result.LastProbeMode,
		ConsecutiveFailures: result.ConsecutiveFailures,
	}, nil
}

func (s *AIModelMonitoringService) executeProbe(provider providers.AIProvider, probeConfig *providers.AIModelConfig) (*providers.ChatResponse, error) {
	resp, err := provider.Chat(probeConfig, buildProbePrompt(probeConfig.Provider), "", map[string]interface{}{})
	if !shouldRetryProbe(probeConfig, resp, err) {
		return resp, err
	}

	retryConfig := *probeConfig
	retryMaxTokens := resolveRetryMaxTokens(probeConfig.Provider, probeConfig.MaxTokens)
	retryConfig.MaxTokens = &retryMaxTokens
	return provider.Chat(&retryConfig, buildProbePrompt(probeConfig.Provider), "", map[string]interface{}{})
}

func existingSuccessTime(existing *aiModels.AIModelProbeResult) *time.Time {
	if existing == nil {
		return nil
	}
	return existing.LastSuccessAt
}

func shouldSkipChatProbe(modelName string, capability *aiModels.ModelCapabilityConfig) bool {
	name := strings.ToLower(strings.TrimSpace(modelName))
	if capability != nil && capability.SupportImageGeneration && !supportsChatProbe(capability) {
		return true
	}

	imageOnlyHints := []string{
		"seedream",
		"flux",
		"stable-diffusion",
		"midjourney",
		"imagen",
		"image",
		"text-to-image",
	}
	for _, hint := range imageOnlyHints {
		if strings.Contains(name, hint) {
			return true
		}
	}
	return false
}

func supportsChatProbe(capability *aiModels.ModelCapabilityConfig) bool {
	if capability == nil {
		return true
	}
	return capability.SupportTemperature ||
		capability.SupportMaxTokens ||
		capability.SupportTopP ||
		capability.SupportStream ||
		capability.SupportThinking ||
		capability.SupportThinkingLevel ||
		capability.SupportEnableThinking
}

func buildProbePrompt(providerName string) string {
	switch normalizeProvider(providerName) {
	case "claude", "gemini", "gpt", "grok":
		return "Return exactly the single character 1."
	default:
		return "Reply with 1 only."
	}
}

func shouldRetryProbe(config *providers.AIModelConfig, resp *providers.ChatResponse, err error) bool {
	if err != nil {
		lowerError := strings.ToLower(err.Error())
		return strings.Contains(lowerError, "max_output_tokens") ||
			strings.Contains(lowerError, "expected a value >= 16") ||
			strings.Contains(lowerError, "integer below minimum value")
	}

	return resp != nil &&
		strings.TrimSpace(resp.Content) == "" &&
		isOpenRouterProbeProvider(config.Provider)
}

func resolveRetryMaxTokens(providerName string, current *int) int {
	minValue := 16
	if !isOpenRouterProbeProvider(providerName) {
		minValue = 8
	}
	if current != nil && *current >= minValue {
		return *current * 2
	}
	if isOpenRouterProbeProvider(providerName) {
		return 32
	}
	return minValue
}

func isOpenRouterProbeProvider(providerName string) bool {
	switch normalizeProvider(providerName) {
	case "claude", "gemini", "gpt", "grok":
		return true
	default:
		return false
	}
}

func resolveProbeMaxTokens(providerName string) int {
	if isOpenRouterProbeProvider(providerName) {
		return 16
	}
	return 8
}

func resolveProbeTemperature(providerName string) float64 {
	if isOpenRouterProbeProvider(providerName) {
		return 0
	}
	return 0
}

func (s *AIModelMonitoringService) resolveProbeConfig(providerName, modelName string) (*providers.AIModelConfig, providers.AIProvider, error) {
	normalizedProvider := normalizeProvider(providerName)
	apiKey, baseURL := resolveSystemProviderCredentials(normalizedProvider)
	if apiKey == "" {
		return nil, nil, fmt.Errorf("system API key is not configured for provider %s", normalizedProvider)
	}

	provider, err := s.providerFactory.GetProvider(normalizedProvider)
	if err != nil {
		return nil, nil, err
	}

	temperature := resolveProbeTemperature(normalizedProvider)
	maxTokens := resolveProbeMaxTokens(normalizedProvider)

	return &providers.AIModelConfig{
		Provider:    normalizedProvider,
		ModelName:   modelName,
		APIKey:      apiKey,
		BaseURL:     baseURL,
		Temperature: &temperature,
		MaxTokens:   &maxTokens,
	}, provider, nil
}

func (s *AIModelMonitoringService) loadProbeResult(modelID uint) (*aiModels.AIModelProbeResult, *aiModels.AIModelProbeResult, error) {
	var row aiModels.AIModelProbeResult
	err := s.db.Where("managed_model_id = ?", modelID).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		newRow := &aiModels.AIModelProbeResult{}
		return newRow, nil, nil
	}
	if err != nil {
		return nil, nil, err
	}

	clone := row
	return &row, &clone, nil
}

func (s *AIModelMonitoringService) saveProbeResult(row *aiModels.AIModelProbeResult) error {
	if row.ID == 0 {
		return s.db.Create(row).Error
	}
	return s.db.Save(row).Error
}

func resolveSystemProviderCredentials(providerName string) (string, string) {
	switch providerName {
	case "deepseek":
		return config.DeepSeekAPIKey, "https://api.deepseek.com"
	case "doubao":
		return config.DoubaoAPIKey, "https://ark.cn-beijing.volces.com/api/v3"
	case "qwen":
		return config.QwenAPIKey, "https://dashscope.aliyuncs.com/compatible-mode/v1"
	case "zhipuai":
		return config.ZhipuaiAPIKey, "https://open.bigmodel.cn/api/paas/v4"
	case "spark":
		return config.SparkAPIKey, "https://spark-api-open.xf-yun.com/v2"
	case "hunyuan":
		return config.HunyuanAPIKey, "https://api.hunyuan.cloud.tencent.com/v1"
	case "claude", "gemini", "gpt", "grok":
		return config.GeminiAPIKey, "https://openrouter.ai/api/v1"
	case "openai":
		return "", "https://api.openai.com/v1"
	default:
		return "", ""
	}
}

func normalizeProbeStatus(value string) string {
	switch value {
	case "healthy", "failed", "not_configured", "unsupported":
		return value
	default:
		return "unknown"
	}
}

func truncateForStorage(value string, limit int) string {
	trimmed := strings.TrimSpace(value)
	if limit <= 0 || len(trimmed) <= limit {
		return trimmed
	}
	return trimmed[:limit]
}

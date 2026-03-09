package services

import (
	"errors"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	domainRepo "yaolight-workshop/backend/domain/repository"
	"yaolight-workshop/backend/infrastructure/shared"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
)

var (
	ErrManagedModelNotFound      = errors.New("managed ai model not found")
	ErrManagedModelAlreadyExists = errors.New("managed ai model already exists")
	ErrProviderTemplateNotFound  = errors.New("provider template not found")
	ErrInvalidManagedModel       = errors.New("invalid managed ai model payload")
)

type AdminAIService struct {
	db               *gorm.DB
	managedModelRepo aiRepos.ManagedAIModelRepository
	providerTplRepo  domainRepo.ProviderTemplateRepository
	capabilityRepo   aiRepos.CapabilityConfigRepository
	pricingRepo      aiRepos.PricingConfigRepository
	pricingRuleRepo  aiRepos.PricingRuleRepository
}

type AdminProviderSummary struct {
	Provider          string   `json:"provider"`
	Name              string   `json:"name"`
	Description       string   `json:"description"`
	IsActive          bool     `json:"is_active"`
	ModelsCount       int      `json:"models_count"`
	ActiveModelsCount int      `json:"active_models_count"`
	DefaultCurrency   string   `json:"default_currency"`
	Capabilities      []string `json:"capabilities"`
}

type AdminProviderDetail struct {
	AdminProviderSummary
	Models []AdminModelResponse `json:"models"`
}

type AdminUsageSummary struct {
	Requests         int64      `json:"requests"`
	PromptTokens     int64      `json:"prompt_tokens"`
	CompletionTokens int64      `json:"completion_tokens"`
	TotalTokens      int64      `json:"total_tokens"`
	TotalCost        float64    `json:"total_cost"`
	LastUsedAt       *time.Time `json:"last_used_at"`
}

type AdminModelResponse struct {
	ID             uint                            `json:"id"`
	Provider       string                          `json:"provider"`
	ModelName      string                          `json:"model_name"`
	DisplayName    string                          `json:"display_name"`
	Description    *string                         `json:"description,omitempty"`
	Status         string                          `json:"status"`
	IsActive       bool                            `json:"is_active"`
	SortOrder      int                             `json:"sort_order"`
	Capability     *aiModels.ModelCapabilityConfig `json:"capability,omitempty"`
	CurrentPricing *aiModels.ModelPricingRule      `json:"current_pricing,omitempty"`
	UsageSummary   AdminUsageSummary               `json:"usage_summary"`
}

type CreateManagedAIModelRequest struct {
	Provider    string  `json:"provider"`
	ModelName   string  `json:"model_name"`
	DisplayName string  `json:"display_name"`
	Description *string `json:"description"`
	IsActive    bool    `json:"is_active"`
}

type UpdateManagedAIModelRequest struct {
	DisplayName *string `json:"display_name"`
	Description *string `json:"description"`
	Status      *string `json:"status"`
	IsActive    *bool   `json:"is_active"`
	SortOrder   *int    `json:"sort_order"`
}

type UpsertPricingRuleRequest struct {
	PricingType string                 `json:"pricing_type"`
	Currency    string                 `json:"currency"`
	IsActive    bool                   `json:"is_active"`
	EffectiveAt time.Time              `json:"effective_at"`
	ExpiredAt   *time.Time             `json:"expired_at"`
	Description *string                `json:"description"`
	PricingData map[string]interface{} `json:"pricing_data"`
}

type AdminUsageRecord struct {
	ManagedModelID   *uint      `json:"managed_model_id,omitempty"`
	Provider         string     `json:"provider"`
	ModelName        string     `json:"model_name"`
	DisplayName      string     `json:"display_name"`
	Requests         int64      `json:"requests"`
	PromptTokens     int64      `json:"prompt_tokens"`
	CompletionTokens int64      `json:"completion_tokens"`
	TotalTokens      int64      `json:"total_tokens"`
	TotalCost        float64    `json:"total_cost"`
	LastUsedAt       *time.Time `json:"last_used_at"`
}

type usageAggregateRow struct {
	ManagedModelID   *uint      `gorm:"column:managed_model_id"`
	Provider         string     `gorm:"column:provider"`
	ModelName        string     `gorm:"column:model_name"`
	DisplayName      string     `gorm:"column:display_name"`
	Requests         int64      `gorm:"column:requests"`
	PromptTokens     int64      `gorm:"column:prompt_tokens"`
	CompletionTokens int64      `gorm:"column:completion_tokens"`
	TotalTokens      int64      `gorm:"column:total_tokens"`
	TotalCost        float64    `gorm:"column:total_cost"`
	LastUsedAt       *time.Time `gorm:"column:last_used_at"`
}

func NewAdminAIService(
	db *gorm.DB,
	managedModelRepo aiRepos.ManagedAIModelRepository,
	providerTplRepo domainRepo.ProviderTemplateRepository,
	capabilityRepo aiRepos.CapabilityConfigRepository,
	pricingRepo aiRepos.PricingConfigRepository,
	pricingRuleRepo aiRepos.PricingRuleRepository,
) *AdminAIService {
	return &AdminAIService{
		db:               db,
		managedModelRepo: managedModelRepo,
		providerTplRepo:  providerTplRepo,
		capabilityRepo:   capabilityRepo,
		pricingRepo:      pricingRepo,
		pricingRuleRepo:  pricingRuleRepo,
	}
}

func (s *AdminAIService) ListProviders() ([]AdminProviderSummary, error) {
	templates, err := s.providerTplRepo.FindAll()
	if err != nil {
		return nil, err
	}

	allModels, err := s.managedModelRepo.FindAll()
	if err != nil {
		return nil, err
	}

	allPricing, err := s.pricingRepo.FindAll()
	if err != nil {
		return nil, err
	}

	modelsByProvider := make(map[string][]aiModels.ManagedAIModel)
	for _, model := range allModels {
		modelsByProvider[model.Provider] = append(modelsByProvider[model.Provider], model)
	}

	currencyByProvider := make(map[string]string)
	for _, pricing := range allPricing {
		if currencyByProvider[pricing.Provider] == "" {
			currencyByProvider[pricing.Provider] = pricing.Currency
		}
	}

	summaries := make([]AdminProviderSummary, 0, len(templates))
	for _, tpl := range templates {
		models := modelsByProvider[tpl.Provider]
		activeCount := 0
		capabilitySet := make(map[string]struct{})
		for _, model := range models {
			if model.IsActive {
				activeCount++
			}
			capability, capErr := s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
			if capErr != nil && !errors.Is(capErr, gorm.ErrRecordNotFound) {
				return nil, capErr
			}
			for _, label := range capabilityLabels(capability) {
				capabilitySet[label] = struct{}{}
			}
		}

		summaries = append(summaries, AdminProviderSummary{
			Provider:          tpl.Provider,
			Name:              tpl.Name,
			Description:       valueOrEmpty(tpl.Description),
			IsActive:          tpl.IsActive,
			ModelsCount:       len(models),
			ActiveModelsCount: activeCount,
			DefaultCurrency:   currencyByProvider[tpl.Provider],
			Capabilities:      sortedSet(capabilitySet),
		})
	}

	return summaries, nil
}

func (s *AdminAIService) GetProvider(provider string) (*AdminProviderDetail, error) {
	tpl, err := s.providerTplRepo.FindByProvider(provider)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProviderTemplateNotFound
		}
		return nil, err
	}

	models, err := s.managedModelRepo.FindByProvider(provider)
	if err != nil {
		return nil, err
	}

	modelResponses, err := s.enrichModels(models)
	if err != nil {
		return nil, err
	}

	activeCount := 0
	capabilitySet := make(map[string]struct{})
	defaultCurrency := ""
	for _, model := range models {
		if model.IsActive {
			activeCount++
		}
		capability, capErr := s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
		if capErr != nil && !errors.Is(capErr, gorm.ErrRecordNotFound) {
			return nil, capErr
		}
		for _, label := range capabilityLabels(capability) {
			capabilitySet[label] = struct{}{}
		}
		if defaultCurrency == "" {
			pricing, pricingErr := s.pricingRepo.FindByProviderAndModel(model.Provider, model.ModelName)
			if pricingErr == nil {
				defaultCurrency = pricing.Currency
			}
		}
	}

	return &AdminProviderDetail{
		AdminProviderSummary: AdminProviderSummary{
			Provider:          tpl.Provider,
			Name:              tpl.Name,
			Description:       valueOrEmpty(tpl.Description),
			IsActive:          tpl.IsActive,
			ModelsCount:       len(models),
			ActiveModelsCount: activeCount,
			DefaultCurrency:   defaultCurrency,
			Capabilities:      sortedSet(capabilitySet),
		},
		Models: modelResponses,
	}, nil
}

func (s *AdminAIService) ListModels() ([]AdminModelResponse, error) {
	models, err := s.managedModelRepo.FindAll()
	if err != nil {
		return nil, err
	}
	return s.enrichModels(models)
}

func (s *AdminAIService) CreateModel(req *CreateManagedAIModelRequest) (*AdminModelResponse, error) {
	if err := validateCreateManagedModelRequest(req); err != nil {
		return nil, err
	}

	if _, err := s.providerTplRepo.FindByProvider(req.Provider); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrProviderTemplateNotFound
		}
		return nil, err
	}

	if _, err := s.managedModelRepo.FindByProviderAndModel(req.Provider, req.ModelName); err == nil {
		return nil, ErrManagedModelAlreadyExists
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	displayName := strings.TrimSpace(req.DisplayName)
	if displayName == "" {
		displayName = req.ModelName
	}

	model := &aiModels.ManagedAIModel{
		Provider:    req.Provider,
		ModelName:   req.ModelName,
		DisplayName: displayName,
		Description: normalizeOptionalString(req.Description),
		Status:      "active",
		IsActive:    req.IsActive,
	}
	if err := s.managedModelRepo.Create(model); err != nil {
		return nil, err
	}

	capability := defaultAdminCapability(model)
	if err := s.capabilityRepo.CreateOrUpdate(capability); err != nil {
		return nil, err
	}

	return s.GetModel(model.ID)
}

func (s *AdminAIService) GetModel(id uint) (*AdminModelResponse, error) {
	model, err := s.managedModelRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrManagedModelNotFound
		}
		return nil, err
	}

	list, err := s.enrichModels([]aiModels.ManagedAIModel{*model})
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, ErrManagedModelNotFound
	}
	return &list[0], nil
}

func (s *AdminAIService) UpdateModel(id uint, req *UpdateManagedAIModelRequest) (*AdminModelResponse, error) {
	model, err := s.managedModelRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrManagedModelNotFound
		}
		return nil, err
	}

	if req.DisplayName != nil {
		trimmed := strings.TrimSpace(*req.DisplayName)
		if trimmed == "" {
			return nil, ErrInvalidManagedModel
		}
		model.DisplayName = trimmed
	}
	if req.Description != nil {
		model.Description = normalizeOptionalString(req.Description)
	}
	if req.Status != nil {
		status := strings.TrimSpace(*req.Status)
		if status != "active" && status != "testing" && status != "disabled" {
			return nil, ErrInvalidManagedModel
		}
		model.Status = status
	}
	if req.IsActive != nil {
		model.IsActive = *req.IsActive
	}
	if req.SortOrder != nil {
		model.SortOrder = *req.SortOrder
	}

	if err := s.managedModelRepo.Update(model); err != nil {
		return nil, err
	}

	capability, capErr := s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
	if capErr == nil {
		capability.DisplayName = model.DisplayName
		capability.IsActive = model.IsActive
		if err := s.capabilityRepo.CreateOrUpdate(capability); err != nil {
			return nil, err
		}
	} else if !errors.Is(capErr, gorm.ErrRecordNotFound) {
		return nil, capErr
	}

	return s.GetModel(id)
}

func (s *AdminAIService) GetModelCapability(id uint) (*aiModels.ModelCapabilityConfig, error) {
	model, err := s.managedModelRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrManagedModelNotFound
		}
		return nil, err
	}

	capability, err := s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		capability = defaultAdminCapability(model)
		if createErr := s.capabilityRepo.CreateOrUpdate(capability); createErr != nil {
			return nil, createErr
		}
		return capability, nil
	}
	if err != nil {
		return nil, err
	}
	return capability, nil
}

func (s *AdminAIService) UpdateModelCapability(id uint, payload *aiModels.ModelCapabilityConfig) (*aiModels.ModelCapabilityConfig, error) {
	model, err := s.managedModelRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrManagedModelNotFound
		}
		return nil, err
	}

	payload.Provider = model.Provider
	payload.ModelName = model.ModelName
	payload.DisplayName = model.DisplayName
	payload.IsActive = model.IsActive
	if payload.CapabilityOptions == nil {
		payload.CapabilityOptions = &shared.JSONB{Data: map[string]interface{}{}}
	}

	if err := s.capabilityRepo.CreateOrUpdate(payload); err != nil {
		return nil, err
	}
	return s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
}

func (s *AdminAIService) GetModelPricing(id uint) ([]aiModels.ModelPricingRule, error) {
	if _, err := s.managedModelRepo.FindByID(id); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrManagedModelNotFound
		}
		return nil, err
	}
	return s.pricingRuleRepo.FindByModelID(id)
}

func (s *AdminAIService) UpsertModelPricing(id uint, req *UpsertPricingRuleRequest) (*aiModels.ModelPricingRule, error) {
	model, err := s.managedModelRepo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrManagedModelNotFound
		}
		return nil, err
	}

	if strings.TrimSpace(req.PricingType) == "" || strings.TrimSpace(req.Currency) == "" {
		return nil, ErrInvalidManagedModel
	}

	nextVersion, err := s.pricingRuleRepo.FindLatestVersionByModelID(id)
	if err != nil {
		return nil, err
	}
	nextVersion++

	effectiveAt := req.EffectiveAt
	if effectiveAt.IsZero() {
		effectiveAt = time.Now()
	}

	rule := &aiModels.ModelPricingRule{
		ManagedModelID: id,
		Provider:       model.Provider,
		ModelName:      model.ModelName,
		PricingType:    req.PricingType,
		Currency:       req.Currency,
		IsActive:       req.IsActive,
		Version:        nextVersion,
		EffectiveAt:    effectiveAt,
		ExpiredAt:      req.ExpiredAt,
		Description:    normalizeOptionalString(req.Description),
		PricingData:    shared.JSONB{Data: req.PricingData},
	}

	err = s.db.Transaction(func(tx *gorm.DB) error {
		if req.IsActive {
			if err := tx.Model(&aiModels.ModelPricingRule{}).
				Where("managed_model_id = ? AND is_active = ?", id, true).
				Updates(map[string]interface{}{
					"is_active":  false,
					"expired_at": effectiveAt,
				}).Error; err != nil {
				return err
			}
		}

		if err := tx.Create(rule).Error; err != nil {
			return err
		}

		if !req.IsActive {
			return nil
		}

		var currentConfig aiModels.ModelPricingConfig
		findErr := tx.Where("provider = ? AND model_name = ?", model.Provider, model.ModelName).First(&currentConfig).Error
		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			currentConfig = aiModels.ModelPricingConfig{
				Provider:    model.Provider,
				ModelName:   model.ModelName,
				PricingType: rule.PricingType,
				Currency:    rule.Currency,
				IsActive:    true,
				Description: rule.Description,
				PricingData: rule.PricingData,
			}
			return tx.Create(&currentConfig).Error
		}
		if findErr != nil {
			return findErr
		}

		return tx.Model(&currentConfig).Updates(map[string]interface{}{
			"pricing_type": rule.PricingType,
			"currency":     rule.Currency,
			"is_active":    true,
			"description":  rule.Description,
			"pricing_data": rule.PricingData,
		}).Error
	})
	if err != nil {
		return nil, err
	}

	return rule, nil
}

func (s *AdminAIService) ListPricingRules() ([]aiModels.ModelPricingRule, error) {
	return s.pricingRuleRepo.FindAll()
}

func (s *AdminAIService) GetUsage(modelID *uint) ([]AdminUsageRecord, error) {
	query := `
SELECT
	m.id AS managed_model_id,
	t.provider AS provider,
	t.model_name AS model_name,
	COALESCE(m.display_name, t.model_name) AS display_name,
	COUNT(*) AS requests,
	COALESCE(SUM(t.prompt_tokens), 0) AS prompt_tokens,
	COALESCE(SUM(t.completion_tokens), 0) AS completion_tokens,
	COALESCE(SUM(t.total_tokens), 0) AS total_tokens,
	COALESCE(SUM(t.cost), 0) AS total_cost,
	MAX(t.created_at) AS last_used_at
FROM token_transactions t
LEFT JOIN managed_ai_models m
	ON m.provider = t.provider
	AND m.model_name = t.model_name
	AND m.deleted_at IS NULL
WHERE t.provider <> '' AND t.model_name <> ''
`
	args := make([]interface{}, 0)
	if modelID != nil {
		model, err := s.managedModelRepo.FindByID(*modelID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrManagedModelNotFound
			}
			return nil, err
		}
		query += ` AND t.provider = ? AND t.model_name = ?`
		args = append(args, model.Provider, model.ModelName)
	}
	query += `
GROUP BY m.id, m.display_name, t.provider, t.model_name
ORDER BY requests DESC, total_cost DESC, provider ASC, model_name ASC
`

	var rows []usageAggregateRow
	if err := s.db.Raw(query, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}

	result := make([]AdminUsageRecord, 0, len(rows))
	for _, row := range rows {
		result = append(result, AdminUsageRecord{
			ManagedModelID:   row.ManagedModelID,
			Provider:         row.Provider,
			ModelName:        row.ModelName,
			DisplayName:      row.DisplayName,
			Requests:         row.Requests,
			PromptTokens:     row.PromptTokens,
			CompletionTokens: row.CompletionTokens,
			TotalTokens:      row.TotalTokens,
			TotalCost:        row.TotalCost,
			LastUsedAt:       row.LastUsedAt,
		})
	}

	return result, nil
}

func (s *AdminAIService) enrichModels(models []aiModels.ManagedAIModel) ([]AdminModelResponse, error) {
	usageMap, err := s.buildUsageSummaryMap()
	if err != nil {
		return nil, err
	}

	response := make([]AdminModelResponse, 0, len(models))
	for _, model := range models {
		capability, capErr := s.capabilityRepo.FindByProviderAndModel(model.Provider, model.ModelName)
		if capErr != nil && !errors.Is(capErr, gorm.ErrRecordNotFound) {
			return nil, capErr
		}
		rule, ruleErr := s.pricingRuleRepo.FindActiveByModelID(model.ID)
		if ruleErr != nil && !errors.Is(ruleErr, gorm.ErrRecordNotFound) {
			return nil, ruleErr
		}
		key := model.Provider + "|" + model.ModelName
		response = append(response, AdminModelResponse{
			ID:             model.ID,
			Provider:       model.Provider,
			ModelName:      model.ModelName,
			DisplayName:    model.DisplayName,
			Description:    model.Description,
			Status:         model.Status,
			IsActive:       model.IsActive,
			SortOrder:      model.SortOrder,
			Capability:     capability,
			CurrentPricing: rule,
			UsageSummary:   usageMap[key],
		})
	}
	return response, nil
}

func (s *AdminAIService) buildUsageSummaryMap() (map[string]AdminUsageSummary, error) {
	rows, err := s.GetUsage(nil)
	if err != nil {
		return nil, err
	}

	result := make(map[string]AdminUsageSummary, len(rows))
	for _, row := range rows {
		key := row.Provider + "|" + row.ModelName
		result[key] = AdminUsageSummary{
			Requests:         row.Requests,
			PromptTokens:     row.PromptTokens,
			CompletionTokens: row.CompletionTokens,
			TotalTokens:      row.TotalTokens,
			TotalCost:        row.TotalCost,
			LastUsedAt:       row.LastUsedAt,
		}
	}
	return result, nil
}

func validateCreateManagedModelRequest(req *CreateManagedAIModelRequest) error {
	if req == nil {
		return ErrInvalidManagedModel
	}
	if strings.TrimSpace(req.Provider) == "" || strings.TrimSpace(req.ModelName) == "" {
		return ErrInvalidManagedModel
	}
	req.Provider = strings.TrimSpace(req.Provider)
	req.ModelName = strings.TrimSpace(req.ModelName)
	req.DisplayName = strings.TrimSpace(req.DisplayName)
	return nil
}

func capabilityLabels(capability *aiModels.ModelCapabilityConfig) []string {
	if capability == nil {
		return nil
	}
	labels := make(map[string]struct{})
	labels["Chat"] = struct{}{}
	if capability.SupportStream {
		labels["Stream"] = struct{}{}
	}
	if capability.SupportThinking || capability.SupportThinkingLevel || capability.SupportEnableThinking {
		labels["Reasoning"] = struct{}{}
	}
	if capability.SupportVision {
		labels["Vision"] = struct{}{}
	}
	if capability.SupportImageGeneration {
		labels["Image"] = struct{}{}
	}
	return sortedSet(labels)
}

func sortedSet(set map[string]struct{}) []string {
	items := make([]string, 0, len(set))
	for item := range set {
		items = append(items, item)
	}
	sort.Strings(items)
	return items
}

func defaultAdminCapability(model *aiModels.ManagedAIModel) *aiModels.ModelCapabilityConfig {
	return &aiModels.ModelCapabilityConfig{
		Provider:                model.Provider,
		ModelName:               model.ModelName,
		DisplayName:             model.DisplayName,
		SupportTemperature:      true,
		SupportMaxTokens:        true,
		SupportTopP:             true,
		SupportStream:           true,
		SupportThinking:         false,
		SupportThinkingLevel:    false,
		SupportEnableThinking:   false,
		SupportFrequencyPenalty: false,
		SupportPresencePenalty:  false,
		SupportStopSequences:    false,
		SupportVision:           false,
		SupportImageGeneration:  false,
		MaxTokensLimit:          32768,
		IsActive:                model.IsActive,
	}
}

func valueOrEmpty(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

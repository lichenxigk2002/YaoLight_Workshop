package services

import (
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
	"yaolight-workshop/backend/modules/crawler/models"
	"yaolight-workshop/backend/modules/crawler/repositories"
)

var (
	ErrCrawlerRuleNotFound = errors.New("crawler rule not found")
	ErrInvalidCrawlerRule  = errors.New("invalid crawler rule")
)

type CrawlerRulePayload struct {
	Name              string                 `json:"name"`
	Description       *string                `json:"description"`
	Tutorial          *string                `json:"tutorial"`
	Version           string                 `json:"version"`
	URLPattern        *string                `json:"url_pattern"`
	URLPatternType    string                 `json:"url_pattern_type"`
	Method            string                 `json:"method"`
	Headers           map[string]interface{} `json:"headers"`
	Params            map[string]interface{} `json:"params"`
	Body              interface{}            `json:"body"`
	Selectors         map[string]interface{} `json:"selectors"`
	DataExtraction    map[string]interface{} `json:"data_extraction"`
	Pagination        map[string]interface{} `json:"pagination"`
	ProxyConfig       map[string]interface{} `json:"proxy_config"`
	Cookies           map[string]interface{} `json:"cookies"`
	Timeout           *int                   `json:"timeout"`
	RetryCount        *int                   `json:"retry_count"`
	RetryDelay        *int                   `json:"retry_delay"`
	UserAgent         *string                `json:"user_agent"`
	FollowRedirects   *bool                  `json:"follow_redirects"`
	VerifySSL         *bool                  `json:"verify_ssl"`
	WaitTime          *int                   `json:"wait_time"`
	JavaScriptEnabled *bool                  `json:"javascript_enabled"`
	Screenshot        *bool                  `json:"screenshot"`
	IsActive          *bool                  `json:"is_active"`
}

type CrawlerRuleListItem struct {
	ID             uint     `json:"id"`
	Name           string   `json:"name"`
	Description    *string  `json:"description"`
	Version        string   `json:"version"`
	URLPattern     *string  `json:"url_pattern"`
	URLPatternType string   `json:"url_pattern_type"`
	IsActive       bool     `json:"is_active"`
	UsageCount     int      `json:"usage_count"`
	SuccessRate    *float64 `json:"success_rate"`
	UpdatedAt      string   `json:"updated_at"`
	CreatedBy      *uint    `json:"created_by"`
}

type CrawlerRuleListResult struct {
	List     []CrawlerRuleListItem `json:"list"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

type SetCrawlerRuleStatusRequest struct {
	IsActive bool `json:"is_active"`
}

type AdminCrawlerRuleService struct {
	repo *repositories.CrawlerRuleRepository
}

func NewAdminCrawlerRuleService(repo *repositories.CrawlerRuleRepository) *AdminCrawlerRuleService {
	return &AdminCrawlerRuleService{repo: repo}
}

func (s *AdminCrawlerRuleService) ListRules(query repositories.ListCrawlerRulesQuery) (*CrawlerRuleListResult, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}

	rules, total, err := s.repo.List(query)
	if err != nil {
		return nil, err
	}

	items := make([]CrawlerRuleListItem, 0, len(rules))
	for _, rule := range rules {
		items = append(items, CrawlerRuleListItem{
			ID:             rule.ID,
			Name:           rule.Name,
			Description:    rule.Description,
			Version:        rule.Version,
			URLPattern:     rule.URLPattern,
			URLPatternType: rule.URLPatternType,
			IsActive:       rule.IsActive,
			UsageCount:     rule.UsageCount,
			SuccessRate:    rule.SuccessRate,
			UpdatedAt:      rule.UpdatedAt.Format("2006-01-02 15:04:05"),
			CreatedBy:      rule.CreatedBy,
		})
	}

	return &CrawlerRuleListResult{
		List:     items,
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}, nil
}

func (s *AdminCrawlerRuleService) GetRule(id uint) (*models.CrawlerRule, error) {
	rule, err := s.repo.FindByID(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrCrawlerRuleNotFound
		}
		return nil, err
	}
	return rule, nil
}

func (s *AdminCrawlerRuleService) CreateRule(userID uint, payload *CrawlerRulePayload) (*models.CrawlerRule, error) {
	rule, err := s.buildRuleModel(payload, &userID, nil)
	if err != nil {
		return nil, err
	}
	if err := s.repo.Create(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *AdminCrawlerRuleService) UpdateRule(id uint, payload *CrawlerRulePayload) (*models.CrawlerRule, error) {
	existing, err := s.GetRule(id)
	if err != nil {
		return nil, err
	}

	rule, err := s.buildRuleModel(payload, existing.CreatedBy, existing)
	if err != nil {
		return nil, err
	}

	rule.ID = existing.ID
	rule.CreatedAt = existing.CreatedAt
	rule.CreatedBy = existing.CreatedBy
	rule.UsageCount = existing.UsageCount
	rule.SuccessRate = existing.SuccessRate

	if err := s.repo.Update(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func (s *AdminCrawlerRuleService) DeleteRule(id uint) error {
	if _, err := s.GetRule(id); err != nil {
		return err
	}
	return s.repo.Delete(id)
}

func (s *AdminCrawlerRuleService) SetRuleStatus(id uint, isActive bool) error {
	if _, err := s.GetRule(id); err != nil {
		return err
	}
	return s.repo.UpdateStatus(id, isActive)
}

func (s *AdminCrawlerRuleService) CloneRule(id uint, userID uint) (*models.CrawlerRule, error) {
	source, err := s.GetRule(id)
	if err != nil {
		return nil, err
	}

	clone := *source
	clone.ID = 0
	clone.Version = nextCrawlerRuleVersion(source.Version)
	clone.Name = source.Name + " Copy"
	clone.UsageCount = 0
	clone.SuccessRate = nil
	clone.CreatedBy = &userID

	if err := s.repo.Create(&clone); err != nil {
		return nil, err
	}
	return &clone, nil
}

func (s *AdminCrawlerRuleService) GetRuleUsages(id uint) ([]repositories.CrawlerRuleUsage, error) {
	if _, err := s.GetRule(id); err != nil {
		return nil, err
	}
	return s.repo.FindUsages(id)
}

func (s *AdminCrawlerRuleService) buildRuleModel(payload *CrawlerRulePayload, createdBy *uint, existing *models.CrawlerRule) (*models.CrawlerRule, error) {
	if payload == nil {
		return nil, fmt.Errorf("%w: payload is required", ErrInvalidCrawlerRule)
	}

	rule := &models.CrawlerRule{
		Name:              strings.TrimSpace(payload.Name),
		Description:       payload.Description,
		Tutorial:          trimOptionalString(payload.Tutorial),
		Version:           strings.TrimSpace(payload.Version),
		URLPattern:        trimOptionalString(payload.URLPattern),
		URLPatternType:    strings.ToLower(strings.TrimSpace(payload.URLPatternType)),
		Method:            strings.ToUpper(strings.TrimSpace(payload.Method)),
		Headers:           shared.JSONB{Data: mapOrEmpty(payload.Headers)},
		Params:            shared.JSONB{Data: mapOrEmpty(payload.Params)},
		Selectors:         shared.JSONB{Data: mapOrEmpty(payload.Selectors)},
		Timeout:           intOrDefault(payload.Timeout, 30),
		RetryCount:        intOrDefault(payload.RetryCount, 3),
		RetryDelay:        intOrDefault(payload.RetryDelay, 1),
		UserAgent:         trimOptionalString(payload.UserAgent),
		FollowRedirects:   boolOrDefault(payload.FollowRedirects, true),
		VerifySSL:         boolOrDefault(payload.VerifySSL, true),
		WaitTime:          intOrDefault(payload.WaitTime, 0),
		JavaScriptEnabled: boolOrDefault(payload.JavaScriptEnabled, false),
		Screenshot:        boolOrDefault(payload.Screenshot, false),
		IsActive:          boolOrDefault(payload.IsActive, true),
		CreatedBy:         createdBy,
	}

	if rule.Version == "" {
		if existing != nil && existing.Version != "" {
			rule.Version = existing.Version
		} else {
			rule.Version = "1.0.0"
		}
	}
	if rule.URLPatternType == "" {
		rule.URLPatternType = "regex"
	}
	if rule.Method == "" {
		rule.Method = "GET"
	}

	if payload.Body != nil {
		body := shared.JSONB{Data: payload.Body}
		rule.Body = &body
	}
	if payload.DataExtraction != nil {
		dataExtraction := shared.JSONB{Data: payload.DataExtraction}
		rule.DataExtraction = &dataExtraction
	}
	if payload.Pagination != nil {
		pagination := shared.JSONB{Data: payload.Pagination}
		rule.Pagination = &pagination
	}
	if payload.ProxyConfig != nil {
		proxyConfig := shared.JSONB{Data: payload.ProxyConfig}
		rule.ProxyConfig = &proxyConfig
	}
	if payload.Cookies != nil {
		cookies := shared.JSONB{Data: payload.Cookies}
		rule.Cookies = &cookies
	}

	if err := validateCrawlerRule(rule); err != nil {
		return nil, err
	}
	return rule, nil
}

func validateCrawlerRule(rule *models.CrawlerRule) error {
	if rule == nil {
		return fmt.Errorf("%w: rule is nil", ErrInvalidCrawlerRule)
	}
	if strings.TrimSpace(rule.Name) == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidCrawlerRule)
	}
	if rule.URLPattern == nil || strings.TrimSpace(*rule.URLPattern) == "" {
		return fmt.Errorf("%w: url_pattern is required", ErrInvalidCrawlerRule)
	}

	switch rule.URLPatternType {
	case "regex", "glob", "exact":
	default:
		return fmt.Errorf("%w: unsupported url_pattern_type", ErrInvalidCrawlerRule)
	}

	switch rule.Method {
	case "GET", "POST", "PUT", "DELETE", "PATCH":
	default:
		return fmt.Errorf("%w: unsupported method", ErrInvalidCrawlerRule)
	}

	if extraction, ok := jsonObject(jsonbPtrValue(rule.DataExtraction)); ok {
		if mode := getStringFromMap(extraction, "mode", "extractMode"); mode != "" {
			switch mode {
			case "smart", "article", "list", "links", "images", "custom":
			default:
				return fmt.Errorf("%w: unsupported data_extraction.mode", ErrInvalidCrawlerRule)
			}
		}
		if extractType := getStringFromMap(extraction, "extract_type", "extractType"); extractType != "" {
			switch extractType {
			case "text", "html", "link", "image", "attr", "all":
			default:
				return fmt.Errorf("%w: unsupported data_extraction.extract_type", ErrInvalidCrawlerRule)
			}
		}
	}

	return nil
}

func mapOrEmpty(value map[string]interface{}) map[string]interface{} {
	if value == nil {
		return map[string]interface{}{}
	}
	return value
}

func intOrDefault(value *int, defaultValue int) int {
	if value == nil {
		return defaultValue
	}
	return *value
}

func boolOrDefault(value *bool, defaultValue bool) bool {
	if value == nil {
		return defaultValue
	}
	return *value
}

func trimOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	return &trimmed
}

func nextCrawlerRuleVersion(version string) string {
	parts := strings.Split(strings.TrimSpace(version), ".")
	if len(parts) == 0 {
		return "1.0.1"
	}

	last := parts[len(parts)-1]
	var number int
	if _, err := fmt.Sscanf(last, "%d", &number); err != nil {
		return version + ".1"
	}

	parts[len(parts)-1] = fmt.Sprintf("%d", number+1)
	return strings.Join(parts, ".")
}

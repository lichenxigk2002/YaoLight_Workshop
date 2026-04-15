package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/crawler/models"
	"yaolight-workshop/backend/modules/crawler/repositories"
)

type TestCrawlerRuleRequest struct {
	RuleID   *uint                  `json:"rule_id"`
	TestURL  string                 `json:"test_url"`
	Override map[string]interface{} `json:"override"`
	Rule     *CrawlerRulePayload    `json:"-"`
}

type CrawlerRuleTestService struct {
	repo    *repositories.CrawlerRuleRepository
	crawler *CrawlerService
}

func NewCrawlerRuleTestService(repo *repositories.CrawlerRuleRepository, crawler *CrawlerService) *CrawlerRuleTestService {
	return &CrawlerRuleTestService{
		repo:    repo,
		crawler: crawler,
	}
}

func (s *CrawlerRuleTestService) ParseTestRequest(body []byte) (*TestCrawlerRuleRequest, error) {
	var req TestCrawlerRuleRequest
	if err := json.Unmarshal(body, &req); err != nil {
		return nil, err
	}

	var payload CrawlerRulePayload
	if err := json.Unmarshal(body, &payload); err == nil && strings.TrimSpace(payload.Name) != "" {
		req.Rule = &payload
	}

	return &req, nil
}

func (s *CrawlerRuleTestService) TestRule(req *TestCrawlerRuleRequest) (*CrawlerResult, error) {
	if req == nil {
		return nil, fmt.Errorf("request is required")
	}
	if strings.TrimSpace(req.TestURL) == "" {
		return nil, fmt.Errorf("test_url is required")
	}

	var rule *models.CrawlerRule
	switch {
	case req.RuleID != nil:
		storedRule, err := s.repo.FindByID(*req.RuleID)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil, ErrCrawlerRuleNotFound
			}
			return nil, err
		}
		rule = storedRule
	case req.Rule != nil:
		adminService := NewAdminCrawlerRuleService(s.repo)
		previewRule, err := adminService.buildRuleModel(req.Rule, nil, nil)
		if err != nil {
			return nil, err
		}
		rule = previewRule
	default:
		return nil, fmt.Errorf("rule_id or direct rule payload is required")
	}

	config, err := MapRuleToCrawlerConfig(rule)
	if err != nil {
		return nil, err
	}

	override := req.Override
	if override == nil {
		override = map[string]interface{}{}
	}
	override["url"] = strings.TrimSpace(req.TestURL)

	config, err = MergeCrawlerConfig(config, override)
	if err != nil {
		return nil, err
	}

	return s.crawler.Execute(config)
}

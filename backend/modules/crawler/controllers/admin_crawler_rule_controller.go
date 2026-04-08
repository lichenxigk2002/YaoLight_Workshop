package controllers

import (
	"errors"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	crawlerRepos "yaolight-workshop/backend/modules/crawler/repositories"
	crawlerServices "yaolight-workshop/backend/modules/crawler/services"
)

type AdminCrawlerRuleController struct {
	service     *crawlerServices.AdminCrawlerRuleService
	testService *crawlerServices.CrawlerRuleTestService
}

func NewAdminCrawlerRuleController() *AdminCrawlerRuleController {
	repo := crawlerRepos.NewCrawlerRuleRepository(database.DB)
	return &AdminCrawlerRuleController{
		service:     crawlerServices.NewAdminCrawlerRuleService(repo),
		testService: crawlerServices.NewCrawlerRuleTestService(repo, crawlerServices.NewCrawlerService()),
	}
}

func (c *AdminCrawlerRuleController) ListRules(ctx *gin.Context) {
	var isActive *bool
	if raw := ctx.Query("is_active"); raw != "" {
		parsed, err := strconv.ParseBool(raw)
		if err != nil {
			badRequest(ctx, "invalid is_active")
			return
		}
		isActive = &parsed
	}

	var createdBy *uint
	if raw := ctx.Query("created_by"); raw != "" {
		parsed, err := strconv.ParseUint(raw, 10, 32)
		if err != nil {
			badRequest(ctx, "invalid created_by")
			return
		}
		value := uint(parsed)
		createdBy = &value
	}

	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("page_size", "20"))

	result, err := c.service.ListRules(crawlerRepos.ListCrawlerRulesQuery{
		Keyword:   ctx.Query("keyword"),
		IsActive:  isActive,
		CreatedBy: createdBy,
		Page:      page,
		PageSize:  pageSize,
		SortBy:    ctx.DefaultQuery("sort_by", "updated_at"),
		SortOrder: ctx.DefaultQuery("sort_order", "DESC"),
	})
	if err != nil {
		internalError(ctx, "failed to list crawler rules", err)
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminCrawlerRuleController) GetRule(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	rule, err := c.service.GetRule(id)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to load crawler rule")
		return
	}

	ok(ctx, "ok", rule)
}

func (c *AdminCrawlerRuleController) CreateRule(ctx *gin.Context) {
	var req crawlerServices.CrawlerRulePayload
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	userID, err := currentUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": err.Error(), "data": nil})
		return
	}

	rule, err := c.service.CreateRule(userID, &req)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to create crawler rule")
		return
	}

	ok(ctx, "created", rule)
}

func (c *AdminCrawlerRuleController) UpdateRule(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var req crawlerServices.CrawlerRulePayload
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	rule, err := c.service.UpdateRule(id, &req)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to update crawler rule")
		return
	}

	ok(ctx, "updated", rule)
}

func (c *AdminCrawlerRuleController) DeleteRule(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	if err := c.service.DeleteRule(id); err != nil {
		c.handleServiceError(ctx, err, "failed to delete crawler rule")
		return
	}

	ok(ctx, "deleted", gin.H{"id": id})
}

func (c *AdminCrawlerRuleController) SetRuleStatus(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	var req crawlerServices.SetCrawlerRuleStatusRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	if err := c.service.SetRuleStatus(id, req.IsActive); err != nil {
		c.handleServiceError(ctx, err, "failed to update crawler rule status")
		return
	}

	ok(ctx, "updated", gin.H{"id": id, "is_active": req.IsActive})
}

func (c *AdminCrawlerRuleController) TestRule(ctx *gin.Context) {
	body, err := io.ReadAll(ctx.Request.Body)
	if err != nil {
		badRequest(ctx, "failed to read request body")
		return
	}

	req, err := c.testService.ParseTestRequest(body)
	if err != nil {
		badRequest(ctx, "invalid request payload: "+err.Error())
		return
	}

	result, err := c.testService.TestRule(req)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to test crawler rule")
		return
	}

	ok(ctx, "ok", result)
}

func (c *AdminCrawlerRuleController) GetRuleUsages(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	usages, err := c.service.GetRuleUsages(id)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to load crawler rule usages")
		return
	}

	ok(ctx, "ok", gin.H{
		"list":  usages,
		"total": len(usages),
	})
}

func (c *AdminCrawlerRuleController) CloneRule(ctx *gin.Context) {
	id, okID := parseUintParam(ctx, "id")
	if !okID {
		return
	}

	userID, err := currentUserID(ctx)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": err.Error(), "data": nil})
		return
	}

	rule, err := c.service.CloneRule(id, userID)
	if err != nil {
		c.handleServiceError(ctx, err, "failed to clone crawler rule")
		return
	}

	ok(ctx, "created", rule)
}

func (c *AdminCrawlerRuleController) handleServiceError(ctx *gin.Context, err error, message string) {
	switch {
	case errors.Is(err, crawlerServices.ErrCrawlerRuleNotFound):
		notFound(ctx, "crawler rule not found")
	case errors.Is(err, crawlerServices.ErrInvalidCrawlerRule):
		badRequest(ctx, err.Error())
	default:
		internalError(ctx, message, err)
	}
}

func currentUserID(ctx *gin.Context) (uint, error) {
	value, exists := ctx.Get("userID")
	if !exists {
		return 0, errors.New("missing user context")
	}

	switch v := value.(type) {
	case uint:
		return v, nil
	case int:
		return uint(v), nil
	case float64:
		return uint(v), nil
	default:
		return 0, errors.New("invalid user context")
	}
}

package tools

import (
	"fmt"
	"strings"

	"yaolight-workshop/backend/infrastructure/database"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	projectModels "yaolight-workshop/backend/modules/project/models"
	projectSupport "yaolight-workshop/backend/modules/project/support"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

// toolListProjectWebsiteSources 占位（无 Runner 时使用）
func toolListProjectWebsiteSources(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{
		"projectId":       0,
		"sources":         []interface{}{},
		"total":           0,
		"projectResolved": false,
	}, "网站源列表占位", nil
}

// runListProjectWebsiteSources 返回当前项目下可供 crawler 生成使用的网站源摘要。
func (r *Registry) runListProjectWebsiteSources(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	if r.runner == nil || r.runner.Repo == nil {
		return toolListProjectWebsiteSources(params, sessionID)
	}

	session, err := r.runner.Repo.GetSessionByID(sessionID)
	if err != nil {
		return map[string]interface{}{
			"projectId":       0,
			"sources":         []interface{}{},
			"total":           0,
			"projectResolved": false,
			"note":            "获取会话失败，无法读取项目网站源",
		}, "获取会话失败", nil
	}

	projectID := uint(intParam(params, "projectId"))
	projectResolvedFrom := "params"
	if projectID == 0 {
		projectID = r.resolveProjectIDFromSession(session)
		if projectID > 0 {
			projectResolvedFrom = "session_workflow"
		}
	}

	if projectID == 0 {
		return map[string]interface{}{
			"projectId":       0,
			"sources":         []interface{}{},
			"total":           0,
			"projectResolved": false,
			"note":            "当前会话未绑定可识别的项目。若用户明确指定了项目，请在工具参数中传 projectId。",
		}, "当前会话未绑定项目，无法读取网站源", nil
	}

	listResult, err := listProjectWebsiteSources(session.UserID, projectID, projectWebsiteSourceListQuery{
		Keyword:  strings.TrimSpace(stringParam(params, "keyword")),
		Status:   strings.TrimSpace(stringParam(params, "status")),
		Page:     intParam(params, "page"),
		PageSize: intParam(params, "pageSize"),
	})
	if err != nil {
		return nil, "", fmt.Errorf("读取项目网站源失败: %w", err)
	}

	sources := make([]map[string]interface{}, 0, len(listResult.List))
	for _, item := range listResult.List {
		sources = append(sources, map[string]interface{}{
			"id":                item.ID,
			"name":              item.Name,
			"baseUrl":           item.BaseURL,
			"entryUrl":          item.EntryURL,
			"status":            item.Status,
			"tags":              item.Tags,
			"listUrlExamples":   item.ListURLExamples,
			"detailUrlExamples": item.DetailURLExamples,
			"lastCheckedAt":     item.LastCheckedAt,
			"lastCheckStatus":   item.LastCheckStatus,
			"lastCheckMessage":  item.LastCheckMessage,
		})
	}

	return map[string]interface{}{
		"projectId":           projectID,
		"projectResolved":     true,
		"projectResolvedFrom": projectResolvedFrom,
		"page":                listResult.Page,
		"pageSize":            listResult.PageSize,
		"total":               listResult.Total,
		"sources":             sources,
		"usageHint":           "生成 crawler 工作流时，优先参考 entryUrl、listUrlExamples、detailUrlExamples，并结合网站源详情中的 crawlTips/authHint/contentHint。",
	}, fmt.Sprintf("找到 %d 个项目网站源", listResult.Total), nil
}

func (r *Registry) resolveProjectIDFromSession(session *alkaidModels.AlkaidSession) uint {
	if session == nil || session.WorkflowID == nil || *session.WorkflowID == 0 || r.runner == nil || r.runner.WorkflowService == nil {
		return 0
	}

	workflowResp, err := r.runner.WorkflowService.GetWorkflowByID(*session.WorkflowID)
	if err != nil || workflowResp == nil {
		return 0
	}

	switch workflow := workflowResp.(type) {
	case *workflowModels.Workflow:
		if workflow.ProjectID != nil {
			return *workflow.ProjectID
		}
	case workflowModels.Workflow:
		if workflow.ProjectID != nil {
			return *workflow.ProjectID
		}
	case map[string]interface{}:
		return uintFromAny(workflow["projectId"], workflow["project_id"])
	}

	return 0
}
func uintFromAny(values ...interface{}) uint {
	for _, value := range values {
		switch v := value.(type) {
		case uint:
			if v > 0 {
				return v
			}
		case int:
			if v > 0 {
				return uint(v)
			}
		case int64:
			if v > 0 {
				return uint(v)
			}
		case float64:
			if v > 0 {
				return uint(v)
			}
		case string:
			var parsed uint
			if _, err := fmt.Sscanf(strings.TrimSpace(v), "%d", &parsed); err == nil && parsed > 0 {
				return parsed
			}
		}
	}
	return 0
}

type projectWebsiteSourceListQuery struct {
	Keyword  string
	Status   string
	Page     int
	PageSize int
}

type projectWebsiteSourceListResult struct {
	List     []projectWebsiteSourceListItem
	Total    int64
	Page     int
	PageSize int
}

type projectWebsiteSourceListItem struct {
	ID                uint
	Name              string
	BaseURL           string
	EntryURL          string
	Status            string
	Tags              []string
	ListURLExamples   []string
	DetailURLExamples []string
	LastCheckedAt     *string
	LastCheckStatus   string
	LastCheckMessage  string
}

func listProjectWebsiteSources(userID uint, projectID uint, query projectWebsiteSourceListQuery) (*projectWebsiteSourceListResult, error) {
	if err := projectSupport.EnsureProjectOwner(database.DB, projectID, userID); err != nil {
		return nil, err
	}

	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}

	db := database.DB.Model(&projectModels.WebsiteSource{}).
		Where("user_id = ? AND project_id = ?", userID, projectID)

	if keyword := strings.TrimSpace(query.Keyword); keyword != "" {
		pattern := "%" + keyword + "%"
		db = db.Where("name LIKE ? OR base_url LIKE ? OR entry_url LIKE ? OR crawl_tips LIKE ?", pattern, pattern, pattern, pattern)
	}
	if status := strings.TrimSpace(query.Status); status != "" {
		db = db.Where("status = ?", status)
	}

	var total int64
	if err := db.Count(&total).Error; err != nil {
		return nil, err
	}

	var items []projectModels.WebsiteSource
	if err := db.Order("updated_at DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&items).Error; err != nil {
		return nil, err
	}

	result := &projectWebsiteSourceListResult{
		List:     make([]projectWebsiteSourceListItem, 0, len(items)),
		Total:    total,
		Page:     page,
		PageSize: pageSize,
	}

	for _, item := range items {
		entryURL := ""
		if item.EntryURL != nil {
			entryURL = *item.EntryURL
		}
		lastCheckedAt := optionalTimeString(item.LastCheckedAt)
		lastCheckStatus := optionalString(item.LastCheckStatus)
		lastCheckMessage := optionalString(item.LastCheckMessage)

		result.List = append(result.List, projectWebsiteSourceListItem{
			ID:                item.ID,
			Name:              item.Name,
			BaseURL:           item.BaseURL,
			EntryURL:          entryURL,
			Status:            item.Status,
			Tags:              stringSliceFromJSONB(item.Tags.Data),
			ListURLExamples:   stringSliceFromJSONB(item.ListURLExamples.Data),
			DetailURLExamples: stringSliceFromJSONB(item.DetailURLExamples.Data),
			LastCheckedAt:     lastCheckedAt,
			LastCheckStatus:   lastCheckStatus,
			LastCheckMessage:  lastCheckMessage,
		})
	}

	return result, nil
}

func optionalString(value *string) string {
	if value == nil {
		return ""
	}
	return strings.TrimSpace(*value)
}

func optionalTimeString(value interface{ Format(string) string }) *string {
	if value == nil {
		return nil
	}
	formatted := value.Format("2006-01-02T15:04:05Z07:00")
	return &formatted
}

func stringSliceFromJSONB(value interface{}) []string {
	rawList, ok := value.([]interface{})
	if !ok {
		return []string{}
	}
	result := make([]string, 0, len(rawList))
	for _, item := range rawList {
		if text, ok := item.(string); ok {
			text = strings.TrimSpace(text)
			if text != "" {
				result = append(result, text)
			}
		}
	}
	return result
}

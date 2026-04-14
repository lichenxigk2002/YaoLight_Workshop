package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/gin-gonic/gin"

	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/shared"
	systemModels "yaolight-workshop/backend/modules/system/models"
)

const adminOperationLogBodyLimit = 32768

var sensitiveOperationLogKeys = []string{
	"password",
	"passwd",
	"secret",
	"token",
	"authorization",
	"cookie",
	"api_key",
	"apikey",
	"access_key",
	"private_key",
	"refresh_token",
	"client_secret",
}

type adminOperationLogWriter struct {
	gin.ResponseWriter
	body bytes.Buffer
}

func (w *adminOperationLogWriter) Write(data []byte) (int, error) {
	if w.body.Len() < adminOperationLogBodyLimit {
		remaining := adminOperationLogBodyLimit - w.body.Len()
		if len(data) > remaining {
			w.body.Write(data[:remaining])
		} else {
			w.body.Write(data)
		}
	}
	return w.ResponseWriter.Write(data)
}

func (w *adminOperationLogWriter) WriteString(value string) (int, error) {
	return w.Write([]byte(value))
}

func AdminOperationLogMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		if !shouldAuditAdminRequest(ctx) {
			ctx.Next()
			return
		}

		requestBody := captureRequestBody(ctx)
		writer := &adminOperationLogWriter{ResponseWriter: ctx.Writer}
		ctx.Writer = writer

		ctx.Next()

		logRow := buildAdminOperationLog(ctx, requestBody, writer.body.Bytes())
		if logRow == nil {
			return
		}
		if err := database.DB.Create(logRow).Error; err != nil {
			log.Printf("failed to persist admin operation log: %v", err)
		}
	}
}

func shouldAuditAdminRequest(ctx *gin.Context) bool {
	if database.DB == nil {
		return false
	}
	if ctx.Request == nil || ctx.Request.URL == nil {
		return false
	}
	if !strings.HasPrefix(ctx.Request.URL.Path, "/api/admin/") {
		return false
	}
	switch ctx.Request.Method {
	case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func captureRequestBody(ctx *gin.Context) []byte {
	if ctx.Request == nil || ctx.Request.Body == nil {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(ctx.Request.Body, adminOperationLogBodyLimit+1))
	if err != nil {
		return nil
	}
	ctx.Request.Body = io.NopCloser(bytes.NewReader(body))
	return body
}

func buildAdminOperationLog(ctx *gin.Context, requestBody []byte, responseBody []byte) *systemModels.OperationLog {
	requestPayload := buildRequestPayload(ctx, requestBody)
	responsePayload := parsePayload(responseBody, ctx.Writer.Header().Get("Content-Type"))
	errorMessage := extractOperationLogError(ctx, responsePayload)
	statusCode := ctx.Writer.Status()

	return &systemModels.OperationLog{
		UserID:       extractCurrentUserID(ctx),
		Action:       resolveAdminAction(ctx.Request.Method, ctx.FullPath()),
		ResourceType: resolveAdminResourceType(ctx.FullPath()),
		ResourceID:   resolveAdminResourceID(ctx),
		IPAddress:    stringPtr(strings.TrimSpace(ctx.ClientIP())),
		UserAgent:    stringPtr(truncateString(ctx.Request.UserAgent(), 1024)),
		RequestData:  toJSONB(requestPayload),
		ResponseData: toJSONB(responsePayload),
		StatusCode:   intPtr(statusCode),
		ErrorMessage: stringPtr(errorMessage),
	}
}

func buildRequestPayload(ctx *gin.Context, requestBody []byte) map[string]interface{} {
	query := make(map[string]interface{}, len(ctx.Request.URL.Query()))
	for key, values := range ctx.Request.URL.Query() {
		if len(values) == 1 {
			query[key] = sanitizeOperationLogValue(key, values[0])
			continue
		}
		items := make([]interface{}, 0, len(values))
		for _, value := range values {
			items = append(items, sanitizeOperationLogValue(key, value))
		}
		query[key] = items
	}

	params := make(map[string]interface{}, len(ctx.Params))
	for _, param := range ctx.Params {
		params[param.Key] = sanitizeOperationLogValue(param.Key, param.Value)
	}

	payload := map[string]interface{}{
		"method":      ctx.Request.Method,
		"path":        ctx.Request.URL.Path,
		"full_path":   ctx.FullPath(),
		"query":       query,
		"path_params": params,
	}
	if body := parsePayload(requestBody, ctx.ContentType()); body != nil {
		payload["body"] = body
	}
	return payload
}

func parsePayload(raw []byte, contentType string) interface{} {
	if len(raw) == 0 {
		return nil
	}

	if len(raw) > adminOperationLogBodyLimit {
		raw = raw[:adminOperationLogBodyLimit]
	}

	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return nil
	}

	if strings.Contains(strings.ToLower(contentType), "json") || looksLikeJSON(trimmed) {
		var decoded interface{}
		if err := json.Unmarshal(trimmed, &decoded); err == nil {
			return sanitizeOperationLogValue("", decoded)
		}
	}

	return map[string]interface{}{
		"text": sanitizeOperationLogValue("", truncateString(string(trimmed), adminOperationLogBodyLimit/2)),
	}
}

func extractOperationLogError(ctx *gin.Context, responsePayload interface{}) string {
	if len(ctx.Errors) > 0 {
		return truncateString(ctx.Errors.String(), 2000)
	}

	statusCode := ctx.Writer.Status()
	if statusCode < 400 {
		return ""
	}

	if payload, ok := responsePayload.(map[string]interface{}); ok {
		if message, ok := payload["message"].(string); ok {
			return truncateString(message, 2000)
		}
	}

	return http.StatusText(statusCode)
}

func resolveAdminAction(method, fullPath string) string {
	segments := staticAdminSegments(fullPath)
	if len(segments) == 0 {
		return strings.ToLower(method)
	}

	last := normalizeSegment(segments[len(segments)-1])
	resource := normalizeSegment(segments[0])

	switch method {
	case http.MethodPost:
		if len(segments) > 1 && last != resource {
			return last
		}
		return "create"
	case http.MethodPut:
		if len(segments) > 1 && last != resource {
			return "update_" + last
		}
		return "update"
	case http.MethodPatch:
		if len(segments) > 1 && last != resource {
			return "patch_" + last
		}
		return "patch"
	case http.MethodDelete:
		return "delete"
	default:
		return strings.ToLower(method)
	}
}

func resolveAdminResourceType(fullPath string) string {
	segments := adminPathSegments(fullPath)
	if len(segments) == 0 {
		return "admin"
	}

	if len(segments) >= 2 && normalizeSegment(segments[0]) == "alkaid" {
		return normalizeSegment(segments[0] + "_" + segments[1])
	}

	return normalizeSegment(segments[0])
}

func resolveAdminResourceID(ctx *gin.Context) *uint {
	for _, param := range ctx.Params {
		value := strings.TrimSpace(param.Value)
		if value == "" {
			continue
		}
		parsed, err := strconv.ParseUint(value, 10, 32)
		if err != nil {
			continue
		}
		id := uint(parsed)
		return &id
	}
	return nil
}

func extractCurrentUserID(ctx *gin.Context) *uint {
	value, exists := ctx.Get("userID")
	if !exists {
		return nil
	}

	switch typed := value.(type) {
	case uint:
		return &typed
	case int:
		converted := uint(typed)
		return &converted
	case float64:
		converted := uint(typed)
		return &converted
	default:
		return nil
	}
}

func adminPathSegments(fullPath string) []string {
	if fullPath == "" {
		return nil
	}
	parts := strings.Split(strings.Trim(fullPath, "/"), "/")
	for index, part := range parts {
		if part == "admin" {
			return parts[index+1:]
		}
	}
	return nil
}

func staticAdminSegments(fullPath string) []string {
	segments := adminPathSegments(fullPath)
	if len(segments) == 0 {
		return nil
	}
	filtered := make([]string, 0, len(segments))
	for _, segment := range segments {
		if strings.HasPrefix(segment, ":") {
			continue
		}
		filtered = append(filtered, segment)
	}
	return filtered
}

func normalizeSegment(value string) string {
	return strings.ReplaceAll(strings.Trim(strings.ToLower(value), "/"), "-", "_")
}

func toJSONB(value interface{}) *shared.JSONB {
	if value == nil {
		return nil
	}
	return &shared.JSONB{Data: value}
}

func sanitizeOperationLogValue(key string, value interface{}) interface{} {
	if isSensitiveOperationLogKey(key) {
		return "***"
	}

	switch typed := value.(type) {
	case map[string]interface{}:
		result := make(map[string]interface{}, len(typed))
		for childKey, childValue := range typed {
			result[childKey] = sanitizeOperationLogValue(childKey, childValue)
		}
		return result
	case []interface{}:
		result := make([]interface{}, 0, len(typed))
		for _, item := range typed {
			result = append(result, sanitizeOperationLogValue("", item))
		}
		return result
	case []string:
		result := make([]interface{}, 0, len(typed))
		for _, item := range typed {
			result = append(result, sanitizeOperationLogValue(key, item))
		}
		return result
	case string:
		return truncateString(typed, 2000)
	default:
		return typed
	}
}

func isSensitiveOperationLogKey(key string) bool {
	normalized := strings.ToLower(strings.TrimSpace(key))
	if normalized == "" {
		return false
	}
	for _, candidate := range sensitiveOperationLogKeys {
		if strings.Contains(normalized, candidate) {
			return true
		}
	}
	return false
}

func looksLikeJSON(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	switch raw[0] {
	case '{', '[':
		return true
	default:
		return false
	}
}

func truncateString(value string, limit int) string {
	if limit <= 0 || len(value) <= limit {
		return value
	}
	return value[:limit] + "...(truncated)"
}

func intPtr(value int) *int {
	return &value
}

func stringPtr(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

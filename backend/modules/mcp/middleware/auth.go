package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"yaolight-workshop/backend/modules/mcp/services"
)

const (
	ContextUserID  = "userID"
	ContextTokenID = "mcpTokenID"
	ContextScopes  = "mcpScopes"
)

func MCPTokenAuthMiddleware(db *gorm.DB) gin.HandlerFunc {
	tokenService := services.NewTokenService(db)
	return func(ctx *gin.Context) {
		settings := services.LoadAccessSettings(db)
		if !settings.Enabled {
			ctx.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "MCP access is disabled",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		plainToken := bearerToken(ctx.GetHeader("Authorization"))
		if plainToken == "" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未提供 MCP Token",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		auth, err := tokenService.Authenticate(plainToken, ctx.ClientIP())
		if err != nil {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": err.Error(),
				"data":    nil,
			})
			ctx.Abort()
			return
		}
		if settings.RateLimitPerMinute > 0 {
			count, err := services.CountRecentTokenCalls(db, auth.Token.ID, time.Now().Add(-time.Minute))
			if err == nil && count >= int64(settings.RateLimitPerMinute) {
				ctx.JSON(http.StatusTooManyRequests, gin.H{
					"code":    429,
					"message": "MCP rate limit exceeded",
					"data":    nil,
				})
				ctx.Abort()
				return
			}
		}

		ctx.Set(ContextUserID, auth.User.ID)
		ctx.Set("username", auth.User.Username)
		ctx.Set(ContextTokenID, auth.Token.ID)
		ctx.Set(ContextScopes, auth.Scopes)
		ctx.Next()
	}
}

func HasScope(ctx *gin.Context, scope string) bool {
	raw, ok := ctx.Get(ContextScopes)
	if !ok {
		return false
	}
	scopes, ok := raw.(map[string]bool)
	return ok && scopes[scope]
}

func bearerToken(header string) string {
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"workflow-management-system/backend/infrastructure/jwt"
)

// JWTAuthMiddleware JWT 认证中间件
func JWTAuthMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		// 从请求头获取 Token
		authHeader := ctx.GetHeader("Authorization")
		if authHeader == "" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "未提供认证令牌",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		// 检查 Bearer 前缀
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "认证令牌格式错误",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		tokenString := parts[1]

		// 解析 Token
		claims, err := jwt.ParseToken(tokenString)
		if err != nil {
			statusCode := http.StatusUnauthorized
			code := 401
			message := "认证令牌无效"

			if err == jwt.ErrExpiredToken {
				message = "认证令牌已过期"
			}

			ctx.JSON(statusCode, gin.H{
				"code":    code,
				"message": message,
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		// 将用户信息存储到上下文
		ctx.Set("userID", claims.UserID)
		ctx.Set("username", claims.Username)
		ctx.Set("role", claims.Role)

		ctx.Next()
	}
}

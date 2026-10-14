package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func AdminOnlyMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		role, exists := ctx.Get("role")
		if !exists || role != "admin" {
			ctx.JSON(http.StatusForbidden, gin.H{
				"code":    403,
				"message": "forbidden",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		ctx.Next()
	}
}

package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"yaolight-workshop/backend/infrastructure/database"
	rbacServices "yaolight-workshop/backend/modules/rbac/services"
)

func RequirePermission(permission string) gin.HandlerFunc {
	return requirePermissions(false, permission)
}

func RequireAnyPermission(permissions ...string) gin.HandlerFunc {
	return requirePermissions(true, permissions...)
}

func requirePermissions(matchAny bool, permissions ...string) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		value, exists := ctx.Get("userID")
		if !exists {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "unauthorized",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		userID, ok := value.(uint)
		if !ok || userID == 0 {
			ctx.JSON(http.StatusUnauthorized, gin.H{
				"code":    401,
				"message": "unauthorized",
				"data":    nil,
			})
			ctx.Abort()
			return
		}

		service := rbacServices.NewRBACService(database.DB)
		allowed, err := hasRequiredPermission(service, userID, matchAny, permissions)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, gin.H{
				"code":    500,
				"message": "failed to check permission",
				"data":    nil,
			})
			ctx.Abort()
			return
		}
		if !allowed {
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

func hasRequiredPermission(service *rbacServices.RBACService, userID uint, matchAny bool, permissions []string) (bool, error) {
	if len(permissions) == 0 {
		return false, nil
	}

	if matchAny {
		for _, permission := range permissions {
			allowed, err := service.HasPermission(userID, permission)
			if err != nil {
				return false, err
			}
			if allowed {
				return true, nil
			}
		}
		return false, nil
	}

	for _, permission := range permissions {
		allowed, err := service.HasPermission(userID, permission)
		if err != nil {
			return false, err
		}
		if !allowed {
			return false, nil
		}
	}

	return true, nil
}

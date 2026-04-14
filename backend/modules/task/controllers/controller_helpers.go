package controllers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

func ok(ctx *gin.Context, message string, data interface{}) {
	ctx.JSON(http.StatusOK, gin.H{
		"code":    200,
		"message": message,
		"data":    data,
	})
}

func badRequest(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusBadRequest, gin.H{
		"code":    400,
		"message": message,
		"data":    nil,
	})
}

func notFound(ctx *gin.Context, message string) {
	ctx.JSON(http.StatusNotFound, gin.H{
		"code":    404,
		"message": message,
		"data":    nil,
	})
}

func internalError(ctx *gin.Context, message string, err error) {
	ctx.JSON(http.StatusInternalServerError, gin.H{
		"code":    500,
		"message": message + ": " + err.Error(),
		"data":    nil,
	})
}

func parseUintParam(ctx *gin.Context, name string) (uint, bool) {
	raw := ctx.Param(name)
	value, err := strconv.ParseUint(raw, 10, 32)
	if err != nil {
		badRequest(ctx, "invalid "+name)
		return 0, false
	}
	return uint(value), true
}

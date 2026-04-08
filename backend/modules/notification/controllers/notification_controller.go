package controllers

import (
	"net/http"
	"strconv"
	"strings"
	log "yaolight-workshop/backend/infrastructure/logx"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"yaolight-workshop/backend/infrastructure/jwt"
	"yaolight-workshop/backend/modules/notification/hub"
	"yaolight-workshop/backend/modules/notification/services"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return strings.HasPrefix(origin, "http://localhost") || strings.HasPrefix(origin, "http://127.0.0.1")
	},
}

// NotificationController 通知控制器
type NotificationController struct {
	service *services.NotificationService
	h       *hub.Hub
}

type notificationConsentActionPayload struct {
	Action string `json:"action"`
}

// NewNotificationController 创建通知控制器
func NewNotificationController(service *services.NotificationService, h *hub.Hub) *NotificationController {
	return &NotificationController{service: service, h: h}
}

// List 获取当前用户通知列表（分页）
func (c *NotificationController) List(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	page, _ := strconv.Atoi(ctx.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	list, total, err := c.service.List(userID.(uint), page, pageSize)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{
		"code": 200, "message": "ok",
		"data": gin.H{"list": list, "total": total},
	})
}

// MarkRead 标记单条已读
func (c *NotificationController) MarkRead(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	idStr := ctx.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 id", "data": nil})
		return
	}
	if err := c.service.MarkRead(uint(id), userID.(uint)); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": nil})
}

func (c *NotificationController) RespondConsent(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}

	id, err := strconv.ParseUint(ctx.Param("id"), 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "无效的 id", "data": nil})
		return
	}

	var payload notificationConsentActionPayload
	if err := ctx.ShouldBindJSON(&payload); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": "invalid request payload", "data": nil})
		return
	}

	result, err := c.service.RespondWorkflowTemplateConsent(uint(id), userID.(uint), payload.Action)
	if err != nil {
		switch err {
		case services.ErrNotificationNotFound:
			ctx.JSON(http.StatusNotFound, gin.H{"code": 404, "message": err.Error(), "data": nil})
		case services.ErrNotificationConsentActionInvalid,
			services.ErrNotificationConsentUnsupported,
			services.ErrNotificationConsentNotFound,
			services.ErrNotificationConsentAlreadyHandled:
			ctx.JSON(http.StatusBadRequest, gin.H{"code": 400, "message": err.Error(), "data": nil})
		default:
			ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": result})
}

// MarkAllRead 全部标为已读
func (c *NotificationController) MarkAllRead(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	if err := c.service.MarkAllRead(userID.(uint)); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": nil})
}

// UnreadCount 未读数量
func (c *NotificationController) UnreadCount(ctx *gin.Context) {
	userID, exists := ctx.Get("userID")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "未授权", "data": nil})
		return
	}
	count, err := c.service.UnreadCount(userID.(uint))
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"code": 500, "message": err.Error(), "data": nil})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"code": 200, "message": "ok", "data": gin.H{"count": count}})
}

// HandleWebSocket 升级为 WebSocket，通过 query token 鉴权，连接后加入 Hub
func (c *NotificationController) HandleWebSocket(ctx *gin.Context) {
	token := ctx.Query("token")
	if token == "" {
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "缺少 token"})
		return
	}
	claims, err := jwt.ParseToken(token)
	if err != nil {
		log.Printf("[notification] WebSocket 鉴权失败: %v", err)
		ctx.JSON(http.StatusUnauthorized, gin.H{"code": 401, "message": "token 无效或已过期"})
		return
	}
	conn, err := upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		log.Printf("[notification] WebSocket upgrade 失败: %v", err)
		return
	}
	log.Printf("[notification] WebSocket 连接成功: userID=%d", claims.UserID)
	client := &hub.Client{
		UserID: claims.UserID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}
	c.h.Register(client)
	// 读循环：仅用于检测断开，不处理业务消息
	go func() {
		defer c.h.Unregister(client)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				break
			}
		}
	}()
}

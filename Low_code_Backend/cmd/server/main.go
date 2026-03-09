package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/middleware"
	"yaolight-workshop/backend/infrastructure/redis"
	aiControllers "yaolight-workshop/backend/modules/ai/controllers"
	alkaidControllers "yaolight-workshop/backend/modules/alkaid/controllers"
	billingControllers "yaolight-workshop/backend/modules/billing/controllers"
	artifactControllers "yaolight-workshop/backend/modules/artifact/controllers"
	fileControllers "yaolight-workshop/backend/modules/file/controllers"
	notificationModule "yaolight-workshop/backend/modules/notification"
	notificationControllers "yaolight-workshop/backend/modules/notification/controllers"
	notificationHub "yaolight-workshop/backend/modules/notification/hub"
	notificationRepos "yaolight-workshop/backend/modules/notification/repositories"
	notificationServices "yaolight-workshop/backend/modules/notification/services"
	paymentControllers "yaolight-workshop/backend/modules/payment/controllers"
	projectControllers "yaolight-workshop/backend/modules/project/controllers"
	taskControllers "yaolight-workshop/backend/modules/task/controllers"
	authControllers "yaolight-workshop/backend/modules/user/controllers"
	userRepositories "yaolight-workshop/backend/modules/user/repositories"
	userServices "yaolight-workshop/backend/modules/user/services"
	workflowControllers "yaolight-workshop/backend/modules/workflow/controllers"
)

func main() {
	// 1. 加载配置
	if err := config.LoadConfig(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. 初始化数据库连接和迁移
	if err := database.InitDatabase(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDatabase()

	// 仅执行数据库迁移后退出（用于 CI/CD：先 migrate 再 up -d）
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		log.Println("✅ Database migration completed (migrate-only mode)")
		return
	}

	// 2.5 初始化 Redis（可选，失败不影响运行）
	if err := redis.InitRedis(); err != nil {
		log.Printf("⚠️ Redis initialization failed (will use memory cache): %v", err)
	} else {
		defer redis.CloseRedis()
	}

	// 3. 设置Gin模式
	if config.ServerMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 4. 创建Gin路由
	r := gin.Default()

	// 配置 CORS（允许跨域请求：本地开发 + 生产环境 FRONTEND_URL）
	allowOrigins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
		"http://localhost:3200",
		"http://127.0.0.1:3200",
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	}
	if config.FrontendURL != "" {
		allowOrigins = append(allowOrigins, config.FrontendURL)
	}
	r.Use(cors.New(cors.Config{
		AllowOrigins:     allowOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "Cache-Control"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * 60 * 60, // 12 hours
	}))

	// 5. 健康检查接口
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"code":    200,
			"message": "Server is running",
			"data": gin.H{
				"status": "ok",
			},
		})
	})

	// 6. API路由
	api := r.Group("/api")
	{
		api.GET("/", func(c *gin.Context) {
			c.JSON(200, gin.H{
				"code":    200,
				"message": "Workflow Management System API",
				"data": gin.H{
					"version":      "1.0.0",
					"architecture": "DDD",
				},
			})
		})

		// 静态资源代理（图片）
		imageProxyController := fileControllers.NewImageProxyController()
		api.GET("/proxy/image", imageProxyController.ProxyImage)

		// 静态文件服务（上传的文件）
		api.Static("/uploads", config.UploadPath)

		// 认证相关路由（无需JWT中间件）
		userRepo := userRepositories.NewUserRepository(database.DB)
		oauthBindingRepo := userRepositories.NewOAuthBindingRepository(database.DB)
		avatarHistoryRepo := userRepositories.NewAvatarHistoryRepository(database.DB)
		authService := userServices.NewAuthService(userRepo, oauthBindingRepo, avatarHistoryRepo)
		authController := authControllers.NewAuthControllerWithService(authService)
		oauthController := authControllers.NewOAuthController(authService)
		api.POST("/auth/register", authController.Register)
		api.POST("/auth/login", authController.Login)
		api.POST("/auth/send-code", authController.SendVerificationCode)
		api.POST("/auth/send-register-code", authController.SendRegisterCode)
		api.POST("/auth/email-login", authController.EmailLogin)
		api.POST("/auth/email-register", authController.EmailRegister)
		api.POST("/auth/send-forgot-password-code", authController.SendForgotPasswordCode)
		api.POST("/auth/reset-password", authController.ResetPasswordByEmail)
		// OAuth 登录（Google / GitHub）
		api.GET("/auth/google", oauthController.GoogleRedirect)
		api.GET("/auth/google/callback", oauthController.GoogleCallback)
		api.GET("/auth/github", oauthController.GitHubRedirect)
		api.GET("/auth/github/callback", oauthController.GitHubCallback)

		// 支付相关路由（部分需要认证）
		paymentController := paymentControllers.NewPaymentController()
		api.GET("/payment/packages", paymentController.GetPackages)              // 获取套餐列表（无需认证）
		api.POST("/payment/alipay/notify", paymentController.HandleAlipayNotify) // 支付宝异步通知（无需认证，由支付宝调用）
		api.GET("/payment/callback", paymentController.HandleAlipayReturn)       // 支付宝同步跳转（无需认证）

		// 站内通知 WebSocket（通过 query token 鉴权，不加 JWT 中间件）
		notificationHubInstance := notificationHub.NewHub()
		notificationRepo := notificationRepos.NewNotificationRepository(database.DB)
		notificationService := notificationServices.NewNotificationService(notificationRepo, notificationHubInstance)
		notificationModule.SetDefaultService(notificationService)
		notificationController := notificationControllers.NewNotificationController(notificationService, notificationHubInstance)
		api.GET("/ws/notifications", notificationController.HandleWebSocket)

		// 需要认证的路由
		auth := api.Group("")
		auth.Use(middleware.JWTAuthMiddleware())
		{
			// 用户相关路由
			auth.GET("/users/current", authController.GetCurrentUser)
			auth.PUT("/users/username", authController.UpdateUsername)
			auth.POST("/users/change-password", authController.ChangePassword)
			auth.GET("/users/notification-preferences", authController.GetNotificationPreferences)
			auth.PUT("/users/notification-preferences", authController.UpdateNotificationPreferences)
			auth.GET("/users/token-transactions", authController.GetTokenTransactions)
			auth.GET("/users/token-transactions/options", authController.GetTransactionOptions)
			auth.GET("/users/token-transactions/stats", authController.GetTokenStats)
			auth.GET("/users/bills/summary", authController.GetBillSummary)
			auth.GET("/users/bills/export", authController.GetBillsExport)
			auth.POST("/users/avatar", authController.UploadAvatar)
			auth.GET("/users/avatar/history", authController.GetAvatarHistory)
			auth.POST("/users/avatar/use", authController.UseAvatar)
			auth.DELETE("/users/avatar/history/:id", authController.DeleteAvatarHistory)
			auth.GET("/users/oauth-bindings", authController.GetOAuthBindings)
			auth.POST("/users/oauth-bindings/request", authController.RequestOAuthBind)
			auth.DELETE("/users/oauth-bindings/:provider", authController.UnbindOAuth)
			// 邀请好友
			invitationController := authControllers.NewInvitationController()
			auth.GET("/users/invite/link", invitationController.GetInviteLink)
			auth.GET("/users/invite/stats", invitationController.GetInviteStats)
			auth.GET("/users/invite/list", invitationController.GetInvitationList)
			// 账号注销（确认 + 邮箱验证码）
			auth.POST("/auth/send-deactivate-code", authController.SendDeactivateCode)
			auth.POST("/auth/confirm-deactivate", authController.ConfirmDeactivate)
			// 邮箱换绑 / 解绑（验证码）
			auth.POST("/auth/send-email-bind-code", authController.SendEmailBindCode)
			auth.POST("/auth/send-email-change-code", authController.SendEmailChangeCodeToNew)
			auth.POST("/auth/confirm-email-change", authController.ConfirmEmailChange)
			auth.POST("/auth/send-email-unbind-code", authController.SendEmailUnbindCode)
			auth.POST("/auth/confirm-email-unbind", authController.ConfirmEmailUnbind)

			// 项目相关路由
			projectController := projectControllers.NewProjectController()
			auth.GET("/projects", projectController.GetProjectList)
			auth.GET("/projects/:id", projectController.GetProjectByID)
			auth.POST("/projects", projectController.CreateProject)
			auth.PUT("/projects/:id", projectController.UpdateProject)
			auth.DELETE("/projects/:id", projectController.DeleteProject)

			// 工作流相关路由
			workflowController := workflowControllers.NewWorkflowController()
			auth.GET("/workflows", workflowController.GetWorkflowList)
			auth.GET("/workflows/:id", workflowController.GetWorkflowByID)
			auth.POST("/workflows", workflowController.CreateWorkflow)
			auth.PUT("/workflows/:id", workflowController.UpdateWorkflow)
			auth.DELETE("/workflows/:id", workflowController.DeleteWorkflow)
			auth.GET("/workflows/:id/nodes", workflowController.GetWorkflowNodes)
			auth.PUT("/workflows/:id/nodes", workflowController.SaveWorkflowNodes)
			auth.PUT("/workflows/:id/nodes/:nodeId", workflowController.SaveWorkflowNode)
			auth.POST("/workflows/execute", workflowController.ExecuteWorkflow)
			auth.POST("/workflows/execute/stream", workflowController.ExecuteWorkflowStream)

			// 任务相关路由
			taskController := taskControllers.NewTaskController()
			auth.GET("/workflows/:id/tasks", taskController.GetWorkflowTasks)            // 获取工作流的任务历史列表
			auth.GET("/workflows/:id/running-tasks", taskController.GetRunningTasks)     // 获取正在运行的任务
			auth.GET("/tasks/:id", taskController.GetTaskDetail)                         // 获取任务详情
			auth.GET("/tasks/:id/node-executions", taskController.GetTaskNodeExecutions) // 获取任务的节点执行记录
			auth.GET("/tasks/:id/logs", taskController.GetTaskLogs)                      // 获取任务日志

			// 导出制品（输出节点生成的文件/图表等）
			artifactController := artifactControllers.NewArtifactController()
			auth.GET("/tasks/:id/artifacts", artifactController.ListByTask)
			auth.GET("/artifacts/:id", artifactController.GetByID)
			auth.GET("/artifacts/:id/download", artifactController.Download)
			auth.POST("/tasks/:id/artifacts/send-email", artifactController.SendByEmail)

			// AI模型相关路由
			aiController := aiControllers.NewAIController()
			auth.GET("/ai/providers/templates", aiController.GetProviderTemplates)
			auth.GET("/ai/models/system", aiController.GetSystemPresetModels)
			auth.GET("/ai/model-capabilities", aiController.GetModelCapability)
			auth.GET("/ai/models", aiController.GetModels)
			auth.POST("/ai/models", aiController.CreateModel)
			auth.PUT("/ai/models/:id", aiController.UpdateModel)
			auth.DELETE("/ai/models/:id", aiController.DeleteModel)
			adminAIController := aiControllers.NewAdminAIController()
			adminAI := auth.Group("/admin/ai-models")
			adminAI.Use(middleware.AdminOnlyMiddleware())
			adminAI.GET("", adminAIController.GetModels)
			adminAI.GET("/providers", adminAIController.GetProviders)
			adminAI.GET("/providers/:provider", adminAIController.GetProvider)
			adminAI.GET("/models", adminAIController.GetModels)
			adminAI.POST("/models", adminAIController.CreateModel)
			adminAI.GET("/models/:id", adminAIController.GetModel)
			adminAI.PUT("/models/:id", adminAIController.UpdateModel)
			adminAI.GET("/models/:id/capability", adminAIController.GetModelCapability)
			adminAI.PUT("/models/:id/capability", adminAIController.UpdateModelCapability)
			adminAI.GET("/models/:id/pricing", adminAIController.GetModelPricing)
			adminAI.PUT("/models/:id/pricing", adminAIController.UpdateModelPricing)
			adminAI.GET("/pricing-rules", adminAIController.GetPricingRules)
			adminAI.GET("/usage", adminAIController.GetUsage)

			// 计费运营：补救配额、管理员赠送、配额流水、订单与 Token 流水
			adminQuotaController := billingControllers.NewAdminQuotaController()
			adminBillingController := billingControllers.NewAdminBillingController()
			adminBilling := auth.Group("/admin/billing")
			adminBilling.Use(middleware.AdminOnlyMiddleware())
			adminBilling.POST("/quotas/recover", adminQuotaController.RecoverQuota)
			adminBilling.POST("/quotas/grant", adminQuotaController.GrantQuota)
			adminBilling.GET("/quotas/ledger", adminQuotaController.GetQuotaLedger)
			adminBilling.GET("/quotas/summary", adminQuotaController.GetQuotaSummary)
			adminBilling.GET("/orders", adminBillingController.ListOrders)
			adminBilling.GET("/token-transactions", adminBillingController.ListTokenTransactions)

			// 瑶光星（Alkaid）对话相关路由
			alkaidController := alkaidControllers.NewAlkaidController()
			auth.GET("/alkaid/capabilities", alkaidController.GetCapabilities)
			auth.POST("/alkaid/sessions", alkaidController.CreateSession)
			auth.GET("/alkaid/sessions", alkaidController.GetSessions)
			auth.GET("/alkaid/sessions/:id", alkaidController.GetSession)
			auth.PUT("/alkaid/sessions/:id/title", alkaidController.UpdateSessionTitle)
			auth.DELETE("/alkaid/sessions/:id", alkaidController.DeleteSession)
			auth.POST("/alkaid/messages", alkaidController.SendMessage)
			auth.POST("/alkaid/messages/stream", alkaidController.SendMessageStream) // 原有流式接口
			auth.POST("/alkaid/sessions/:id/stream", alkaidController.SessionStream) // Agentic 流式接口（SSE 进度事件）
			auth.POST("/alkaid/apply-workflow", alkaidController.ApplyWorkflow)
			auth.POST("/alkaid/apply-patch", alkaidController.ApplyPatch)
			auth.POST("/alkaid/discard-pending", alkaidController.DiscardPending)
			auth.GET("/alkaid/sessions/:id/messages", alkaidController.GetMessages)

			// 支付相关路由（需要认证）
			paymentController := paymentControllers.NewPaymentController()
			auth.POST("/payment/orders", paymentController.CreateOrder)                   // 创建订单
			auth.GET("/payment/orders", paymentController.ListUserOrders)                 // 获取当前用户订单列表
			auth.GET("/payment/orders/:orderId/status", paymentController.GetOrderStatus)  // 查询订单状态
			auth.GET("/payment/orders/:orderId/detail", paymentController.GetOrderDetail)  // 订单详情（含继续支付链接）
			auth.POST("/payment/orders/:orderId/cancel", paymentController.CancelOrder)    // 取消订单
			auth.DELETE("/payment/orders/:orderId", paymentController.DeleteOrder)       // 删除订单
			auth.POST("/payment/orders/:orderId/mock-pay", paymentController.MockPay)     // 模拟支付（仅开发用）

			// 站内通知 REST
			auth.GET("/notifications", notificationController.List)
			auth.GET("/notifications/unread-count", notificationController.UnreadCount)
			auth.PUT("/notifications/:id/read", notificationController.MarkRead)
			auth.PUT("/notifications/read-all", notificationController.MarkAllRead)
		}
	}

	// 7. 启动服务器
	addr := fmt.Sprintf(":%s", config.ServerPort)
	log.Printf("🚀 Server starting on http://localhost%s", addr)
	log.Println("✅ Database migration completed")
	log.Println("📐 Architecture: Domain-Driven Design (DDD)")

	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

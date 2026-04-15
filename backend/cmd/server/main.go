package main

import (
	"context"
	"fmt"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	log "yaolight-workshop/backend/infrastructure/logx"
	"yaolight-workshop/backend/infrastructure/middleware"
	"yaolight-workshop/backend/infrastructure/redis"
	aiControllers "yaolight-workshop/backend/modules/ai/controllers"
	aiServices "yaolight-workshop/backend/modules/ai/services"
	alkaidControllers "yaolight-workshop/backend/modules/alkaid/controllers"
	artifactControllers "yaolight-workshop/backend/modules/artifact/controllers"
	billingControllers "yaolight-workshop/backend/modules/billing/controllers"
	crawlerControllers "yaolight-workshop/backend/modules/crawler/controllers"
	fileControllers "yaolight-workshop/backend/modules/file/controllers"
	nodeControllers "yaolight-workshop/backend/modules/node/controllers"
	notificationModule "yaolight-workshop/backend/modules/notification"
	notificationControllers "yaolight-workshop/backend/modules/notification/controllers"
	notificationHub "yaolight-workshop/backend/modules/notification/hub"
	notificationRepos "yaolight-workshop/backend/modules/notification/repositories"
	notificationServices "yaolight-workshop/backend/modules/notification/services"
	paymentControllers "yaolight-workshop/backend/modules/payment/controllers"
	projectControllers "yaolight-workshop/backend/modules/project/controllers"
	rbacControllers "yaolight-workshop/backend/modules/rbac/controllers"
	rbacMiddleware "yaolight-workshop/backend/modules/rbac/middleware"
	systemControllers "yaolight-workshop/backend/modules/system/controllers"
	systemServices "yaolight-workshop/backend/modules/system/services"
	taskControllers "yaolight-workshop/backend/modules/task/controllers"
	taskServices "yaolight-workshop/backend/modules/task/services"
	authControllers "yaolight-workshop/backend/modules/user/controllers"
	userRepositories "yaolight-workshop/backend/modules/user/repositories"
	userServices "yaolight-workshop/backend/modules/user/services"
	workflowControllers "yaolight-workshop/backend/modules/workflow/controllers"
	workflowAPIControllers "yaolight-workshop/backend/modules/workflowapi/controllers"
)

func main() {
	log.ConfigureStdLogger()

	// 1. 加载配置
	if err := config.LoadConfig(); err != nil {
		log.Fatalf(1001, "Failed to load config: %v", err)
	}

	// 2. 初始化数据库连接和迁移
	if err := database.InitDatabase(); err != nil {
		log.Fatalf(1002, "Failed to initialize database: %v", err)
	}
	defer database.CloseDatabase()
	log.SetSink(systemServices.NewAppLogSink(database.DB))

	// 仅执行数据库迁移后退出（用于 CI/CD：先 migrate 再 up -d）
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		log.Infof(1003, "Database migration completed (migrate-only mode)")
		return
	}

	// 2.5 初始化 Redis（可选，失败不影响运行）
	if err := redis.InitRedis(); err != nil {
		log.Warnf(1004, "Redis initialization failed (will use memory cache): %v", err)
	} else {
		defer redis.CloseRedis()
	}

	// 3. 设置Gin模式
	if config.ServerMode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 4. 创建Gin路由
	r := gin.Default()

	aiMonitoringService := aiServices.NewAIModelMonitoringService(database.DB)

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
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "Cache-Control", "X-API-Key"},
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
	workflowAPIController := workflowAPIControllers.NewWorkflowAPIController()
	taskScheduleService := taskServices.NewTaskScheduleService(database.DB)
	taskScheduleController := taskControllers.NewTaskScheduleController(taskScheduleService)
	openAPI := r.Group("/open-api/v1")
	{
		openAPI.GET("/workflows/:slug/docs", workflowAPIController.GetDocs)
		openAPI.POST("/workflows/:slug/invoke", workflowAPIController.PublicInvoke)
		openAPI.GET("/workflows/:slug/invocations/:requestId", workflowAPIController.GetInvocation)
		openAPI.GET("/workflows/:slug/invocations/:requestId/artifacts", workflowAPIController.ListInvocationArtifacts)
		openAPI.GET("/workflows/:slug/invocations/:requestId/artifacts/:artifactId/download", workflowAPIController.DownloadInvocationArtifact)
		openAPI.POST("/triggers/:token/invoke", taskScheduleController.InvokeWebhook)
	}

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
		notificationService := notificationServices.NewNotificationService(notificationRepo, notificationHubInstance, database.DB)
		adminNotificationService := notificationServices.NewAdminNotificationService(database.DB, notificationRepo, notificationService)
		notificationModule.SetDefaultService(notificationService)
		notificationController := notificationControllers.NewNotificationController(notificationService, notificationHubInstance)
		adminNotificationController := notificationControllers.NewAdminNotificationController(adminNotificationService)
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
			projectWebsiteSourceController := projectControllers.NewProjectWebsiteSourceController()
			projectKnowledgeController := alkaidControllers.NewProjectKnowledgeController()
			auth.GET("/projects", projectController.GetProjectList)
			auth.GET("/projects/:id", projectController.GetProjectByID)
			auth.POST("/projects", projectController.CreateProject)
			auth.PUT("/projects/:id", projectController.UpdateProject)
			auth.DELETE("/projects/:id", projectController.DeleteProject)
			auth.GET("/projects/:id/knowledge", projectKnowledgeController.ListKnowledge)
			auth.POST("/projects/:id/knowledge", projectKnowledgeController.CreateKnowledge)
			auth.POST("/projects/:id/knowledge/search-test", projectKnowledgeController.SearchTest)
			auth.GET("/projects/:id/knowledge/:knowledgeId", projectKnowledgeController.GetKnowledge)
			auth.PUT("/projects/:id/knowledge/:knowledgeId", projectKnowledgeController.UpdateKnowledge)
			auth.DELETE("/projects/:id/knowledge/:knowledgeId", projectKnowledgeController.DeleteKnowledge)
			auth.PATCH("/projects/:id/knowledge/:knowledgeId/status", projectKnowledgeController.SetKnowledgeStatus)
			auth.GET("/projects/:id/sources", projectWebsiteSourceController.ListSources)
			auth.POST("/projects/:id/sources", projectWebsiteSourceController.CreateSource)
			auth.GET("/projects/:id/sources/:sourceId", projectWebsiteSourceController.GetSource)
			auth.PUT("/projects/:id/sources/:sourceId", projectWebsiteSourceController.UpdateSource)
			auth.DELETE("/projects/:id/sources/:sourceId", projectWebsiteSourceController.DeleteSource)
			auth.PATCH("/projects/:id/sources/:sourceId/status", projectWebsiteSourceController.SetSourceStatus)
			auth.POST("/projects/:id/sources/:sourceId/check", projectWebsiteSourceController.CheckSource)

			// 工作流相关路由
			workflowController := workflowControllers.NewWorkflowController()
			auth.GET("/workflows", workflowController.GetWorkflowList)
			auth.GET("/workflows/templates", workflowController.ListPublishedTemplates)
			auth.GET("/workflows/templates/:id/nodes", workflowController.GetPublishedTemplateNodes)
			auth.GET("/workflows/:id", workflowController.GetWorkflowByID)
			auth.POST("/workflows", workflowController.CreateWorkflow)
			auth.PUT("/workflows/:id", workflowController.UpdateWorkflow)
			auth.DELETE("/workflows/:id", workflowController.DeleteWorkflow)
			auth.GET("/workflows/:id/nodes", workflowController.GetWorkflowNodes)
			auth.PUT("/workflows/:id/nodes", workflowController.SaveWorkflowNodes)
			auth.PUT("/workflows/:id/nodes/:nodeId", workflowController.SaveWorkflowNode)
			auth.GET("/workflows/:id/api", workflowAPIController.GetEndpoint)
			auth.POST("/workflows/:id/api", workflowAPIController.UpsertEndpoint)
			auth.GET("/workflows/:id/api/keys", workflowAPIController.ListKeys)
			auth.POST("/workflows/:id/api/keys", workflowAPIController.CreateKey)
			auth.GET("/workflows/:id/api/invocations", workflowAPIController.ListInvocations)
			auth.POST("/workflows/execute", workflowController.ExecuteWorkflow)
			auth.POST("/workflows/execute/stream", workflowController.ExecuteWorkflowStream)
			auth.GET("/crawler-rules/options", crawlerControllers.NewAdminCrawlerRuleController().ListActiveRuleOptions)

			// 任务相关路由
			taskController := taskControllers.NewTaskController()
			auth.GET("/workflows/:id/tasks", taskController.GetWorkflowTasks)            // 获取工作流的任务历史列表
			auth.GET("/workflows/:id/running-tasks", taskController.GetRunningTasks)     // 获取正在运行的任务
			auth.GET("/tasks/:id", taskController.GetTaskDetail)                         // 获取任务详情
			auth.GET("/tasks/:id/node-executions", taskController.GetTaskNodeExecutions) // 获取任务的节点执行记录
			auth.GET("/tasks/:id/node-executions/:executionId", taskController.GetTaskNodeExecutionDetail)
			auth.GET("/tasks/:id/logs", taskController.GetTaskLogs) // 获取任务日志
			auth.GET("/task-schedules", taskScheduleController.ListSchedules)
			auth.POST("/task-schedules", taskScheduleController.CreateSchedule)
			auth.PATCH("/task-schedules/:id", taskScheduleController.UpdateSchedule)
			auth.POST("/task-schedules/:id/cancel", taskScheduleController.CancelSchedule)
			auth.POST("/task-schedules/:id/trigger-now", taskScheduleController.TriggerNow)
			auth.GET("/task-schedules/:id/runs", taskScheduleController.ListRuns)

			adminTaskController := taskControllers.NewAdminTaskController()
			adminTasks := auth.Group("/admin/tasks")
			adminTasks.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminTasks.GET("", rbacMiddleware.RequirePermission("tasks.overview:view"), adminTaskController.ListTasks)
			adminTasks.GET("/summary", rbacMiddleware.RequirePermission("tasks.overview:view"), adminTaskController.GetSummary)
			adminTasks.GET("/running", rbacMiddleware.RequirePermission("tasks.running:view"), adminTaskController.ListRunningTasks)
			adminTasks.GET("/failures", rbacMiddleware.RequirePermission("tasks.failures:view"), adminTaskController.ListFailureTasks)
			adminTasks.GET("/failure-stats", rbacMiddleware.RequirePermission("tasks.failures:view"), adminTaskController.GetFailureStats)
			adminTasks.POST("/:id/cancel", rbacMiddleware.RequirePermission("tasks.detail:edit"), adminTaskController.CancelTask)
			adminTasks.POST("/:id/retry", rbacMiddleware.RequirePermission("tasks.detail:edit"), adminTaskController.RetryTask)
			adminTasks.GET("/:id", rbacMiddleware.RequirePermission("tasks.detail:view"), adminTaskController.GetTaskDetail)
			adminTasks.GET("/:id/artifacts", rbacMiddleware.RequirePermission("tasks.detail:view"), adminTaskController.ListTaskArtifacts)
			adminTasks.GET("/:id/node-executions", rbacMiddleware.RequirePermission("tasks.detail:view"), adminTaskController.GetTaskNodeExecutions)
			adminTasks.GET("/:id/node-executions/:executionId", rbacMiddleware.RequirePermission("tasks.detail:view"), adminTaskController.GetTaskNodeExecutionDetail)
			adminTasks.GET("/:id/logs", rbacMiddleware.RequirePermission("tasks.detail:view"), adminTaskController.GetTaskLogs)
			adminTasks.GET("/artifacts/:artifactId/download", rbacMiddleware.RequirePermission("tasks.detail:view"), adminTaskController.DownloadArtifact)

			// 导出制品（输出节点生成的文件/图表等）
			artifactController := artifactControllers.NewArtifactController()
			auth.GET("/projects/:id/artifacts", artifactController.ListByProject)
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
			adminAIController := aiControllers.NewAdminAIController(aiMonitoringService)
			adminAI := auth.Group("/admin/ai-models")
			adminAI.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminAI.GET("", rbacMiddleware.RequirePermission("ai_models.overview:view"), adminAIController.GetModels)
			adminAI.GET("/providers", rbacMiddleware.RequirePermission("ai_models.providers:view"), adminAIController.GetProviders)
			adminAI.GET("/providers/:provider", rbacMiddleware.RequirePermission("ai_models.providers:view"), adminAIController.GetProvider)
			adminAI.GET("/models", rbacMiddleware.RequirePermission("ai_models.models:view"), adminAIController.GetModels)
			adminAI.POST("/models", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.CreateModel)
			adminAI.GET("/models/:id", rbacMiddleware.RequirePermission("ai_models.models:view"), adminAIController.GetModel)
			adminAI.PUT("/models/:id", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.UpdateModel)
			adminAI.DELETE("/models/:id", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.DeleteModel)
			adminAI.GET("/models/:id/capability", rbacMiddleware.RequirePermission("ai_models.models:view"), adminAIController.GetModelCapability)
			adminAI.PUT("/models/:id/capability", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.UpdateModelCapability)
			adminAI.GET("/models/:id/pricing", rbacMiddleware.RequirePermission("ai_models.models:view"), adminAIController.GetModelPricing)
			adminAI.PUT("/models/:id/pricing", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.UpdateModelPricing)
			adminAI.GET("/pricing-rules", rbacMiddleware.RequirePermission("ai_models.pricing_rules:view"), adminAIController.GetPricingRules)
			adminAI.GET("/usage", rbacMiddleware.RequirePermission("ai_models.usage:view"), adminAIController.GetUsage)
			adminAI.GET("/monitoring", rbacMiddleware.RequirePermission("ai_models.overview:view"), adminAIController.GetMonitoringSnapshot)
			adminAI.PUT("/monitoring/settings", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.UpdateMonitoringSettings)
			adminAI.POST("/monitoring/check-all", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.RunMonitoringCheckAll)
			adminAI.POST("/monitoring/models/:id/check", rbacMiddleware.RequirePermission("ai_models.models:edit"), adminAIController.RunMonitoringCheckModel)

			// 计费运营：补救配额、管理员赠送、配额流水、订单与 Token 流水
			adminQuotaController := billingControllers.NewAdminQuotaController()
			adminBillingController := billingControllers.NewAdminBillingController()
			adminBilling := auth.Group("/admin/billing")
			adminBilling.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminBilling.GET("/users/options", rbacMiddleware.RequireAnyPermission("billing.quota_recovery:edit", "billing.admin_grant:edit"), adminBillingController.ListUserOptions)
			adminBilling.POST("/quotas/recover", rbacMiddleware.RequirePermission("billing.quota_recovery:edit"), adminQuotaController.RecoverQuota)
			adminBilling.POST("/quotas/grant", rbacMiddleware.RequirePermission("billing.admin_grant:edit"), adminQuotaController.GrantQuota)
			adminBilling.GET("/quotas/ledger", rbacMiddleware.RequirePermission("billing.ledger:view"), adminQuotaController.GetQuotaLedger)
			adminBilling.GET("/quotas/summary", rbacMiddleware.RequirePermission("billing.overview:view"), adminQuotaController.GetQuotaSummary)
			adminBilling.GET("/orders", rbacMiddleware.RequirePermission("billing.orders:view"), adminBillingController.ListOrders)
			adminBilling.GET("/token-transactions", rbacMiddleware.RequirePermission("billing.token_ledger:view"), adminBillingController.ListTokenTransactions)

			adminUserController := authControllers.NewAdminUserController()
			adminUsers := auth.Group("/admin/users")
			adminUsers.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminUsers.GET("/summary", rbacMiddleware.RequirePermission("users:view"), adminUserController.GetSummary)
			adminUsers.GET("", rbacMiddleware.RequirePermission("users:view"), adminUserController.GetUsers)
			adminUsers.GET("/:id", rbacMiddleware.RequirePermission("users:view"), adminUserController.GetUser)
			adminUsers.PUT("/:id/status", rbacMiddleware.RequirePermission("users:edit"), adminUserController.UpdateUserStatus)
			adminUsers.POST("/:id/reset-password", rbacMiddleware.RequirePermission("users:edit"), adminUserController.ResetPassword)

			adminRBACController := rbacControllers.NewAdminRBACController()
			adminRBAC := auth.Group("/admin/rbac")
			adminRBAC.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminRBAC.GET("/permissions", rbacMiddleware.RequirePermission("permissions:view"), adminRBACController.ListPermissions)
			adminRBAC.GET("/roles", rbacMiddleware.RequirePermission("permissions:view"), adminRBACController.ListRoles)
			adminRBAC.POST("/roles", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.CreateRole)
			adminRBAC.PUT("/roles/:id", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.UpdateRole)
			adminRBAC.GET("/admins", rbacMiddleware.RequirePermission("permissions:view"), adminRBACController.ListAdmins)
			adminRBAC.GET("/promotable-users", rbacMiddleware.RequirePermission("permissions:view"), adminRBACController.ListPromotableUsers)
			adminRBAC.POST("/admins", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.CreateAdmin)
			adminRBAC.POST("/admins/promote", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.PromoteAdmin)
			adminRBAC.PUT("/admins/:id/roles", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.UpdateAdminRoles)
			adminRBAC.PUT("/admins/:id/status", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.UpdateAdminStatus)
			adminRBAC.POST("/admins/:id/reset-password", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.ResetAdminPassword)
			adminRBAC.POST("/admins/:id/demote", rbacMiddleware.RequirePermission("permissions:edit"), adminRBACController.DemoteAdmin)

			adminCrawlerRuleController := crawlerControllers.NewAdminCrawlerRuleController()
			adminCrawlerRules := auth.Group("/admin/crawler-rules")
			adminCrawlerRules.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminCrawlerRules.GET("", rbacMiddleware.RequirePermission("crawler_rules:view"), adminCrawlerRuleController.ListRules)
			adminCrawlerRules.GET("/:id", rbacMiddleware.RequirePermission("crawler_rules:view"), adminCrawlerRuleController.GetRule)
			adminCrawlerRules.POST("", rbacMiddleware.RequirePermission("crawler_rules:edit"), adminCrawlerRuleController.CreateRule)
			adminCrawlerRules.PUT("/:id", rbacMiddleware.RequirePermission("crawler_rules:edit"), adminCrawlerRuleController.UpdateRule)
			adminCrawlerRules.DELETE("/:id", rbacMiddleware.RequirePermission("crawler_rules:edit"), adminCrawlerRuleController.DeleteRule)
			adminCrawlerRules.PATCH("/:id/status", rbacMiddleware.RequirePermission("crawler_rules:edit"), adminCrawlerRuleController.SetRuleStatus)
			adminCrawlerRules.POST("/test", rbacMiddleware.RequirePermission("crawler_rules:edit"), adminCrawlerRuleController.TestRule)
			adminCrawlerRules.GET("/:id/usages", rbacMiddleware.RequirePermission("crawler_rules:view"), adminCrawlerRuleController.GetRuleUsages)
			adminCrawlerRules.POST("/:id/clone", rbacMiddleware.RequirePermission("crawler_rules:edit"), adminCrawlerRuleController.CloneRule)
			adminWorkflowTemplateController := workflowControllers.NewAdminWorkflowTemplateController()
			adminWorkflowTemplates := auth.Group("/admin/workflow-templates")
			adminWorkflowTemplates.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminWorkflowTemplates.GET("/summary", rbacMiddleware.RequirePermission("workflow_templates:view"), adminWorkflowTemplateController.GetSummary)
			adminWorkflowTemplates.GET("", rbacMiddleware.RequirePermission("workflow_templates:view"), adminWorkflowTemplateController.ListTemplates)
			adminWorkflowTemplates.GET("/source-workflows", rbacMiddleware.RequirePermission("workflow_templates:view"), adminWorkflowTemplateController.ListSourceWorkflows)
			adminWorkflowTemplates.GET("/:id/canvas", rbacMiddleware.RequirePermission("workflow_templates.canvas:view"), adminWorkflowTemplateController.GetCanvas)
			adminWorkflowTemplates.PUT("/:id/canvas", rbacMiddleware.RequirePermission("workflow_templates.canvas:edit"), adminWorkflowTemplateController.SaveCanvas)
			adminWorkflowTemplates.GET("/:id", rbacMiddleware.RequirePermission("workflow_templates:view"), adminWorkflowTemplateController.GetTemplate)
			adminWorkflowTemplates.POST("", rbacMiddleware.RequirePermission("workflow_templates:edit"), adminWorkflowTemplateController.CreateTemplate)
			adminWorkflowTemplates.PUT("/:id", rbacMiddleware.RequirePermission("workflow_templates:edit"), adminWorkflowTemplateController.UpdateTemplate)
			adminWorkflowTemplates.POST("/:id/sync", rbacMiddleware.RequirePermission("workflow_templates.canvas:edit"), adminWorkflowTemplateController.SyncTemplate)
			adminWorkflowTemplates.DELETE("/:id", rbacMiddleware.RequirePermission("workflow_templates:edit"), adminWorkflowTemplateController.DeleteTemplate)

			adminNodeTypeController := nodeControllers.NewAdminNodeTypeController()
			adminNodeTypes := auth.Group("/admin/node-types")
			adminNodeTypes.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminNodeTypes.GET("/summary", rbacMiddleware.RequirePermission("node_types:view"), adminNodeTypeController.GetSummary)
			adminNodeTypes.GET("", rbacMiddleware.RequirePermission("node_types:view"), adminNodeTypeController.ListNodeTypes)
			adminNodeTypes.GET("/:id", rbacMiddleware.RequirePermission("node_types:view"), adminNodeTypeController.GetNodeType)
			adminNodeTypes.POST("", rbacMiddleware.RequirePermission("node_types:edit"), adminNodeTypeController.CreateNodeType)
			adminNodeTypes.PUT("/:id", rbacMiddleware.RequirePermission("node_types:edit"), adminNodeTypeController.UpdateNodeType)
			adminNodeTypes.PATCH("/:id/status", rbacMiddleware.RequirePermission("node_types:edit"), adminNodeTypeController.SetNodeTypeStatus)
			adminNodeTypes.DELETE("/:id", rbacMiddleware.RequirePermission("node_types:edit"), adminNodeTypeController.DeleteNodeType)

			adminOperationLogController := systemControllers.NewAdminOperationLogController()
			adminOperationLogs := auth.Group("/admin/operation-logs")
			adminOperationLogs.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminOperationLogs.GET("", rbacMiddleware.RequirePermission("operation_logs:view"), adminOperationLogController.List)
			adminOperationLogs.GET("/:id", rbacMiddleware.RequirePermission("operation_logs:view"), adminOperationLogController.GetByID)

			adminAppLogController := systemControllers.NewAdminAppLogController()
			adminAppLogs := auth.Group("/admin/app-logs")
			adminAppLogs.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminAppLogs.GET("", rbacMiddleware.RequirePermission("app_logs:view"), adminAppLogController.List)
			adminAppLogs.GET("/:id", rbacMiddleware.RequirePermission("app_logs:view"), adminAppLogController.GetByID)
			adminAppLogs.DELETE("/:id", rbacMiddleware.RequirePermission("app_logs:edit"), adminAppLogController.DeleteByID)
			adminAppLogs.DELETE("", rbacMiddleware.RequirePermission("app_logs:edit"), adminAppLogController.DeleteAll)

			adminNotifications := auth.Group("/admin/notifications")
			adminNotifications.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminNotifications.GET(
				"/summary",
				rbacMiddleware.RequireAnyPermission(
					"notifications.send:view",
					"notifications.jobs:view",
					"notifications.log:view",
					"notifications.analytics:view",
					"notifications.templates:view",
				),
				adminNotificationController.GetSummary,
			)
			adminNotifications.GET("", rbacMiddleware.RequirePermission("notifications.log:view"), adminNotificationController.List)
			adminNotifications.GET("/jobs", rbacMiddleware.RequirePermission("notifications.jobs:view"), adminNotificationController.ListJobs)
			adminNotifications.GET("/jobs/:id/deliveries", rbacMiddleware.RequirePermission("notifications.jobs:view"), adminNotificationController.ListDeliveries)
			adminNotifications.GET("/recipients/options", rbacMiddleware.RequireAnyPermission("notifications.send:view", "notifications.send:edit"), adminNotificationController.ListRecipientOptions)
			adminNotifications.GET(
				"/templates/options",
				rbacMiddleware.RequireAnyPermission(
					"notifications.send:view",
					"notifications.send:edit",
					"notifications.jobs:view",
					"notifications.templates:view",
					"notifications.templates:edit",
				),
				adminNotificationController.ListTemplateOptions,
			)
			adminNotifications.GET("/analytics", rbacMiddleware.RequirePermission("notifications.analytics:view"), adminNotificationController.GetAnalytics)
			adminNotifications.GET("/templates", rbacMiddleware.RequirePermission("notifications.templates:view"), adminNotificationController.ListTemplates)
			adminNotifications.POST("/templates", rbacMiddleware.RequirePermission("notifications.templates:edit"), adminNotificationController.CreateTemplate)
			adminNotifications.PUT("/templates/:id", rbacMiddleware.RequirePermission("notifications.templates:edit"), adminNotificationController.UpdateTemplate)
			adminNotifications.POST("/send", rbacMiddleware.RequirePermission("notifications.send:edit"), adminNotificationController.Send)

			adminKnowledgeController := alkaidControllers.NewAdminKnowledgeController()
			adminKnowledge := auth.Group("/admin/alkaid/knowledge")
			adminKnowledge.Use(middleware.AdminOnlyMiddleware(), middleware.AdminOperationLogMiddleware())
			adminKnowledge.GET("/summary", rbacMiddleware.RequirePermission("knowledge_base:view"), adminKnowledgeController.GetSummary)
			adminKnowledge.GET("", rbacMiddleware.RequirePermission("knowledge_base:view"), adminKnowledgeController.ListKnowledge)
			adminKnowledge.POST("", rbacMiddleware.RequirePermission("knowledge_base:edit"), adminKnowledgeController.CreateKnowledge)
			adminKnowledge.POST("/search-test", rbacMiddleware.RequirePermission("knowledge_base:edit"), adminKnowledgeController.SearchTest)
			adminKnowledge.GET("/:id", rbacMiddleware.RequirePermission("knowledge_base:view"), adminKnowledgeController.GetKnowledge)
			adminKnowledge.PUT("/:id", rbacMiddleware.RequirePermission("knowledge_base:edit"), adminKnowledgeController.UpdateKnowledge)
			adminKnowledge.DELETE("/:id", rbacMiddleware.RequirePermission("knowledge_base:edit"), adminKnowledgeController.DeleteKnowledge)
			adminKnowledge.PATCH("/:id/status", rbacMiddleware.RequirePermission("knowledge_base:edit"), adminKnowledgeController.SetKnowledgeStatus)

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
			auth.GET("/payment/orders/:orderId/status", paymentController.GetOrderStatus) // 查询订单状态
			auth.GET("/payment/orders/:orderId/detail", paymentController.GetOrderDetail) // 订单详情（含继续支付链接）
			auth.POST("/payment/orders/:orderId/cancel", paymentController.CancelOrder)   // 取消订单
			auth.DELETE("/payment/orders/:orderId", paymentController.DeleteOrder)        // 删除订单
			auth.POST("/payment/orders/:orderId/mock-pay", paymentController.MockPay)     // 模拟支付（仅开发用）

			// 站内通知 REST
			auth.GET("/notifications", notificationController.List)
			auth.GET("/notifications/unread-count", notificationController.UnreadCount)
			auth.POST("/notifications/:id/consent", notificationController.RespondConsent)
			auth.PUT("/notifications/:id/read", notificationController.MarkRead)
			auth.PUT("/notifications/read-all", notificationController.MarkAllRead)
		}
	}

	// 7. 启动服务器
	addr := fmt.Sprintf(":%s", config.ServerPort)
	log.Infof(1005, "Server starting on http://localhost%s", addr)
	log.Infof(1006, "Database migration completed")
	log.Infof(1007, "Architecture: Domain-Driven Design (DDD)")

	go taskScheduleService.StartScheduler(context.Background())
	go aiMonitoringService.Start(context.Background())

	if err := r.Run(addr); err != nil {
		log.Fatalf(1008, "Failed to start server: %v", err)
	}
}

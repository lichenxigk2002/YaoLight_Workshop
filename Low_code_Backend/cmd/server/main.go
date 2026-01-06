package main

import (
	"fmt"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/database"
	"yaolight-workshop/backend/infrastructure/middleware"
	"yaolight-workshop/backend/infrastructure/redis"
	projectControllers "yaolight-workshop/backend/modules/project/controllers"
	authControllers "yaolight-workshop/backend/modules/user/controllers"
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

	// 配置 CORS（允许跨域请求）
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "http://127.0.0.1:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
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

		// 认证相关路由（无需JWT中间件）
		authController := authControllers.NewAuthController()
		api.POST("/auth/register", authController.Register)
		api.POST("/auth/login", authController.Login)
		api.POST("/auth/send-code", authController.SendVerificationCode)
		api.POST("/auth/send-register-code", authController.SendRegisterCode)
		api.POST("/auth/email-login", authController.EmailLogin)
		api.POST("/auth/email-register", authController.EmailRegister)

		// 需要认证的路由
		auth := api.Group("")
		auth.Use(middleware.JWTAuthMiddleware())
		{
			// 用户相关路由
			auth.GET("/users/current", authController.GetCurrentUser)
			auth.PUT("/users/username", authController.UpdateUsername)

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
			auth.POST("/workflows/execute", workflowController.ExecuteWorkflow)
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

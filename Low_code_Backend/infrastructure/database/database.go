package database

import (
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	crawlerModels "yaolight-workshop/backend/modules/crawler/models"
	fileModels "yaolight-workshop/backend/modules/file/models"
	nodeModels "yaolight-workshop/backend/modules/node/models"
	notificationModels "yaolight-workshop/backend/modules/notification/models"
	projectModels "yaolight-workshop/backend/modules/project/models"
	systemModels "yaolight-workshop/backend/modules/system/models"
	taskModels "yaolight-workshop/backend/modules/task/models"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var DB *gorm.DB

// InitDatabase 初始化数据库连接并执行自动迁移
func InitDatabase() error {
	// 从配置读取数据库配置
	host := config.DBHost
	port := config.DBPort
	user := config.DBUser
	password := config.DBPassword
	dbname := config.DBName
	sslmode := config.DBSSLMode

	// 构建DSN
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbname, sslmode,
	)

	// 连接数据库
	var err error
	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// 测试连接
	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("✅ Database connected successfully")

	// 执行自动迁移
	if err := AutoMigrate(); err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	return nil
}

// AutoMigrate 自动迁移所有模型
func AutoMigrate() error {
	log.Println("🔄 Starting database migration...")

	// 按依赖顺序迁移表
	err := DB.AutoMigrate(
		// 基础表（无外键依赖）
		&userModels.User{},
		&nodeModels.NodeType{},
		&systemModels.SystemConfig{},
		&systemModels.Statistics{},

		// 依赖User的表
		&projectModels.Project{},
		&workflowModels.Workflow{},
		&crawlerModels.CrawlerRule{},
		&aiModels.AIModel{},
		&taskModels.Task{},
		&taskModels.TaskSchedule{},
		&fileModels.File{},
		&notificationModels.Notification{},
		&systemModels.OperationLog{},

		// 依赖Workflow的表
		&workflowModels.WorkflowNode{},
		&workflowModels.WorkflowVersion{},
		&workflowModels.WorkflowCommentCard{},

		// 依赖Task的表
		&taskModels.TaskNodeExecution{},
		&taskModels.TaskLog{},
	)

	if err != nil {
		return fmt.Errorf("auto migrate failed: %w", err)
	}

	log.Println("✅ Database migration completed successfully")

	// 初始化默认数据
	if err := initDefaultData(); err != nil {
		log.Printf("⚠️  Warning: failed to init default data: %v", err)
	}

	return nil
}

// initDefaultData 初始化默认数据
func initDefaultData() error {
	// 检查是否已有数据
	var count int64
	DB.Model(&userModels.User{}).Count(&count)
	if count > 0 {
		log.Println("ℹ️  Database already has data, skipping default data initialization")
		return nil
	}

	log.Println("🔄 Initializing default data...")

	// 创建默认节点类型
	defaultNodeTypes := []nodeModels.NodeType{
		{
			Name:         "开始节点",
			Category:     "start",
			Icon:         stringPtr("PlayCircleOutlined"),
			Color:        stringPtr("#52c41a"),
			IsSystem:     true,
			IsActive:     true,
			ConfigSchema: shared.JSONB{Data: map[string]interface{}{}},
		},
		{
			Name:         "爬虫节点",
			Category:     "crawler",
			Icon:         stringPtr("CloudDownloadOutlined"),
			Color:        stringPtr("#1890ff"),
			IsSystem:     true,
			IsActive:     true,
			ConfigSchema: shared.JSONB{Data: map[string]interface{}{}},
		},
		{
			Name:         "AI处理节点",
			Category:     "ai",
			Icon:         stringPtr("RobotOutlined"),
			Color:        stringPtr("#722ed1"),
			IsSystem:     true,
			IsActive:     true,
			ConfigSchema: shared.JSONB{Data: map[string]interface{}{}},
		},
		{
			Name:         "结果输出节点",
			Category:     "output",
			Icon:         stringPtr("FileTextOutlined"),
			Color:        stringPtr("#fa8c16"),
			IsSystem:     true,
			IsActive:     true,
			ConfigSchema: shared.JSONB{Data: map[string]interface{}{}},
		},
		{
			Name:         "结束节点",
			Category:     "end",
			Icon:         stringPtr("StopOutlined"),
			Color:        stringPtr("#f5222d"),
			IsSystem:     true,
			IsActive:     true,
			ConfigSchema: shared.JSONB{Data: map[string]interface{}{}},
		},
	}

	for _, nodeType := range defaultNodeTypes {
		if err := DB.Create(&nodeType).Error; err != nil {
			log.Printf("⚠️  Failed to create node type %s: %v", nodeType.Name, err)
		}
	}

	log.Println("✅ Default data initialized")
	return nil
}

// stringPtr 返回字符串指针
func stringPtr(s string) *string {
	return &s
}

// CloseDatabase 关闭数据库连接
func CloseDatabase() error {
	if DB != nil {
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		return sqlDB.Close()
	}
	return nil
}

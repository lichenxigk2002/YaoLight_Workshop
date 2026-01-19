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
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
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

	// 初始化系统预置数据
	if err := SeedNodeTypes(); err != nil {
		log.Printf("⚠️ Warning: failed to seed node types: %v", err)
	}

	if err := SeedAlkaidSpecs(); err != nil {
		log.Printf("⚠️ Warning: failed to seed alkaid specs: %v", err)
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
		&aiModels.ProviderTemplate{},

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

		// Alkaid 对话与知识库
		&alkaidModels.AlkaidSession{},
		&alkaidModels.AlkaidMessage{},
		&alkaidModels.AlkaidKnowledge{},
		&alkaidModels.AlkaidNodeSpec{},
	)

	return err
}

// SeedNodeTypes 初始化系统节点类型数据
func SeedNodeTypes() error {
	log.Println("🌱 Seeding system node types...")

	// 强制更新约束以支持新分类
	DB.Exec(`ALTER TABLE node_types DROP CONSTRAINT IF EXISTS chk_node_types_category`)
	DB.Exec(`ALTER TABLE node_types ADD CONSTRAINT chk_node_types_category CHECK (category IN ('crawler','ai','output','condition','transform','start','end','dataclean','loop','merge','delay','custom'))`)

	nodes := []nodeModels.NodeType{
		{Name: "开始节点", Category: "start", Icon: shared.Ptr("PlayCircleOutlined"), Color: shared.Ptr("#52c41a"), IsSystem: true, IsActive: true},
		{Name: "爬虫节点", Category: "crawler", Icon: shared.Ptr("CloudDownloadOutlined"), Color: shared.Ptr("#1890ff"), IsSystem: true, IsActive: true},
		{Name: "AI处理节点", Category: "ai", Icon: shared.Ptr("RobotOutlined"), Color: shared.Ptr("#722ed1"), IsSystem: true, IsActive: true},
		{Name: "结果输出节点", Category: "output", Icon: shared.Ptr("FileTextOutlined"), Color: shared.Ptr("#fa8c16"), IsSystem: true, IsActive: true},
		{Name: "结束节点", Category: "end", Icon: shared.Ptr("StopOutlined"), Color: shared.Ptr("#f5222d"), IsSystem: true, IsActive: true},
		// 新增缺失节点
		{Name: "数据清洗节点", Category: "dataclean", Icon: shared.Ptr("ClearOutlined"), Color: shared.Ptr("#52c41a"), IsSystem: true, IsActive: true},
		{Name: "条件分支节点", Category: "condition", Icon: shared.Ptr("BranchesOutlined"), Color: shared.Ptr("#faad14"), IsSystem: true, IsActive: true},
		{Name: "数据转换节点", Category: "transform", Icon: shared.Ptr("SwapOutlined"), Color: shared.Ptr("#13c2c2"), IsSystem: true, IsActive: true},
		{Name: "循环处理节点", Category: "loop", Icon: shared.Ptr("ReloadOutlined"), Color: shared.Ptr("#eb2f96"), IsSystem: true, IsActive: true},
		{Name: "合并分支节点", Category: "merge", Icon: shared.Ptr("MergeCellsOutlined"), Color: shared.Ptr("#2f54eb"), IsSystem: true, IsActive: true},
		{Name: "延迟等待节点", Category: "delay", Icon: shared.Ptr("ClockCircleOutlined"), Color: shared.Ptr("#fa8c16"), IsSystem: true, IsActive: true},
	}

	for _, node := range nodes {
		var existing nodeModels.NodeType
		err := DB.Where("name = ?", node.Name).First(&existing).Error
		if err != nil {
			// 如果不存在则创建
			if err == gorm.ErrRecordNotFound {
				if err := DB.Create(&node).Error; err != nil {
					return fmt.Errorf("failed to create node type %s: %w", node.Name, err)
				}
				log.Printf("  + Created node type: %s", node.Name)
			} else {
				return fmt.Errorf("failed to check node type %s: %w", node.Name, err)
			}
		} else {
			// 如果已存在，更新关键字段确保与前端同步
			DB.Model(&existing).Updates(map[string]interface{}{
				"category": node.Category,
				"icon":     node.Icon,
				"color":    node.Color,
			})
		}
	}

	log.Println("✅ Node types seeding completed")
	return nil
}

// SeedAlkaidSpecs 初始化瑶光星 AI 专用规格知识
func SeedAlkaidSpecs() error {
	log.Println("🌱 Seeding Alkaid node specs...")

	specs := []alkaidModels.AlkaidNodeSpec{
		{
			NodeTypeName: "爬虫节点",
			InputSpec:    shared.JSONB{Data: map[string]interface{}{"url": "目标网页地址", "selectors": "CSS选择器列表"}},
			OutputSpec:   shared.JSONB{Data: map[string]interface{}{"data": "抓取到的网页文本或结构化数据"}},
			Constraints:  shared.JSONB{Data: []interface{}{"URL必须以 http 或 https 开头", "输出结果常用于后续 AI 处理"}},
		},
		{
			NodeTypeName: "AI处理节点",
			InputSpec:    shared.JSONB{Data: map[string]interface{}{"prompt": "指令内容", "inputData": "引用的上游变量"}},
			OutputSpec:   shared.JSONB{Data: map[string]interface{}{"result": "AI 生成的文本内容"}},
			Constraints:  shared.JSONB{Data: []interface{}{"需要配置有效的 API Key", "支持上下文引用"}},
		},
	}

	for _, spec := range specs {
		var existing alkaidModels.AlkaidNodeSpec
		err := DB.Where("node_type_name = ?", spec.NodeTypeName).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			DB.Create(&spec)
		} else {
			DB.Model(&existing).Updates(spec)
		}
	}

	log.Println("✅ Alkaid specs seeding completed")
	return nil
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

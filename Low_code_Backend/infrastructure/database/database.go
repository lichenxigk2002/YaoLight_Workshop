package database

import (
	"errors"
	"fmt"
	"log"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"yaolight-workshop/backend/infrastructure/config"
	"yaolight-workshop/backend/infrastructure/shared"
	aiModels "yaolight-workshop/backend/modules/ai/models"
	aiRepos "yaolight-workshop/backend/modules/ai/repositories"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	artifactModels "yaolight-workshop/backend/modules/artifact/models"
	crawlerModels "yaolight-workshop/backend/modules/crawler/models"
	fileModels "yaolight-workshop/backend/modules/file/models"
	nodeModels "yaolight-workshop/backend/modules/node/models"
	notificationModels "yaolight-workshop/backend/modules/notification/models"
	paymentModels "yaolight-workshop/backend/modules/payment/models"
	projectModels "yaolight-workshop/backend/modules/project/models"
	systemModels "yaolight-workshop/backend/modules/system/models"
	taskModels "yaolight-workshop/backend/modules/task/models"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

func init() {
	// 确保 user_oauth_bindings 在 AutoMigrate 中（与 009_add_user_oauth_bindings.sql 一致）
}

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

	// 在 AutoMigrate 之前修正 user_oauth_bindings 列名（o_auth_id -> oauth_id），避免 GORM 再 ADD 一列导致冲突
	EnsureUserOAuthBindingsColumnName()

	// 执行自动迁移
	if err := AutoMigrate(); err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	EnsureAIModelsProviderConstraint()
	EnsureUsersOAuthColumns()
	EnsureUsersUserNo()

	// 初始化系统预置数据
	if err := SeedNodeTypes(); err != nil {
		log.Printf("⚠️ Warning: failed to seed node types: %v", err)
	}

	if err := SeedAlkaidSpecs(); err != nil {
		log.Printf("⚠️ Warning: failed to seed alkaid specs: %v", err)
	}

	// 初始化输出节点新能力相关知识（确保瑶光星能检索到 PDF/图表/Artifacts/导出API 等）
	if err := SeedAlkaidOutputNodeKnowledge(); err != nil {
		log.Printf("⚠️ Warning: failed to seed output node knowledge: %v", err)
	}

	// 初始化模型计费配置
	if err := SeedModelPricingConfigs(); err != nil {
		log.Printf("⚠️ Warning: failed to seed model pricing configs: %v", err)
	}

	// 初始化供应商模板（如果表为空或缺少 provider，自动补齐）
	if err := SeedProviderTemplates(); err != nil {
		log.Printf("⚠️ Warning: failed to seed provider templates: %v", err)
	}

	// 初始化模型能力配置（基于计费表生成默认行）
	if err := SeedModelCapabilityConfigs(); err != nil {
		log.Printf("⚠️ Warning: failed to seed model capability configs: %v", err)
	}

	return nil
}

// EnsureUsersOAuthColumns 确保 users 表有 OAuth 相关列（兼容已有库）
func EnsureUsersOAuthColumns() {
	// PostgreSQL: 列不存在时添加
	DB.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oauth_provider') THEN
				ALTER TABLE users ADD COLUMN oauth_provider VARCHAR(20);
				CREATE INDEX IF NOT EXISTS idx_users_oauth_provider ON users(oauth_provider);
			END IF;
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'oauth_id') THEN
				ALTER TABLE users ADD COLUMN oauth_id VARCHAR(100);
				CREATE INDEX IF NOT EXISTS idx_users_oauth_id ON users(oauth_id);
			END IF;
		END $$;
	`)
}

// EnsureUserOAuthBindingsColumnName 将 user_oauth_bindings 表中 GORM 自动生成的 o_auth_id 列重命名为 oauth_id
func EnsureUserOAuthBindingsColumnName() {
	DB.Exec(`
		DO $$
		BEGIN
			IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_oauth_bindings' AND column_name = 'o_auth_id')
			   AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'user_oauth_bindings' AND column_name = 'oauth_id') THEN
				ALTER TABLE user_oauth_bindings RENAME COLUMN o_auth_id TO oauth_id;
			END IF;
		END $$;
	`)
}

func EnsureAIModelsProviderConstraint() {
	DB.Exec(`ALTER TABLE ai_models DROP CONSTRAINT IF EXISTS chk_ai_models_provider`)
	DB.Exec(`ALTER TABLE ai_models DROP CONSTRAINT IF EXISTS ai_models_provider_check`)
	DB.Exec(`ALTER TABLE ai_models ADD CONSTRAINT chk_ai_models_provider CHECK (provider IN ('openai','azure','anthropic','google','custom','deepseek','doubao','qwen','qianwen','spark','hunyuan','zhipuai','gemini','gpt','grok'))`)

	// 修复 ai_models 表的唯一约束：删除旧的全局唯一索引，创建按用户唯一的复合索引
	// 删除旧的唯一索引（如果存在）
	DB.Exec(`DROP INDEX IF EXISTS idx_ai_models_name`)
	DB.Exec(`DROP INDEX IF EXISTS idx_name_user`)

	// 创建新的复合唯一索引（name + created_by），只对未删除的记录应用唯一约束
	// 使用部分索引，允许删除后重新创建同名模型
	DB.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_name_user 
		ON ai_models (name, created_by) 
		WHERE created_by IS NOT NULL AND deleted_at IS NULL
	`)
}

// EnsureUsersUserNo 为 users 表添加 user_no 列并回填；新用户由业务层生成随机编号
func EnsureUsersUserNo() {
	// 1) 若不存在则添加列（可为空，便于回填）
	DB.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_no') THEN
				ALTER TABLE users ADD COLUMN user_no BIGINT;
			END IF;
		END $$;
	`)
	// 2) 回填：未设置过的用 10000000+id，保证唯一
	DB.Exec(`UPDATE users SET user_no = 10000000 + id WHERE user_no IS NULL OR user_no = 0`)
	// 3) 设为非空并建唯一索引
	DB.Exec(`ALTER TABLE users ALTER COLUMN user_no SET NOT NULL`)
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_no ON users(user_no)`)
}

// AutoMigrate 自动迁移所有模型
func AutoMigrate() error {
	log.Println("🔄 Starting database migration...")

	// 按依赖顺序迁移表
	err := DB.AutoMigrate(
		// 基础表（无外键依赖）
		&userModels.User{},
		&userModels.UserOAuthBinding{},
		&userModels.UserAvatarHistory{},
		&userModels.UserInviteCode{},
		&userModels.UserInvitation{},
		&userModels.TokenTransaction{},
		&nodeModels.NodeType{},
		&systemModels.SystemConfig{},
		&systemModels.Statistics{},
		&paymentModels.Order{},         // 订单表
		&aiModels.ProviderTemplate{},   // 供应商模板（用于前端展示/创建模型时校验）
		&aiModels.ModelPricingConfig{}, // 模型计费配置（用于 supportedModels + 星尘计费）

		// AI 模型能力配置（按 provider+model_name）
		&aiModels.ModelCapabilityConfig{},

		// 依赖User的表
		&projectModels.Project{},
		&workflowModels.Workflow{},
		&crawlerModels.CrawlerRule{},
		&aiModels.AIModel{},
		&taskModels.Task{},
		&taskModels.TaskSchedule{},
		&fileModels.File{},
		&artifactModels.Artifact{},
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

// SeedProviderTemplates 初始化供应商模板数据：
// - 若模板表为空，或新增了 pricing_configs 的 provider，则自动补齐模板行
// - 避免“只加模型但前端无供应商模板可展示”的问题
func SeedProviderTemplates() error {
	// 确保表存在（兼容首次启动）
	if err := DB.AutoMigrate(&aiModels.ProviderTemplate{}); err != nil {
		return err
	}

	// 从计费表聚合 provider（你“只加模型”通常是加这张表）
	pricingRepo := aiRepos.NewPricingConfigRepository(DB)
	pricing, err := pricingRepo.FindAll()
	if err != nil {
		return err
	}

	providerSet := map[string]struct{}{}
	for _, p := range pricing {
		if p.Provider == "" {
			continue
		}
		providerSet[strings.ToLower(p.Provider)] = struct{}{}
	}

	// 内置默认信息（用于友好显示名与默认 BaseURL）
	type providerSeed struct {
		name        string
		description string
		baseURL     string
		defaultCfg  map[string]interface{}
	}
	defaults := map[string]providerSeed{
		"deepseek": {name: "DeepSeek", description: "DeepSeek AI模型", baseURL: "https://api.deepseek.com", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"doubao":   {name: "豆包", description: "字节跳动豆包AI模型", baseURL: "https://ark.cn-beijing.volces.com/api/v3", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"qwen":     {name: "通义千问", description: "阿里云通义千问AI模型（OpenAI兼容模式）", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"zhipuai":  {name: "智谱AI GLM", description: "智谱AI GLM系列模型", baseURL: "https://open.bigmodel.cn/api/paas/v4", defaultCfg: map[string]interface{}{"temperature": 1.0, "maxTokens": 1024}},
		"spark":    {name: "讯飞星火", description: "讯飞星火（OpenAI兼容接口）", baseURL: "https://spark-api-open.xf-yun.com/v2", defaultCfg: map[string]interface{}{"temperature": 1.2, "maxTokens": 65535}},
		"hunyuan":  {name: "腾讯混元", description: "腾讯混元（OpenAI兼容接口）", baseURL: "https://api.hunyuan.cloud.tencent.com/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"gpt":      {name: "GPT", description: "OpenAI GPT 系列模型（通过 OpenRouter 访问）", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"claude":   {name: "Claude", description: "Anthropic Claude 系列模型（通过 OpenRouter 访问）", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"gemini":   {name: "Google Gemini", description: "Google Gemini 系列模型（通过 OpenRouter 访问）", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"grok":     {name: "Grok", description: "xAI Grok 系列模型（通过 OpenRouter 访问）", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"openai":   {name: "OpenAI", description: "OpenAI 官方接口", baseURL: "https://api.openai.com/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
	}

	// 同时补齐默认 providers（即使 pricing 没有，也能在前端看到可配置入口）
	for p := range defaults {
		providerSet[p] = struct{}{}
	}

	// 对每个 provider，若模板不存在则创建
	for provider := range providerSet {
		var existing aiModels.ProviderTemplate
		q := DB.Where("provider = ?", provider).First(&existing)
		if q.Error == nil {
			continue
		}
		if q.Error != nil && !errors.Is(q.Error, gorm.ErrRecordNotFound) {
			return q.Error
		}

		def, ok := defaults[provider]
		if !ok {
			// 未知 provider：至少保证前端能展示/可配置
			def = providerSeed{name: provider, description: "", baseURL: "", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}}
		}

		var descPtr *string
		if def.description != "" {
			descPtr = shared.Ptr(def.description)
		}
		var basePtr *string
		if def.baseURL != "" {
			basePtr = shared.Ptr(def.baseURL)
		}

		row := &aiModels.ProviderTemplate{
			Provider:        provider,
			Name:            def.name,
			Description:     descPtr,
			DefaultBaseURL:  basePtr,
			SupportedModels: shared.JSONB{Data: []interface{}{}},
			ConfigSchema:    shared.JSONB{Data: map[string]interface{}{}},
			DefaultConfig:   shared.JSONB{Data: def.defaultCfg},
			IsActive:        true,
		}

		if err := DB.Create(row).Error; err != nil {
			return err
		}
	}

	return nil
}

// SeedNodeTypes 初始化系统节点类型数据
func SeedNodeTypes() error {
	// log.Println("🌱 Seeding system node types...") // 注释掉详细日志

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
				// log.Printf("  + Created node type: %s", node.Name) // 注释掉详细日志，减少输出
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

	// log.Println("✅ Node types seeding completed") // 注释掉详细日志
	return nil
}

// SeedAlkaidSpecs 初始化瑶光星 AI 专用规格知识
func SeedAlkaidSpecs() error {
	// log.Println("🌱 Seeding Alkaid node specs...") // 注释掉详细日志

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

	// log.Println("✅ Alkaid specs seeding completed") // 注释掉详细日志
	return nil
}

// SeedModelPricingConfigs 初始化模型计费配置数据
// 从AI_MODEL_PRICING.md文档中的信息初始化数据库
func SeedModelPricingConfigs() error {
	// log.Println("🌱 Seeding model pricing configs...") // 注释掉详细日志

	pricingRepo := aiRepos.NewPricingConfigRepository(DB)

	configs := []*aiModels.ModelPricingConfig{
		// ========================================
		// Google Gemini 系列
		// ========================================
		{
			Provider:    "gemini",
			ModelName:   "google/gemini-3-pro-preview",
			PricingType: "multi_type",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("Gemini 3 Flash Preview - 多类型计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":            0.50,
					"output_price_per_million":           3.00,
					"audio_price_per_million":            1.00,
					"cache_read_price_per_million":       0.05,
					"audio_cache_read_price_per_million": 0.10,
				},
			},
		},

		// ========================================
		// DeepSeek 系列
		// ========================================
		{
			Provider:    "deepseek",
			ModelName:   "deepseek-chat",
			PricingType: "separate", // 分离计费，但需要考虑缓存命中/未命中
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("DeepSeek Chat - 分离计费，支持缓存机制"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million_cache_hit":  0.028,
					"input_price_per_million_cache_miss": 0.28,
					"output_price_per_million":           0.42,
				},
			},
		},
		{
			Provider:    "deepseek",
			ModelName:   "deepseek-reasoner",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("DeepSeek Reasoner - 分离计费，支持缓存机制"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million_cache_hit":  0.028,
					"input_price_per_million_cache_miss": 0.28,
					"output_price_per_million":           0.42,
				},
			},
		},

		// ========================================
		// 豆包 (Doubao) 系列
		// ========================================
		{
			Provider:    "doubao",
			ModelName:   "doubao-seed-1-6-251015",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("豆包 Seed-1.6 - 分离计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.8, // 元/百万Token
					"output_price_per_million": 2.0, // 元/百万Token
				},
			},
		},
		{
			Provider:    "doubao",
			ModelName:   "doubao-seed-1-8-251228",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("豆包 Seed-1.8 - 分离计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.8, // 元/百万Token
					"output_price_per_million": 2.0, // 元/百万Token
				},
			},
		},
		{
			Provider:    "doubao",
			ModelName:   "doubao-seedream-4-5-251128",
			PricingType: "per_image",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("豆包 Seedream-4.5 - 按张计费（图片生成）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"price_per_image": 0.50, // 元/张（需要根据实际价格调整）
				},
			},
		},

		// ========================================
		// Grok 系列
		// ========================================
		{
			Provider:    "grok",
			ModelName:   "x-ai/grok-4.1-fast",
			PricingType: "segmented",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("Grok 4.1 Fast - 分段计费（基于上下文长度）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"segments": []map[string]interface{}{
						{
							"context_length_limit":         128000.0,
							"input_price_per_million":      0.20,
							"output_price_per_million":     0.50,
							"cache_read_price_per_million": 0.05,
						},
						{
							"context_length_limit":         nil, // null表示无上限
							"input_price_per_million":      0.40,
							"output_price_per_million":     1.00,
							"cache_read_price_per_million": 0.05,
						},
					},
				},
			},
		},
		{
			Provider:    "grok",
			ModelName:   "x-ai/grok-4",
			PricingType: "segmented",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("Grok 4 - 分段计费（基于上下文长度，256K上下文窗口）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"segments": []map[string]interface{}{
						{
							"context_length_limit":         128000.0, // ≤128K tokens
							"input_price_per_million":      3.0,
							"output_price_per_million":     15.0,
							"cache_read_price_per_million": 0.75,
						},
						{
							"context_length_limit":         nil, // >128K tokens (最大256K)
							"input_price_per_million":      6.0,
							"output_price_per_million":     30.0,
							"cache_read_price_per_million": 0.75,
						},
					},
				},
			},
		},

		// ========================================
		// Claude 系列 (via OpenRouter)
		// ========================================
		// Claude Sonnet 4.5 - 分段计费（基于上下文长度）
		{
			Provider:    "claude",
			ModelName:   "anthropic/claude-sonnet-4.5",
			PricingType: "segmented",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("Claude Sonnet 4.5 - 分段计费（基于上下文长度，≤200K vs >200K）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"segments": []map[string]interface{}{
						{
							"context_length_limit":          200000.0, // ≤200K tokens
							"input_price_per_million":       3.0,
							"output_price_per_million":      15.0,
							"cache_read_price_per_million":  0.30,
							"cache_write_price_per_million": 3.75,
						},
						{
							"context_length_limit":          nil, // >200K tokens (无上限)
							"input_price_per_million":       6.0,
							"output_price_per_million":      22.50,
							"cache_read_price_per_million":  0.60,
							"cache_write_price_per_million": 7.50,
						},
					},
				},
			},
		},
		// Claude Opus 4.5 - 分离计费（200K上下文，统一价格）
		{
			Provider:    "claude",
			ModelName:   "anthropic/claude-opus-4.5",
			PricingType: "multi_type", // 支持输入、输出、缓存读取、缓存写入
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("Claude Opus 4.5 - 分离计费（200K上下文，支持缓存机制）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":       5.0,
					"output_price_per_million":      25.0,
					"cache_read_price_per_million":  0.50,
					"cache_write_price_per_million": 6.25,
				},
			},
		},
		// Claude Haiku 4.5 - 分离计费（200K上下文，统一价格）
		{
			Provider:    "claude",
			ModelName:   "anthropic/claude-haiku-4.5",
			PricingType: "multi_type", // 支持输入、输出、缓存读取、缓存写入
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("Claude Haiku 4.5 - 分离计费（200K上下文，支持缓存机制）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":       1.0,
					"output_price_per_million":      5.0,
					"cache_read_price_per_million":  0.10,
					"cache_write_price_per_million": 1.25,
				},
			},
		},

		// ========================================
		// 通义千问 (Qwen) 系列
		// ========================================
		{
			Provider:    "qwen",
			ModelName:   "qwen-plus",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-plus - 分离计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.004,
					"output_price_per_million": 0.012,
				},
			},
		},
		// qwen3-max 系列（分段计费）
		{
			Provider:    "qwen",
			ModelName:   "qwen3-max",
			PricingType: "segmented",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen3-max - 分段计费，支持Batch和上下文缓存"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"segments": []map[string]interface{}{
						{
							"context_length_limit":     32000.0,
							"input_price_per_million":  0.0032,
							"output_price_per_million": 0.0128,
						},
						{
							"context_length_limit":     128000.0,
							"input_price_per_million":  0.0064,
							"output_price_per_million": 0.0256,
						},
						{
							"context_length_limit":     nil,
							"input_price_per_million":  0.0096,
							"output_price_per_million": 0.0384,
						},
					},
					"supports_batch":         true,
					"batch_discount":         0.5, // 50%折扣
					"supports_context_cache": true,
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen3-max-2025-09-23",
			PricingType: "segmented",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen3-max-2025-09-23 - 分段计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"segments": []map[string]interface{}{
						{
							"context_length_limit":     32000.0,
							"input_price_per_million":  0.006,
							"output_price_per_million": 0.024,
						},
						{
							"context_length_limit":     128000.0,
							"input_price_per_million":  0.01,
							"output_price_per_million": 0.04,
						},
						{
							"context_length_limit":     nil,
							"input_price_per_million":  0.015,
							"output_price_per_million": 0.06,
						},
					},
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen3-max-preview",
			PricingType: "segmented",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen3-max-preview - 分段计费，支持上下文缓存"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"segments": []map[string]interface{}{
						{
							"context_length_limit":     32000.0,
							"input_price_per_million":  0.006,
							"output_price_per_million": 0.024,
						},
						{
							"context_length_limit":     128000.0,
							"input_price_per_million":  0.01,
							"output_price_per_million": 0.04,
						},
						{
							"context_length_limit":     nil,
							"input_price_per_million":  0.015,
							"output_price_per_million": 0.06,
						},
					},
					"supports_context_cache": true,
				},
			},
		},

		// qwen-max 系列（统一价格）
		{
			Provider:    "qwen",
			ModelName:   "qwen-max",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-max - 分离计费，支持Batch调用"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.0024,
					"output_price_per_million": 0.0096,
					"supports_batch":           true,
					"batch_discount":           0.5, // 50%折扣
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen-max-latest",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-max-latest - 分离计费，支持Batch调用"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.0024,
					"output_price_per_million": 0.0096,
					"supports_batch":           true,
					"batch_discount":           0.5,
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen-max-2025-01-25",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-max-2025-01-25 - 分离计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.0024,
					"output_price_per_million": 0.0096,
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen-max-2024-09-19",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-max-2024-09-19 - 分离计费（旧版本）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.02,
					"output_price_per_million": 0.06,
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen-max-2024-04-28",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-max-2024-04-28 - 分离计费（旧版本）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.04,
					"output_price_per_million": 0.12,
				},
			},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen-max-2024-04-03",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("通义千问 qwen-max-2024-04-03 - 分离计费（旧版本）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  0.04,
					"output_price_per_million": 0.12,
				},
			},
		},

		// ========================================
		// 智谱AI GLM 系列
		// ========================================
		// GLM-4.7（分段计费，基于输入和输出长度，单位是万Token）
		{
			Provider:    "zhipuai",
			ModelName:   "glm-4.7",
			PricingType: "segmented", // 需要特殊处理，因为是基于万Token分段
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("智谱AI GLM-4.7 - 分段计费（基于输入和输出长度，单位：万Token）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"length_unit": "10k_tokens", // 长度单位：万Token
					"segments": []map[string]interface{}{
						{
							"input_length_limit_10k":        32.0,
							"output_length_limit_10k":       0.2,
							"input_price_per_million":       2.0,
							"output_price_per_million":      8.0,
							"free_input_price_per_million":  0.4,
							"free_output_price_per_million": 3.0,
						},
						{
							"input_length_limit_10k":        32.0,
							"output_length_limit_10k":       nil, // 0.2+
							"input_price_per_million":       3.0,
							"output_price_per_million":      14.0,
							"free_input_price_per_million":  0.6,
							"free_output_price_per_million": 5.0,
						},
						{
							"input_length_limit_10k":        nil, // 32-200
							"output_length_limit_10k":       nil,
							"input_price_per_million":       4.0,
							"output_price_per_million":      16.0,
							"free_input_price_per_million":  0.8,
							"free_output_price_per_million": 6.0,
						},
					},
					"free_period_days": 30, // 限时免费期：30-50天
				},
			},
		},
		{
			Provider:    "zhipuai",
			ModelName:   "glm-4.6",
			PricingType: "segmented",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("智谱AI GLM-4.6 - 分段计费（与GLM-4.7相同）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"length_unit": "10k_tokens",
					"segments": []map[string]interface{}{
						{
							"input_length_limit_10k":        32.0,
							"output_length_limit_10k":       0.2,
							"input_price_per_million":       2.0,
							"output_price_per_million":      8.0,
							"free_input_price_per_million":  0.4,
							"free_output_price_per_million": 3.0,
						},
						{
							"input_length_limit_10k":        32.0,
							"output_length_limit_10k":       nil,
							"input_price_per_million":       3.0,
							"output_price_per_million":      14.0,
							"free_input_price_per_million":  0.6,
							"free_output_price_per_million": 5.0,
						},
						{
							"input_length_limit_10k":        nil,
							"output_length_limit_10k":       nil,
							"input_price_per_million":       4.0,
							"output_price_per_million":      16.0,
							"free_input_price_per_million":  0.8,
							"free_output_price_per_million": 6.0,
						},
					},
					"free_period_days": 30,
				},
			},
		},
		{
			Provider:    "zhipuai",
			ModelName:   "glm-4.5-air",
			PricingType: "segmented",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("智谱AI GLM-4.5-Air - 分段计费（价格更优惠）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"length_unit": "10k_tokens",
					"segments": []map[string]interface{}{
						{
							"input_length_limit_10k":        32.0,
							"output_length_limit_10k":       0.2,
							"input_price_per_million":       0.8,
							"output_price_per_million":      2.0,
							"free_input_price_per_million":  0.16,
							"free_output_price_per_million": 0.4,
						},
						{
							"input_length_limit_10k":        32.0,
							"output_length_limit_10k":       nil,
							"input_price_per_million":       0.8,
							"output_price_per_million":      6.0,
							"free_input_price_per_million":  0.16,
							"free_output_price_per_million": 1.2,
						},
						{
							"input_length_limit_10k":        128.0,
							"output_length_limit_10k":       nil,
							"input_price_per_million":       1.2,
							"output_price_per_million":      8.0,
							"free_input_price_per_million":  0.24,
							"free_output_price_per_million": 1.6,
						},
					},
					"free_period_days": 30,
				},
			},
		},
		{
			Provider:    "zhipuai",
			ModelName:   "glm-4.7-flashx",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("智谱AI GLM-4.7-FlashX - 分离计费（统一价格）"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":       0.5,
					"output_price_per_million":      3.0,
					"free_input_price_per_million":  0.1,
					"free_output_price_per_million": 1.0,
					"free_period_days":              30, // 30-40天
				},
			},
		},
		{
			Provider:    "zhipuai",
			ModelName:   "glm-4.7-flash",
			PricingType: "unified", // 免费模型，使用统一计费但价格为0
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("智谱AI GLM-4.7-Flash - 完全免费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"price_per_million_tokens": 0.0, // 免费
				},
			},
		},

		// ========================================
		// 讯飞星火 (Spark) 系列
		// ========================================
		{
			Provider:    "spark",
			ModelName:   "spark-x1.5",
			PricingType: "unified",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("讯飞星火 Spark X1.5 - 统一计费，2-3元/百万Token"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"price_per_million_tokens": 2.5, // 使用中位数，可根据实际情况调整
					"price_range": map[string]float64{
						"min": 2.0,
						"max": 3.0,
					},
				},
			},
		},

		// ========================================
		// 腾讯混元 (Hunyuan) 系列
		// ========================================

		// ========================================
		// OpenAI GPT 系列
		// ========================================
		// GPT-4o（分离计费，支持缓存）
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-4o",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-4o - 分离计费，支持缓存读取"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":      2.50,
					"output_price_per_million":     10.0,
					"cache_read_price_per_million": 1.25,
				},
			},
		},
		// GPT-4o-mini（分离计费，支持缓存）
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-4o-mini",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-4o-mini - 分离计费，支持缓存读取"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":      0.15,
					"output_price_per_million":     0.60,
					"cache_read_price_per_million": 0.075,
				},
			},
		},
		// GPT-5.1（分离计费，支持缓存）
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-5.1",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-5.1 - 分离计费，支持缓存读取"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":      1.25,
					"output_price_per_million":     10.0,
					"cache_read_price_per_million": 0.125,
				},
			},
		},
		// GPT-5.2（分离计费，支持缓存）
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-5.2",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-5.2 - 分离计费，支持缓存读取"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":      1.75,
					"output_price_per_million":     14.0,
					"cache_read_price_per_million": 0.175,
				},
			},
		},
		// GPT-5.2 Pro（分离计费）
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-5.2-pro",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-5.2 Pro - 分离计费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"input_price_per_million":  21.0,
					"output_price_per_million": 168.0,
					// 注意：GPT-5.2 Pro 未显示缓存读取价格，暂时不配置
				},
			},
		},
		// GPT-OSS 系列（免费模型）
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-oss-20b",
			PricingType: "unified",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-OSS-20B - 完全免费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"price_per_million_tokens": 0.0, // 免费
				},
			},
		},
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-oss-120b",
			PricingType: "unified",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("OpenAI GPT-OSS-120B - 完全免费"),
			PricingData: shared.JSONB{
				Data: map[string]interface{}{
					"price_per_million_tokens": 0.0, // 免费
				},
			},
		},
	}

	// 批量创建或更新配置
	successCount := 0
	failCount := 0
	for _, config := range configs {
		if err := pricingRepo.CreateOrUpdate(config); err != nil {
			log.Printf("⚠️ Failed to seed pricing config for provider=%s, modelName=%s: %v",
				config.Provider, config.ModelName, err)
			failCount++
		} else {
			// log.Printf("✅ Seeded pricing config: provider=%s, modelName=%s, type=%s",
			// 	config.Provider, config.ModelName, config.PricingType) // 注释掉详细日志，减少输出
			successCount++
		}
	}

	if failCount > 0 {
		log.Printf("⚠️ Model pricing configs seeding: %d succeeded, %d failed", successCount, failCount)
	}

	log.Printf("✅ Model pricing configs seeding completed (%d configs)", successCount)
	return nil
}

// SeedModelCapabilityConfigs 根据计费表为每个 (provider, model_name) 生成默认能力配置
func SeedModelCapabilityConfigs() error {
	capRepo := aiRepos.NewCapabilityConfigRepository(DB)
	pricingRepo := aiRepos.NewPricingConfigRepository(DB)
	configs, err := pricingRepo.FindAll()
	if err != nil {
		return err
	}
	count := 0
	for _, p := range configs {
		c := defaultCapabilityForModel(p.Provider, p.ModelName)
		if err := capRepo.CreateOrUpdate(c); err != nil {
			log.Printf("⚠️ Failed to seed capability config provider=%s model=%s: %v", p.Provider, p.ModelName, err)
			continue
		}
		count++
	}
	log.Printf("✅ Model capability configs seeding completed (%d configs)", count)
	return nil
}

// defaultCapabilityForModel 返回某模型的默认能力配置（可按 provider/model 覆盖）
func defaultCapabilityForModel(provider, modelName string) *aiModels.ModelCapabilityConfig {
	c := &aiModels.ModelCapabilityConfig{
		Provider:                provider,
		ModelName:               modelName,
		SupportTemperature:      true,
		SupportMaxTokens:        true,
		SupportTopP:             true,
		SupportStream:           false,
		SupportThinking:         false,
		SupportThinkingLevel:    false,
		SupportEnableThinking:   false,
		SupportFrequencyPenalty: false,
		SupportPresencePenalty:  false,
		SupportStopSequences:    false,
		SupportVision:           false,
		SupportImageGeneration:  false,
		MaxTokensLimit:          32768,
		IsActive:                true,
	}
	switch provider {
	case "deepseek":
		c.SupportStream = true
		c.SupportThinking = true
		if modelName == "deepseek-reasoner" {
			c.MaxTokensLimit = 65536
		} else {
			c.MaxTokensLimit = 8192
		}
	case "doubao":
		c.SupportStream = true
		c.SupportThinkingLevel = true
		c.MaxTokensLimit = 32768
	case "qwen":
		c.SupportStream = true
		c.SupportEnableThinking = true
		c.MaxTokensLimit = 32768
	case "zhipuai":
		c.SupportStream = true
		c.SupportThinking = true
		c.MaxTokensLimit = 131072
	case "spark":
		c.SupportStream = true
		c.MaxTokensLimit = 65535
	case "hunyuan":
		c.SupportStream = true
		c.MaxTokensLimit = 32768
	case "claude", "gpt", "gemini", "grok":
		c.SupportFrequencyPenalty = true
		c.SupportPresencePenalty = true
		c.SupportStream = true
		c.MaxTokensLimit = 131072
	}
	return c
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

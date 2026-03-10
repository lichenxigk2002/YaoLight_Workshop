package database

import (
	"crypto/md5"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
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
	billingModels "yaolight-workshop/backend/modules/billing/models"
	notificationModels "yaolight-workshop/backend/modules/notification/models"
	paymentModels "yaolight-workshop/backend/modules/payment/models"
	projectModels "yaolight-workshop/backend/modules/project/models"
	systemModels "yaolight-workshop/backend/modules/system/models"
	taskModels "yaolight-workshop/backend/modules/task/models"
	userModels "yaolight-workshop/backend/modules/user/models"
	workflowModels "yaolight-workshop/backend/modules/workflow/models"
)

var DB *gorm.DB

func InitDatabase() error {
	dsn := fmt.Sprintf(
		"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		config.DBHost,
		config.DBPort,
		config.DBUser,
		config.DBPassword,
		config.DBName,
		config.DBSSLMode,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	DB = db

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("Database connected successfully")

	EnsureUserOAuthBindingsColumnName()

	if err := AutoMigrate(); err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	EnsureAIModelsProviderConstraint()
	EnsureUsersOAuthColumns()
	EnsureUsersUserNo()

	seeders := []struct {
		name string
		fn   func() error
	}{
		{name: "bootstrap admin", fn: SeedBootstrapAdmin},
		{name: "node types", fn: SeedNodeTypes},
		{name: "alkaid specs", fn: SeedAlkaidSpecs},
		{name: "alkaid output knowledge", fn: SeedAlkaidOutputNodeKnowledge},
		{name: "model pricing configs", fn: SeedModelPricingConfigs},
		{name: "provider templates", fn: SeedProviderTemplates},
		{name: "model capability configs", fn: SeedModelCapabilityConfigs},
		{name: "managed ai models", fn: SeedManagedAIModels},
		{name: "pricing rules", fn: SeedPricingRulesFromConfigs},
	}

	for _, seeder := range seeders {
		if err := seeder.fn(); err != nil {
			log.Printf("Warning: failed to seed %s: %v", seeder.name, err)
		}
	}

	return nil
}

func EnsureUsersOAuthColumns() {
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

func EnsureUserOAuthBindingsColumnName() {
	DB.Exec(`
		DO $$
		BEGIN
			IF EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
					AND table_name = 'user_oauth_bindings'
					AND column_name = 'o_auth_id'
			) AND NOT EXISTS (
				SELECT 1
				FROM information_schema.columns
				WHERE table_schema = 'public'
					AND table_name = 'user_oauth_bindings'
					AND column_name = 'oauth_id'
			) THEN
				ALTER TABLE user_oauth_bindings RENAME COLUMN o_auth_id TO oauth_id;
			END IF;
		END $$;
	`)
}

func EnsureAIModelsProviderConstraint() {
	DB.Exec(`ALTER TABLE ai_models DROP CONSTRAINT IF EXISTS chk_ai_models_provider`)
	DB.Exec(`ALTER TABLE ai_models DROP CONSTRAINT IF EXISTS ai_models_provider_check`)
	DB.Exec(`ALTER TABLE ai_models ADD CONSTRAINT chk_ai_models_provider CHECK (provider IN ('openai','azure','anthropic','google','custom','deepseek','doubao','qwen','qianwen','spark','hunyuan','zhipuai','gemini','gpt','grok','claude'))`)
	DB.Exec(`DROP INDEX IF EXISTS idx_ai_models_name`)
	DB.Exec(`DROP INDEX IF EXISTS idx_name_user`)
	DB.Exec(`
		CREATE UNIQUE INDEX IF NOT EXISTS idx_name_user
		ON ai_models (name, created_by)
		WHERE created_by IS NOT NULL AND deleted_at IS NULL
	`)
}

func EnsureUsersUserNo() {
	DB.Exec(`
		DO $$
		BEGIN
			IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_no') THEN
				ALTER TABLE users ADD COLUMN user_no BIGINT;
			END IF;
		END $$;
	`)
	DB.Exec(`UPDATE users SET user_no = 10000000 + id WHERE user_no IS NULL OR user_no = 0`)
	DB.Exec(`ALTER TABLE users ALTER COLUMN user_no SET NOT NULL`)
	DB.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_user_no ON users(user_no)`)
}

func SeedBootstrapAdmin() error {
	var adminCount int64
	if err := DB.Model(&userModels.User{}).Where("role = ? AND deleted_at IS NULL", "admin").Count(&adminCount).Error; err != nil {
		return err
	}
	if adminCount > 0 {
		return nil
	}

	username := strings.TrimSpace(config.AdminBootstrapUsername)
	email := strings.TrimSpace(config.AdminBootstrapEmail)
	password := strings.TrimSpace(config.AdminBootstrapPassword)

	if username == "" {
		if config.ServerMode == "release" {
			log.Println("Warning: no admin user exists and ADMIN_BOOTSTRAP_USERNAME is empty; skipping bootstrap admin in release mode")
			return nil
		}
		username = "admin"
	}
	if email == "" {
		if config.ServerMode == "release" {
			log.Println("Warning: no admin user exists and ADMIN_BOOTSTRAP_EMAIL is empty; skipping bootstrap admin in release mode")
			return nil
		}
		email = "admin@local.dev"
	}
	if password == "" {
		if config.ServerMode == "release" {
			log.Println("Warning: no admin user exists and ADMIN_BOOTSTRAP_PASSWORD is empty; skipping bootstrap admin in release mode")
			return nil
		}
		password = "admin123456"
	}

	passwordDigest := fmt.Sprintf("%x", md5.Sum([]byte(password)))
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(passwordDigest), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash bootstrap admin password: %w", err)
	}

	admin := &userModels.User{
		UserNo:       generateBootstrapUserNo(),
		Username:     username,
		Email:        email,
		Password:     string(hashedPassword),
		Role:         "admin",
		Status:       "active",
		TokenBalance: 0,
	}
	if err := DB.Create(admin).Error; err != nil {
		return fmt.Errorf("failed to create bootstrap admin: %w", err)
	}

	log.Printf("Bootstrap admin ready: username=%s email=%s", username, email)
	if config.ServerMode != "release" && strings.TrimSpace(config.AdminBootstrapPassword) == "" {
		log.Printf("Bootstrap admin password=%s", password)
	}

	return nil
}

func generateBootstrapUserNo() int64 {
	const minNo int64 = 20000000
	const span int64 = 80000000

	for i := int64(0); i < 20; i++ {
		candidate := minNo + ((time.Now().UnixNano() + i) % span)
		var count int64
		if err := DB.Model(&userModels.User{}).Where("user_no = ?", candidate).Count(&count).Error; err == nil && count == 0 {
			return candidate
		}
	}

	var maxUserNo int64
	if err := DB.Model(&userModels.User{}).Where("user_no >= ?", minNo).Select("COALESCE(MAX(user_no), 0)").Scan(&maxUserNo).Error; err == nil {
		if maxUserNo < minNo {
			return minNo
		}
		if maxUserNo+1 < minNo+span {
			return maxUserNo + 1
		}
	}

	return minNo + time.Now().UnixNano()%span
}

func AutoMigrate() error {
	log.Println("Starting database migration...")

	return DB.AutoMigrate(
		&billingModels.QuotaLedger{},
		&userModels.User{},
		&userModels.UserOAuthBinding{},
		&userModels.UserAvatarHistory{},
		&userModels.UserInviteCode{},
		&userModels.UserInvitation{},
		&userModels.TokenTransaction{},
		&nodeModels.NodeType{},
		&systemModels.SystemConfig{},
		&systemModels.Statistics{},
		&paymentModels.Order{},
		&aiModels.ProviderTemplate{},
		&aiModels.ModelPricingConfig{},
		&aiModels.ModelCapabilityConfig{},
		&aiModels.ManagedAIModel{},
		&aiModels.ModelPricingRule{},
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
		&workflowModels.WorkflowNode{},
		&workflowModels.WorkflowVersion{},
		&workflowModels.WorkflowCommentCard{},
		&taskModels.TaskNodeExecution{},
		&taskModels.TaskLog{},
		&alkaidModels.AlkaidSession{},
		&alkaidModels.AlkaidMessage{},
		&alkaidModels.AlkaidKnowledge{},
		&alkaidModels.AlkaidNodeSpec{},
	)
}

func SeedProviderTemplates() error {
	if err := DB.AutoMigrate(&aiModels.ProviderTemplate{}); err != nil {
		return err
	}

	pricingRepo := aiRepos.NewPricingConfigRepository(DB)
	pricing, err := pricingRepo.FindAll()
	if err != nil {
		return err
	}

	type providerSeed struct {
		name        string
		description string
		baseURL     string
		defaultCfg  map[string]interface{}
	}

	defaults := map[string]providerSeed{
		"deepseek": {name: "DeepSeek", description: "DeepSeek model provider", baseURL: "https://api.deepseek.com", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"doubao":   {name: "Doubao", description: "Doubao model provider", baseURL: "https://ark.cn-beijing.volces.com/api/v3", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"qwen":     {name: "Qwen", description: "Qwen model provider", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"zhipuai":  {name: "ZhipuAI", description: "GLM model provider", baseURL: "https://open.bigmodel.cn/api/paas/v4", defaultCfg: map[string]interface{}{"temperature": 1.0, "maxTokens": 2048}},
		"spark":    {name: "Spark", description: "Spark model provider", baseURL: "https://spark-api-open.xf-yun.com/v2", defaultCfg: map[string]interface{}{"temperature": 1.0, "maxTokens": 8192}},
		"hunyuan":  {name: "Hunyuan", description: "Tencent Hunyuan provider", baseURL: "https://api.hunyuan.cloud.tencent.com/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
		"gpt":      {name: "GPT", description: "OpenAI-compatible GPT provider", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"claude":   {name: "Claude", description: "Anthropic Claude provider", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"gemini":   {name: "Gemini", description: "Google Gemini provider", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"grok":     {name: "Grok", description: "xAI Grok provider", baseURL: "https://openrouter.ai/api/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 4096}},
		"openai":   {name: "OpenAI", description: "OpenAI official provider", baseURL: "https://api.openai.com/v1", defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}},
	}

	providerSet := make(map[string]struct{})
	for key := range defaults {
		providerSet[key] = struct{}{}
	}
	for _, row := range pricing {
		if row.Provider != "" {
			providerSet[strings.ToLower(row.Provider)] = struct{}{}
		}
	}

	for provider := range providerSet {
		var existing aiModels.ProviderTemplate
		err := DB.Where("provider = ?", provider).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		def, ok := defaults[provider]
		if !ok {
			def = providerSeed{name: provider, defaultCfg: map[string]interface{}{"temperature": 0.7, "maxTokens": 2000}}
		}

		row := &aiModels.ProviderTemplate{
			Provider:        provider,
			Name:            def.name,
			Description:     normalizeOptionalString(def.description),
			DefaultBaseURL:  normalizeOptionalString(def.baseURL),
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

func SeedNodeTypes() error {
	DB.Exec(`ALTER TABLE node_types DROP CONSTRAINT IF EXISTS chk_node_types_category`)
	DB.Exec(`ALTER TABLE node_types ADD CONSTRAINT chk_node_types_category CHECK (category IN ('crawler','ai','output','condition','transform','start','end','dataclean','loop','merge','delay','custom'))`)

	nodes := []nodeModels.NodeType{
		{Name: "开始节点", Category: "start", Icon: shared.Ptr("PlayCircleOutlined"), Color: shared.Ptr("#52c41a"), IsSystem: true, IsActive: true},
		{Name: "爬虫节点", Category: "crawler", Icon: shared.Ptr("CloudDownloadOutlined"), Color: shared.Ptr("#1890ff"), IsSystem: true, IsActive: true},
		{Name: "AI处理节点", Category: "ai", Icon: shared.Ptr("RobotOutlined"), Color: shared.Ptr("#722ed1"), IsSystem: true, IsActive: true},
		{Name: "结果输出节点", Category: "output", Icon: shared.Ptr("FileTextOutlined"), Color: shared.Ptr("#fa8c16"), IsSystem: true, IsActive: true},
		{Name: "结束节点", Category: "end", Icon: shared.Ptr("StopOutlined"), Color: shared.Ptr("#f5222d"), IsSystem: true, IsActive: true},
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
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := DB.Create(&node).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		if err := DB.Model(&existing).Updates(map[string]interface{}{
			"category":  node.Category,
			"icon":      node.Icon,
			"color":     node.Color,
			"is_system": node.IsSystem,
			"is_active": node.IsActive,
		}).Error; err != nil {
			return err
		}
	}

	return nil
}

func SeedAlkaidSpecs() error {
	specs := []alkaidModels.AlkaidNodeSpec{
		{
			NodeTypeName: "爬虫节点",
			InputSpec:    shared.JSONB{Data: map[string]interface{}{"url": "目标网页地址", "selectors": "CSS选择器列表"}},
			OutputSpec:   shared.JSONB{Data: map[string]interface{}{"data": "抓取到的文本或结构化数据"}},
			Constraints:  shared.JSONB{Data: []interface{}{"URL 必须以 http 或 https 开头", "输出结果通常会被下游 AI 节点消费"}},
		},
		{
			NodeTypeName: "AI处理节点",
			InputSpec:    shared.JSONB{Data: map[string]interface{}{"prompt": "模型指令", "inputData": "上游输入数据"}},
			OutputSpec:   shared.JSONB{Data: map[string]interface{}{"result": "模型输出内容"}},
			Constraints:  shared.JSONB{Data: []interface{}{"需要有效的 API Key", "支持引用上游节点输出"}},
		},
	}

	for _, spec := range specs {
		var existing alkaidModels.AlkaidNodeSpec
		err := DB.Where("node_type_name = ?", spec.NodeTypeName).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := DB.Create(&spec).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		if err := DB.Model(&existing).Updates(spec).Error; err != nil {
			return err
		}
	}

	return nil
}

func SeedModelPricingConfigs() error {
	pricingRepo := aiRepos.NewPricingConfigRepository(DB)

	configs := []*aiModels.ModelPricingConfig{
		{
			Provider:    "deepseek",
			ModelName:   "deepseek-chat",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("DeepSeek chat pricing"),
			PricingData: shared.JSONB{Data: map[string]interface{}{"input_price_per_million": 1.0, "output_price_per_million": 2.0}},
		},
		{
			Provider:    "deepseek",
			ModelName:   "deepseek-reasoner",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("DeepSeek reasoning pricing"),
			PricingData: shared.JSONB{Data: map[string]interface{}{"input_price_per_million": 2.0, "output_price_per_million": 8.0}},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen-plus",
			PricingType: "separate",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("Qwen Plus pricing"),
			PricingData: shared.JSONB{Data: map[string]interface{}{"input_price_per_million": 0.004, "output_price_per_million": 0.012}},
		},
		{
			Provider:    "qwen",
			ModelName:   "qwen3-max",
			PricingType: "segmented",
			Currency:    "CNY",
			IsActive:    true,
			Description: shared.Ptr("Qwen3 Max segmented pricing"),
			PricingData: shared.JSONB{Data: map[string]interface{}{
				"segments": []map[string]interface{}{
					{"context_length_limit": 32000.0, "input_price_per_million": 0.0032, "output_price_per_million": 0.0128},
					{"context_length_limit": 128000.0, "input_price_per_million": 0.0064, "output_price_per_million": 0.0256},
					{"context_length_limit": nil, "input_price_per_million": 0.0096, "output_price_per_million": 0.0384},
				},
			}},
		},
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-4o",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("GPT-4o pricing"),
			PricingData: shared.JSONB{Data: map[string]interface{}{"input_price_per_million": 2.5, "output_price_per_million": 10.0, "cache_read_price_per_million": 1.25}},
		},
		{
			Provider:    "gpt",
			ModelName:   "openai/gpt-4o-mini",
			PricingType: "separate",
			Currency:    "USD",
			IsActive:    true,
			Description: shared.Ptr("GPT-4o mini pricing"),
			PricingData: shared.JSONB{Data: map[string]interface{}{"input_price_per_million": 0.15, "output_price_per_million": 0.60, "cache_read_price_per_million": 0.075}},
		},
	}

	for _, cfg := range configs {
		if err := pricingRepo.CreateOrUpdate(cfg); err != nil {
			return err
		}
	}

	return nil
}

func SeedModelCapabilityConfigs() error {
	capRepo := aiRepos.NewCapabilityConfigRepository(DB)
	pricingRepo := aiRepos.NewPricingConfigRepository(DB)

	configs, err := pricingRepo.FindAll()
	if err != nil {
		return err
	}

	for _, pricing := range configs {
		capability := defaultCapabilityForModel(pricing.Provider, pricing.ModelName)
		if err := capRepo.CreateOrUpdate(capability); err != nil {
			return err
		}
	}

	return nil
}

func defaultCapabilityForModel(provider, modelName string) *aiModels.ModelCapabilityConfig {
	cfg := &aiModels.ModelCapabilityConfig{
		Provider:                provider,
		ModelName:               modelName,
		DisplayName:             modelName,
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
		cfg.SupportStream = true
		cfg.SupportThinking = true
		if modelName == "deepseek-reasoner" {
			cfg.MaxTokensLimit = 65536
		} else {
			cfg.MaxTokensLimit = 8192
		}
	case "doubao":
		cfg.SupportStream = true
		cfg.SupportThinkingLevel = true
	case "qwen":
		cfg.SupportStream = true
		cfg.SupportEnableThinking = true
	case "zhipuai":
		cfg.SupportStream = true
		cfg.SupportThinking = true
		cfg.MaxTokensLimit = 131072
	case "spark":
		cfg.SupportStream = true
		cfg.MaxTokensLimit = 65535
	case "hunyuan":
		cfg.SupportStream = true
	case "claude", "gpt", "gemini", "grok":
		cfg.SupportFrequencyPenalty = true
		cfg.SupportPresencePenalty = true
		cfg.SupportStream = true
		cfg.MaxTokensLimit = 131072
	}

	return cfg
}

func SeedManagedAIModels() error {
	managedRepo := aiRepos.NewManagedAIModelRepository(DB)

	var pricingConfigs []aiModels.ModelPricingConfig
	if err := DB.Where("is_active = ?", true).Find(&pricingConfigs).Error; err != nil {
		return err
	}

	var capabilityConfigs []aiModels.ModelCapabilityConfig
	if err := DB.Where("is_active = ?", true).Find(&capabilityConfigs).Error; err != nil {
		return err
	}

	type modelSeed struct {
		provider    string
		modelName   string
		displayName string
		description *string
	}

	seeds := make(map[string]modelSeed)
	for _, pricing := range pricingConfigs {
		key := pricing.Provider + "|" + pricing.ModelName
		seeds[key] = modelSeed{
			provider:    pricing.Provider,
			modelName:   pricing.ModelName,
			displayName: pricing.ModelName,
			description: pricing.Description,
		}
	}

	for _, capability := range capabilityConfigs {
		key := capability.Provider + "|" + capability.ModelName
		seed, ok := seeds[key]
		if !ok {
			seed = modelSeed{provider: capability.Provider, modelName: capability.ModelName}
		}
		if strings.TrimSpace(capability.DisplayName) != "" {
			seed.displayName = capability.DisplayName
		}
		if seed.displayName == "" {
			seed.displayName = capability.ModelName
		}
		seeds[key] = seed
	}

	for _, seed := range seeds {
		model := &aiModels.ManagedAIModel{
			Provider:    seed.provider,
			ModelName:   seed.modelName,
			DisplayName: seed.displayName,
			Description: seed.description,
			Status:      "active",
			IsActive:    true,
		}
		if err := managedRepo.CreateOrUpdate(model); err != nil {
			return err
		}
	}

	return nil
}

func SeedPricingRulesFromConfigs() error {
	managedRepo := aiRepos.NewManagedAIModelRepository(DB)
	pricingRuleRepo := aiRepos.NewPricingRuleRepository(DB)

	models, err := managedRepo.FindAll()
	if err != nil {
		return err
	}

	for _, model := range models {
		version, err := pricingRuleRepo.FindLatestVersionByModelID(model.ID)
		if err != nil {
			return err
		}
		if version > 0 {
			continue
		}

		var pricing aiModels.ModelPricingConfig
		err = DB.Where("provider = ? AND model_name = ? AND is_active = ?", model.Provider, model.ModelName, true).First(&pricing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue
		}
		if err != nil {
			return err
		}

		effectiveAt := pricing.CreatedAt
		if effectiveAt.IsZero() {
			effectiveAt = time.Now()
		}

		rule := &aiModels.ModelPricingRule{
			ManagedModelID: model.ID,
			Provider:       model.Provider,
			ModelName:      model.ModelName,
			PricingType:    pricing.PricingType,
			Currency:       pricing.Currency,
			IsActive:       pricing.IsActive,
			Version:        1,
			EffectiveAt:    effectiveAt,
			Description:    pricing.Description,
			PricingData:    pricing.PricingData,
		}
		if err := pricingRuleRepo.Create(rule); err != nil {
			return err
		}
	}

	return nil
}

func CloseDatabase() error {
	if DB == nil {
		return nil
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func normalizeOptionalString(value string) *string {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return shared.Ptr(value)
}

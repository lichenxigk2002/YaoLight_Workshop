package rbac

type ResourceDefinition struct {
	Key         string
	Description string
}

var ResourceDefinitions = []ResourceDefinition{
	{Key: "dashboard", Description: "仪表盘"},
	{Key: "permissions", Description: "权限管理"},
	{Key: "users", Description: "用户管理"},
	{Key: "workflow_templates", Description: "工作流模板"},
	{Key: "workflow_templates.canvas", Description: "工作流模板编排"},
	{Key: "node_types", Description: "节点类型"},
	{Key: "knowledge_base", Description: "知识库"},
	{Key: "crawler_rules", Description: "爬虫规则"},
	{Key: "ai_models.overview", Description: "AI 模型概览"},
	{Key: "ai_models.providers", Description: "AI 服务商"},
	{Key: "ai_models.models", Description: "AI 模型"},
	{Key: "ai_models.pricing_rules", Description: "AI 计费规则"},
	{Key: "ai_models.usage", Description: "AI 使用统计"},
	{Key: "tasks.overview", Description: "任务概览"},
	{Key: "tasks.running", Description: "运行中任务"},
	{Key: "tasks.failures", Description: "失败任务"},
	{Key: "tasks.detail", Description: "任务详情"},
	{Key: "billing.overview", Description: "计费概览"},
	{Key: "billing.quota_recovery", Description: "补救配额"},
	{Key: "billing.admin_grant", Description: "管理员赠送"},
	{Key: "billing.orders", Description: "订单列表"},
	{Key: "billing.ledger", Description: "配额流水"},
	{Key: "billing.token_ledger", Description: "Token 流水"},
	{Key: "system_configs", Description: "系统配置"},
	{Key: "notifications.send", Description: "发送通知"},
	{Key: "notifications.jobs", Description: "通知任务"},
	{Key: "notifications.log", Description: "通知明细"},
	{Key: "notifications.analytics", Description: "通知统计"},
	{Key: "notifications.templates", Description: "通知模板"},
	{Key: "operation_logs", Description: "操作日志"},
}

var DefaultRoleDefinitions = []struct {
	Code        string
	Name        string
	Description string
}{
	{Code: "super_admin", Name: "超级管理员", Description: "拥有后台全部权限"},
}

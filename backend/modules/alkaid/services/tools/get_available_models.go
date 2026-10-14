package tools

// 当前系统支持的 AI 节点可用模型列表（静态配置，与前端/配置中心一致时可改为动态读取）
var defaultAvailableModels = []map[string]interface{}{
	{"provider": "gpt", "modelName": "openai/gpt-5.4"},
	{"provider": "gpt", "modelName": "openai/gpt-5.2"},
	{"provider": "gpt", "modelName": "openai/gpt-5.1"},
	{"provider": "openai", "modelName": "openai/gpt-5.4"},
	{"provider": "openai", "modelName": "openai/gpt-5.2"},
	{"provider": "deepseek", "modelName": "deepseek-v4-pro"},
	{"provider": "deepseek", "modelName": "deepseek-v4-flash"},
	{"provider": "qwen", "modelName": "qwen-turbo"},
	{"provider": "qwen", "modelName": "qwen-plus"},
	{"provider": "moonshot", "modelName": "moonshot-v1"},
	{"provider": "zhipuai", "modelName": "glm-4-flash"},
	{"provider": "spark", "modelName": "general"},
}

// toolGetAvailableModels 占位（无 Runner 时也可返回静态列表）
func toolGetAvailableModels(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return map[string]interface{}{"models": defaultAvailableModels}, "已返回可用模型列表", nil
}

// runGetAvailableModels 返回当前可用的 provider/modelName 列表，供生成 AI 节点时选用
func (r *Registry) runGetAvailableModels(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
	return toolGetAvailableModels(params, sessionID)
}

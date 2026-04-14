package services

import (
	log "yaolight-workshop/backend/infrastructure/logx"
)

// ProviderConfigMapper 提供商配置映射器
// 将前端的统一参数名映射到各个provider的实际参数名
type ProviderConfigMapper struct{}

// NewProviderConfigMapper 创建配置映射器
func NewProviderConfigMapper() *ProviderConfigMapper {
	return &ProviderConfigMapper{}
}

// MapProviderConfig 将前端统一参数映射到provider特定参数
// 前端统一使用以下参数名：
//   - thinking: bool (深度思考开关)
//   - thinkingLevel: string (思考级别，如 "low", "medium", "high")
//   - reasoning: bool (推理开关，与thinking等价)
//   - reasoning_effort: string (推理努力程度)
//   - stream: bool (流式输出)
//
// 不同provider的实际参数名：
//   - DeepSeek: thinking (bool)
//   - 通义千问: enable_thinking (bool)
//   - Claude/Gemini/Grok: reasoning (map[string]interface{})
//   - 智谱AI: thinking (bool)
//   - 讯飞星火: thinkingType (string) 或 thinking (bool)
//   - 豆包: thinkingLevel (string)
func (m *ProviderConfigMapper) MapProviderConfig(
	provider string,
	nodeConfig map[string]interface{},
	existingProviderConfig map[string]interface{},
) (map[string]interface{}, bool) {
	// 复制现有配置
	result := make(map[string]interface{})
	for k, v := range existingProviderConfig {
		result[k] = v
	}

	// 处理流式参数（所有provider统一使用stream）
	if stream, ok := nodeConfig["stream"].(bool); ok {
		result["stream"] = stream
	} else if _, exists := result["stream"]; !exists {
		// 如果没有指定，使用默认值
		// 豆包默认开启流式，其他provider默认关闭
		if provider == "doubao" {
			result["stream"] = true
		} else {
			result["stream"] = false
		}
	}

	// 根据provider类型映射深度思考参数
	switch provider {
	case "deepseek", "zhipuai":
		// DeepSeek 和 智谱AI 使用 thinking (bool)
		if thinking, ok := nodeConfig["thinking"].(bool); ok {
			result["thinking"] = thinking
		} else if reasoning, ok := nodeConfig["reasoning"].(bool); ok {
			// 兼容 reasoning 参数
			result["thinking"] = reasoning
		} else if _, exists := result["thinking"]; !exists {
			result["thinking"] = false
		}

	case "qwen", "qianwen":
		// 通义千问使用 enable_thinking (bool)
		// 注意：qwen 和 qianwen 是同一个provider的不同名称
		if enableThinking, ok := nodeConfig["enable_thinking"].(bool); ok {
			result["enable_thinking"] = enableThinking
		} else if thinking, ok := nodeConfig["thinking"].(bool); ok {
			// 兼容 thinking 参数，映射到 enable_thinking
			result["enable_thinking"] = thinking
		} else if reasoning, ok := nodeConfig["reasoning"].(bool); ok {
			// 兼容 reasoning 参数
			result["enable_thinking"] = reasoning
		} else if _, exists := result["enable_thinking"]; !exists {
			result["enable_thinking"] = false
		}

	case "claude", "gemini", "grok", "gpt":
		// Claude/Gemini/Grok/GPT (via OpenRouter) 使用 reasoning (map)
		// 优先检查 reasoning 参数
		if reasoningMap, ok := nodeConfig["reasoning"].(map[string]interface{}); ok {
			// 如果前端传递的是对象，直接使用
			result["reasoning"] = reasoningMap
		} else if reasoning, ok := nodeConfig["reasoning"].(bool); ok {
			// 如果前端传递的是布尔值，转换为对象
			// 注意：只有当reasoning=true时才添加，false时不添加（根据官方示例）
			if reasoning {
				reasoningConfig := map[string]interface{}{
					"enabled": true,
				}
				// 如果有 reasoning_effort，添加到配置中
				if effort, ok := nodeConfig["reasoning_effort"].(string); ok && effort != "" {
					reasoningConfig["effort"] = effort
				}
				result["reasoning"] = reasoningConfig
			}
			// 如果reasoning=false，不添加reasoning参数
		} else if thinking, ok := nodeConfig["thinking"].(bool); ok {
			// 兼容 thinking 参数，映射到 reasoning
			// 注意：只有当thinking=true时才添加，false时不添加（根据官方示例）
			if thinking {
				reasoningConfig := map[string]interface{}{
					"enabled": true,
				}
				// 如果有 reasoning_effort，添加到配置中
				if effort, ok := nodeConfig["reasoning_effort"].(string); ok && effort != "" {
					reasoningConfig["effort"] = effort
				}
				result["reasoning"] = reasoningConfig
			}
			// 如果thinking=false，不添加reasoning参数
		}
		// 注意：根据官方示例，如果不启用推理，不应该添加reasoning参数
		// 只有当明确启用时才添加，不添加默认的 {"enabled": false}

		// 单独处理 reasoning_effort（如果reasoning已存在但需要更新effort）
		if reasoningVal, exists := result["reasoning"]; exists {
			if reasoningMap, ok := reasoningVal.(map[string]interface{}); ok {
				if effort, ok := nodeConfig["reasoning_effort"].(string); ok && effort != "" {
					reasoningMap["effort"] = effort
				}
			}
		}

		// 处理 frequency_penalty 和 presence_penalty
		if fp, ok := nodeConfig["frequencyPenalty"].(float64); ok {
			result["frequencyPenalty"] = fp
		}
		if pp, ok := nodeConfig["presencePenalty"].(float64); ok {
			result["presencePenalty"] = pp
		}

	case "spark":
		// 讯飞星火使用 thinkingType (string) 或 thinking (bool)
		if thinkingType, ok := nodeConfig["thinkingType"].(string); ok && thinkingType != "" {
			result["thinkingType"] = thinkingType
		} else if thinking, ok := nodeConfig["thinking"].(bool); ok {
			// 兼容 thinking 参数，映射到 thinkingType
			if thinking {
				result["thinkingType"] = "enabled"
			} else {
				result["thinkingType"] = "disabled"
			}
		} else if reasoning, ok := nodeConfig["reasoning"].(bool); ok {
			// 兼容 reasoning 参数
			if reasoning {
				result["thinkingType"] = "enabled"
			} else {
				result["thinkingType"] = "disabled"
			}
		} else if _, exists := result["thinkingType"]; !exists {
			result["thinkingType"] = "auto" // 默认使用 auto（让模型自动判断）
		}

	case "doubao":
		// 豆包使用 thinkingLevel (string)
		if thinkingLevel, ok := nodeConfig["thinkingLevel"].(string); ok && thinkingLevel != "" {
			result["thinkingLevel"] = thinkingLevel
		} else if _, exists := result["thinkingLevel"]; !exists {
			result["thinkingLevel"] = "medium" // 默认值
		}

	default:
		// 未知provider，尝试通用映射
		if thinking, ok := nodeConfig["thinking"].(bool); ok {
			result["thinking"] = thinking
		}
		if reasoning, ok := nodeConfig["reasoning"].(bool); ok {
			result["reasoning"] = reasoning
		}
		log.Printf("⚠️ 未知的provider类型: %s，使用通用参数映射", provider)
	}

	// 获取流式标志（用于返回值）
	stream := false
	if s, ok := result["stream"].(bool); ok {
		stream = s
	}

	return result, stream
}

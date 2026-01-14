/**
 * 模型配置支持定义
 * 定义每个模型/提供商支持的高级参数
 */

import { providerRegistry } from '../providers';

export interface ModelConfigSupport {
  // 基础参数（所有模型都支持）
  temperature: boolean;
  maxTokens: boolean;
  topP: boolean;

  // 提供商特定参数
  stream?: boolean;        // 流式输出（DeepSeek、豆包支持）
  thinking?: boolean;       // 深度思考开关（DeepSeek支持）
  thinkingLevel?: boolean;  // 思考长度模式（豆包支持：minimal/low/medium/high）
  frequencyPenalty?: boolean; // 频率惩罚（OpenAI支持）
  presencePenalty?: boolean;  // 存在惩罚（OpenAI支持）
  stopSequences?: boolean;    // 停止序列（OpenAI支持）
}

/**
 * 根据提供商和模型名称获取配置支持
 * 优先从注册表获取，如果没有注册则使用默认配置
 */
export function getModelConfigSupport(
  provider: string | null
): ModelConfigSupport {
  // 基础配置（所有模型都支持）
  const baseConfig: ModelConfigSupport = {
    temperature: true,
    maxTokens: true,
    topP: true,
  };

  if (!provider) {
    return baseConfig;
  }

  // 优先从注册表获取
  const providerReg = providerRegistry.get(provider);
  if (providerReg && providerReg.supportedConfig) {
    return {
      ...baseConfig,
      ...providerReg.supportedConfig,
    };
  }

  // 如果没有注册，使用默认配置（向后兼容）
  switch (provider.toLowerCase()) {
    case 'openai':
      return {
        ...baseConfig,
        stream: true,
        frequencyPenalty: true,
        presencePenalty: true,
        stopSequences: true,
      };

    default:
      return baseConfig;
  }
}

/**
 * 获取模型配置键（用于存储和恢复配置）
 */
export function getModelConfigKey(
  modelMode: string,
  provider: string | null,
  modelName: string | null,
  modelId: number | null
): string {
  if (modelMode === 'saved' && modelId) {
    return `model_${modelId}`;
  }
  if (provider && modelName) {
    return `${provider}_${modelName}`;
  }
  if (provider) {
    return provider;
  }
  return 'default';
}

/**
 * 过滤配置，只保留模型支持的参数
 */
export function filterSupportedConfig(
  config: Record<string, any>,
  support: ModelConfigSupport
): Record<string, any> {
  const filtered: Record<string, any> = {};

  // 基础参数
  if (support.temperature && config.temperature !== undefined) {
    filtered.temperature = config.temperature;
  }
  if (support.maxTokens && config.maxTokens !== undefined) {
    filtered.maxTokens = config.maxTokens;
  }
  if (support.topP && config.topP !== undefined) {
    filtered.topP = config.topP;
  }

  // 提供商特定参数
  if (support.stream && config.stream !== undefined) {
    filtered.stream = config.stream;
  }
  if (support.thinking && config.thinking !== undefined) {
    filtered.thinking = config.thinking;
  }
  if (support.thinkingLevel && config.thinkingLevel !== undefined) {
    filtered.thinkingLevel = config.thinkingLevel;
  }
  if (support.frequencyPenalty && config.frequencyPenalty !== undefined) {
    filtered.frequencyPenalty = config.frequencyPenalty;
  }
  if (support.presencePenalty && config.presencePenalty !== undefined) {
    filtered.presencePenalty = config.presencePenalty;
  }
  if (support.stopSequences && config.stopSequences !== undefined) {
    filtered.stopSequences = config.stopSequences;
  }

  // 保留其他非高级参数的配置（如 prompt, contentVariable 等）
  const advancedParams = [
    'temperature',
    'maxTokens',
    'topP',
    'stream',
    'thinking',
    'thinkingLevel',
    'frequencyPenalty',
    'presencePenalty',
    'stopSequences',
  ];

  for (const key in config) {
    if (!advancedParams.includes(key)) {
      filtered[key] = config[key];
    }
  }

  return filtered;
}


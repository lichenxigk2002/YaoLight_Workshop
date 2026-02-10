/**
 * 模型配置支持定义
 * 定义每个模型/提供商支持的高级参数
 * 优先使用后端返回的 modelCapabilities（按模型），无则回退到前端 provider 注册表
 */

import type { ModelCapability } from '@/types/ai';
import type { ProviderConfigOption } from '../providers/types';
import { providerRegistry } from '../providers';

export interface ModelConfigSupport {
  // 基础参数（所有模型都支持）
  temperature: boolean;
  maxTokens: boolean;
  topP: boolean;

  // 提供商特定参数
  stream?: boolean;        // 流式输出（DeepSeek、豆包支持）
  thinking?: boolean;       // 深度思考开关（DeepSeek支持）
  enableThinking?: boolean; // 思考开关（通义 enable_thinking）
  thinkingLevel?: boolean;  // 思考长度模式（豆包支持：minimal/low/medium/high）
  frequencyPenalty?: boolean; // 频率惩罚（OpenAI支持）
  presencePenalty?: boolean;  // 存在惩罚（OpenAI支持）
  stopSequences?: boolean;    // 停止序列（OpenAI支持）
}

const baseConfig: ModelConfigSupport = {
  temperature: true,
  maxTokens: true,
  topP: true,
};

/**
 * 从后端返回的模型能力（modelCapabilities[modelName]）转为 ModelConfigSupport
 * 用于按模型驱动表单项显隐
 */
export function getModelConfigSupportFromCapability(
  cap: ModelCapability | null | undefined
): ModelConfigSupport {
  if (!cap) return baseConfig;
  // 严格按后端布尔值：只有明确为 true 才为 true，避免数据库改为 false 后仍展示
  return {
    ...baseConfig,
    temperature: cap.support_temperature === true,
    maxTokens: cap.support_max_tokens === true,
    topP: cap.support_top_p === true,
    stream: cap.support_stream === true,
    thinking: cap.support_thinking === true,
    enableThinking: cap.support_enable_thinking === true,
    thinkingLevel: cap.support_thinking_level === true,
    frequencyPenalty: cap.support_frequency_penalty === true,
    presencePenalty: cap.support_presence_penalty === true,
    stopSequences: cap.support_stop_sequences === true,
  };
}

/**
 * 从模型能力取 max_tokens 上限，无则返回默认 32768
 */
export function getMaxTokensLimitFromCapability(
  cap: ModelCapability | null | undefined
): number {
  if (cap?.max_tokens_limit != null && cap.max_tokens_limit > 0) {
    return cap.max_tokens_limit;
  }
  return 32768;
}

/**
 * 无后端能力配置时的 maxTokens 上限回退（与原有硬编码一致，保证兼容）
 */
export function getMaxTokensLimitFallback(
  provider: string | null,
  modelName: string
): number {
  if (!provider) return 32768;
  const p = provider.toLowerCase();
  if (p === 'deepseek') {
    return modelName?.includes('reasoner') ? 65536 : 8192;
  }
  if (p === 'doubao') return 32768;
  if (p === 'zhipuai') return 131072;
  if (p === 'claude' || p === 'gpt' || p === 'grok') return 131072;
  if (p === 'gemini') return 32768;
  if (p === 'spark') return 65535;
  if (p === 'hunyuan') return 32768;
  return 32768;
}

/**
 * 根据提供商（和可选的能力配置）获取配置支持
 * 只有明确传入 capabilityFromApi（来自接口按需拉取或 templates）时才展示 stream/thinking 等；
 * 无能力数据时只展示基础三项（temperature、maxTokens、topP），避免写死的 supportedConfig 导致「还是会展示」
 */
export function getModelConfigSupport(
  _provider: string | null,
  capabilityFromApi?: ModelCapability | null
): ModelConfigSupport {
  // 有接口能力数据时严格按后端配置（只有 === true 才展示）
  if (capabilityFromApi != null && typeof capabilityFromApi === 'object') {
    return getModelConfigSupportFromCapability(capabilityFromApi);
  }

  // 无能力数据时只展示基础三项，不合并 provider 的 stream/thinking 等，与后端能力表一致
  return baseConfig;
}

/**
 * 仅用于持久化/恢复时：无 capability 时按 provider 回退，避免丢失用户已填的 stream/thinking 等
 * 展示用 getModelConfigSupport(provider, capability)，不要用本函数
 */
export function getModelConfigSupportForPersistence(provider: string | null): ModelConfigSupport {
  if (!provider) return baseConfig;
  const providerReg = providerRegistry.get(provider);
  if (providerReg?.supportedConfig) {
    return { ...baseConfig, ...providerReg.supportedConfig };
  }
  switch (provider.toLowerCase()) {
    case 'openai':
      return { ...baseConfig, stream: true, frequencyPenalty: true, presencePenalty: true, stopSequences: true };
    default:
      return baseConfig;
  }
}

/**
 * 按后端能力配置过滤 provider 的 configuration 列表（用于新架构 StandardProviderConfig）
 * 不支持的项不展示；maxTokens 的 max 使用 capability 的 max_tokens_limit
 */
export function filterProviderOptionsBySupport(
  options: ProviderConfigOption[],
  support: ModelConfigSupport,
  maxTokensLimit: number
): ProviderConfigOption[] {
  return options
    .filter((opt) => {
      if (opt.type === 'temperature') return support.temperature;
      if (opt.type === 'maxTokens') return support.maxTokens;
      if (opt.type === 'topP') return support.topP;
      if (opt.type === 'stream') return support.stream;
      if (opt.type === 'thinking') {
        return opt.field === 'enable_thinking' ? (support.enableThinking ?? false) : (support.thinking ?? false);
      }
      if (opt.type === 'thinkingLevel') return support.thinkingLevel;
      if (opt.type === 'frequencyPenalty') return support.frequencyPenalty;
      if (opt.type === 'presencePenalty') return support.presencePenalty;
      return true; // select, switch, custom 等保留
    })
    .map((opt) => {
      if (opt.type === 'maxTokens' && opt.props) {
        return { ...opt, props: { ...opt.props, max: maxTokensLimit } };
      }
      return opt;
    });
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
  // 通义千问使用 enable_thinking 而不是 thinking
  if (support.thinking && config.enable_thinking !== undefined) {
    filtered.enable_thinking = config.enable_thinking;
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
    'enable_thinking', // 通义千问的深度思考参数
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


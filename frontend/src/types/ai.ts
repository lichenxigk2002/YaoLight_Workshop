/**
 * AI相关类型定义
 */

/**
 * AI模型配置
 */
export interface AIModel {
  id: number;
  name: string;
  provider: string;
  modelName: string;
  modelIcon?: string;
  providerIcon?: string;
  status: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  endpoint?: string;
  params?: Record<string, any>; // 模型级别的自定义配置（JSONB），例如 DeepSeek 的 stream 和 thinking
  supportedModels?: string[]; // 当 modelName 为 __provider_default__ 时，该供应商的所有子模型列表
  createdAt: string;
  updatedAt: string;
}

/**
 * 模型能力配置（来自后端 model_capability_configs，按 provider+model 返回）
 * 0/1 表示该模型是否支持该项；用户是否启用、具体取值由节点/用户配置决定
 */
export interface ModelCapability {
  support_temperature?: boolean;
  support_max_tokens?: boolean;
  support_top_p?: boolean;
  support_stream?: boolean;
  support_thinking?: boolean;
  support_thinking_level?: boolean;
  support_enable_thinking?: boolean;
  support_frequency_penalty?: boolean;
  support_presence_penalty?: boolean;
  support_stop_sequences?: boolean;
  support_vision?: boolean;
  support_image_generation?: boolean;
  max_tokens_limit?: number;
  capability_options?: Record<string, any>; // 子配置，如图片生成分辨率等
}

/**
 * 供应商模板
 */
export interface ProviderTemplate {
  provider: string;
  name: string;
  icon?: string;
  description?: string;
  defaultBaseUrl?: string;
  supportedModels: string[];
  /** 该供应商下各模型的能力配置，key 为 modelName */
  modelCapabilities?: Record<string, ModelCapability>;
  capabilities?: string[]; // 例如: ['LLM', 'TEXT EMBEDDING', 'TTS']
  defaultConfig: {
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * 系统预设模型
 */
export interface SystemPresetModel {
  id: string;
  name: string;
  provider: string;
  modelName: string;
  modelIcon?: string;
  providerIcon?: string;
  baseUrl: string;
  isSystem: boolean;
  description?: string;
}

/**
 * 创建模型请求
 */
export interface CreateModelRequest {
  name: string;
  provider: string;
  modelName: string;
  apiKey: string;
  baseUrl?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
  params?: Record<string, any>; // 模型级别的自定义配置（JSONB）
}

/**
 * 更新模型请求
 */
export interface UpdateModelRequest {
  name?: string;
  apiKey?: string;
  baseUrl?: string;
  endpoint?: string;
  temperature?: number;
  maxTokens?: number;
  status?: string;
  params?: Record<string, any>; // 模型级别的自定义配置（JSONB）
}

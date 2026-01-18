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
  status: string;
  temperature?: number;
  maxTokens?: number;
  baseUrl?: string;
  endpoint?: string;
  params?: Record<string, any>; // 模型级别的自定义配置（JSONB），例如 DeepSeek 的 stream 和 thinking
  createdAt: string;
  updatedAt: string;
}

/**
 * 供应商模板
 */
export interface ProviderTemplate {
  provider: string;
  name: string;
  description?: string;
  defaultBaseUrl?: string;
  supportedModels: string[];
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


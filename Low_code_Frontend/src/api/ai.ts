import http from '@/http';
import type {
  AIModel,
  ProviderTemplate,
  SystemPresetModel,
  CreateModelRequest,
  UpdateModelRequest,
} from '@/types/ai';

const adaptAIModel = (raw: any): AIModel => ({
  id: raw?.id,
  name: raw?.name,
  provider: raw?.provider,
  modelName: raw?.modelName ?? raw?.model_name,
  status: raw?.status,
  temperature: raw?.temperature,
  maxTokens: raw?.maxTokens ?? raw?.max_tokens,
  baseUrl: raw?.baseUrl ?? raw?.base_url,
  endpoint: raw?.endpoint,
  params: raw?.params,
  supportedModels: raw?.supportedModels, // 当 modelName 为 __provider_default__ 时的子模型列表
  createdAt: raw?.createdAt ?? raw?.created_at,
  updatedAt: raw?.updatedAt ?? raw?.updated_at,
});

/**
 * AI API
 */
export const aiApi = {
  // 获取供应商模板列表
  getProviderTemplates: (): Promise<ProviderTemplate[]> =>
    http.get<ProviderTemplate[]>('/ai/providers/templates'),

  // 获取系统预设模型列表
  getSystemPresetModels: (): Promise<SystemPresetModel[]> =>
    http.get<SystemPresetModel[]>('/ai/models/system'),

  // 获取用户模型列表
  getModels: async (params?: { page?: number; pageSize?: number }): Promise<{ list: AIModel[]; total: number; page: number; pageSize: number }> => {
    const res = await http.get<{ list: any[]; total: number; page: number; pageSize: number }>('/ai/models', params);
    return {
      ...res,
      list: Array.isArray(res?.list) ? res.list.map(adaptAIModel) : [],
    };
  },

  // 创建模型配置
  createModel: async (data: CreateModelRequest): Promise<AIModel> => {
    const res = await http.post<any>('/ai/models', data);
    return adaptAIModel(res);
  },

  // 更新模型配置
  updateModel: async (id: number, data: UpdateModelRequest): Promise<AIModel> => {
    const res = await http.put<any>(`/ai/models/${id}`, data);
    return adaptAIModel(res);
  },

  // 删除模型配置
  deleteModel: (id: number): Promise<void> =>
    http.delete(`/ai/models/${id}`),
};


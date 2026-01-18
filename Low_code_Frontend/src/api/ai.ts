import http from '@/http';
import type {
  AIModel,
  ProviderTemplate,
  SystemPresetModel,
  CreateModelRequest,
  UpdateModelRequest,
} from '@/types/ai';

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
  getModels: (params?: { page?: number; pageSize?: number }): Promise<{ list: AIModel[]; total: number; page: number; pageSize: number }> =>
    http.get('/ai/models', params),

  // 创建模型配置
  createModel: (data: CreateModelRequest): Promise<AIModel> =>
    http.post<AIModel>('/ai/models', data),

  // 更新模型配置
  updateModel: (id: number, data: UpdateModelRequest): Promise<AIModel> =>
    http.put<AIModel>(`/ai/models/${id}`, data),

  // 删除模型配置
  deleteModel: (id: number): Promise<void> =>
    http.delete(`/ai/models/${id}`),
};


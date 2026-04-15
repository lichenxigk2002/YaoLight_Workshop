import http from '@/api/http';
import {
  fallbackProviderTemplates,
  inferCapability,
  inferPricing,
  inferUsage,
} from './mock';
import { getAIWorkspace, getModelKey, saveAIWorkspace } from './storage';
import type {
  AIAdminWorkspace,
  AIModelCapability,
  AIModelPricingRule,
  AIModelRecord,
  AIMonitoringItem,
  AIMonitoringSettings,
  AIMonitoringSnapshot,
  AIMonitoringSummary,
  AIProviderInsight,
  AIProviderTemplate,
  AIUsageSnapshot,
  CreateAIModelPayload,
  UpdateAIModelMetaPayload,
} from './types';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function adaptCapability(raw: Record<string, unknown>): AIModelCapability {
  return {
    supportTemperature: Boolean(raw.support_temperature ?? raw.supportTemperature ?? false),
    supportMaxTokens: Boolean(raw.support_max_tokens ?? raw.supportMaxTokens ?? false),
    supportTopP: Boolean(raw.support_top_p ?? raw.supportTopP ?? false),
    supportStream: Boolean(raw.support_stream ?? raw.supportStream ?? false),
    supportThinking: Boolean(raw.support_thinking ?? raw.supportThinking ?? false),
    supportThinkingLevel: Boolean(raw.support_thinking_level ?? raw.supportThinkingLevel ?? false),
    supportEnableThinking: Boolean(raw.support_enable_thinking ?? raw.supportEnableThinking ?? false),
    supportFrequencyPenalty: Boolean(raw.support_frequency_penalty ?? raw.supportFrequencyPenalty ?? false),
    supportPresencePenalty: Boolean(raw.support_presence_penalty ?? raw.supportPresencePenalty ?? false),
    supportStopSequences: Boolean(raw.support_stop_sequences ?? raw.supportStopSequences ?? false),
    supportVision: Boolean(raw.support_vision ?? raw.supportVision ?? false),
    supportImageGeneration: Boolean(raw.support_image_generation ?? raw.supportImageGeneration ?? false),
    maxTokensLimit: Number(raw.max_tokens_limit ?? raw.maxTokensLimit ?? 32768),
    capabilityOptions: (raw.capability_options ?? raw.capabilityOptions ?? {}) as Record<string, unknown>,
    displayName: String(raw.display_name ?? raw.displayName ?? ''),
    sortOrder: Number(raw.sort_order ?? raw.sortOrder ?? 0),
    isActive: Boolean(raw.is_active ?? raw.isActive ?? true),
  };
}

function adaptProviderTemplate(raw: Record<string, unknown>): AIProviderTemplate {
  const capabilities = raw.modelCapabilities ?? raw.model_capabilities ?? {};
  const capabilityMap = Object.fromEntries(
    Object.entries(capabilities as Record<string, Record<string, unknown>>).map(([modelName, capability]) => [
      modelName,
      adaptCapability(capability),
    ]),
  );

  return {
    provider: String(raw.provider ?? ''),
    name: String(raw.name ?? raw.provider ?? ''),
    description: typeof raw.description === 'string' ? raw.description : undefined,
    icon: typeof raw.icon === 'string' ? raw.icon : undefined,
    defaultBaseUrl:
      typeof raw.defaultBaseUrl === 'string'
        ? raw.defaultBaseUrl
        : typeof raw.default_base_url === 'string'
          ? raw.default_base_url
          : undefined,
    defaultEndpoint:
      typeof raw.defaultEndpoint === 'string'
        ? raw.defaultEndpoint
        : typeof raw.default_endpoint === 'string'
          ? raw.default_endpoint
          : undefined,
    supportedModels: toArray<string>(raw.supportedModels ?? raw.supported_models).map(String),
    defaultConfig: (raw.defaultConfig ?? raw.default_config ?? {}) as Record<string, unknown>,
    modelCapabilities: capabilityMap,
    isActive: Boolean(raw.isActive ?? raw.is_active ?? true),
  };
}

function adaptMonitoringSettings(raw: Record<string, unknown>): AIMonitoringSettings {
  return {
    autoEnabled: Boolean(raw.auto_enabled ?? raw.autoEnabled ?? false),
    probeIntervalMinutes: Number(raw.probe_interval_minutes ?? raw.probeIntervalMinutes ?? 15),
  };
}

function adaptMonitoringSummary(raw: Record<string, unknown>): AIMonitoringSummary {
  return {
    totalModels: Number(raw.total_models ?? raw.totalModels ?? 0),
    healthyModels: Number(raw.healthy_models ?? raw.healthyModels ?? 0),
    failedModels: Number(raw.failed_models ?? raw.failedModels ?? 0),
    unknownModels: Number(raw.unknown_models ?? raw.unknownModels ?? 0),
    notConfiguredModels: Number(raw.not_configured_models ?? raw.notConfiguredModels ?? 0),
  };
}

function adaptMonitoringItem(raw: Record<string, unknown>): AIMonitoringItem {
  return {
    managedModelId: Number(raw.managed_model_id ?? raw.managedModelId ?? 0),
    provider: String(raw.provider ?? ''),
    modelName: String(raw.model_name ?? raw.modelName ?? ''),
    displayName: String(raw.display_name ?? raw.displayName ?? raw.model_name ?? raw.modelName ?? ''),
    status: String(raw.status ?? 'active'),
    isActive: Boolean(raw.is_active ?? raw.isActive ?? true),
    probeStatus: String(raw.probe_status ?? raw.probeStatus ?? 'unknown') as AIMonitoringItem['probeStatus'],
    lastCheckedAt: typeof raw.last_checked_at === 'string' ? raw.last_checked_at : typeof raw.lastCheckedAt === 'string' ? raw.lastCheckedAt : undefined,
    lastSuccessAt: typeof raw.last_success_at === 'string' ? raw.last_success_at : typeof raw.lastSuccessAt === 'string' ? raw.lastSuccessAt : undefined,
    lastLatencyMs: typeof raw.last_latency_ms === 'number' ? raw.last_latency_ms : typeof raw.lastLatencyMs === 'number' ? raw.lastLatencyMs : undefined,
    lastError: typeof raw.last_error === 'string' ? raw.last_error : typeof raw.lastError === 'string' ? raw.lastError : undefined,
    lastResponsePreview:
      typeof raw.last_response_preview === 'string'
        ? raw.last_response_preview
        : typeof raw.lastResponsePreview === 'string'
          ? raw.lastResponsePreview
          : undefined,
    lastProbeMode: typeof raw.last_probe_mode === 'string' ? raw.last_probe_mode : typeof raw.lastProbeMode === 'string' ? raw.lastProbeMode : undefined,
    consecutiveFailures: Number(raw.consecutive_failures ?? raw.consecutiveFailures ?? 0),
  };
}

function adaptMonitoringSnapshot(raw: Record<string, unknown>): AIMonitoringSnapshot {
  return {
    settings: adaptMonitoringSettings((raw.settings ?? {}) as Record<string, unknown>),
    summary: adaptMonitoringSummary((raw.summary ?? {}) as Record<string, unknown>),
    isChecking: Boolean(raw.is_checking ?? raw.isChecking ?? false),
    items: toArray<Record<string, unknown>>(raw.items).map(adaptMonitoringItem),
  };
}

async function fetchProviderTemplates(): Promise<AIProviderTemplate[]> {
  try {
    const response = await http.get<ApiEnvelope<Record<string, unknown>[]>>('/ai/providers/templates');
    const list = toArray<Record<string, unknown>>(response.data?.data);
    if (list.length === 0) return fallbackProviderTemplates;
    return list.map(adaptProviderTemplate);
  } catch {
    return fallbackProviderTemplates;
  }
}

function buildWorkspace(providerTemplates: AIProviderTemplate[]): AIAdminWorkspace {
  return getAIWorkspace(providerTemplates);
}

function toModelRecord(
  workspace: AIAdminWorkspace,
  providerTemplates: AIProviderTemplate[],
  key: string,
): AIModelRecord {
  const meta = workspace.modelMetas[key];
  const capability = workspace.capabilities[key] ?? inferCapability(meta.provider, meta.modelName);
  const pricing = workspace.pricingRules[key] ?? inferPricing(meta.provider, meta.modelName);
  const usage = workspace.usage[key] ?? inferUsage(meta.provider, meta.modelName);

  const providerTemplate = providerTemplates.find((item) => item.provider === meta.provider);

  return {
    key,
    meta: {
      ...meta,
      providerName: providerTemplate?.name ?? meta.providerName,
      defaultBaseUrl: meta.defaultBaseUrl ?? providerTemplate?.defaultBaseUrl,
      defaultEndpoint: meta.defaultEndpoint ?? providerTemplate?.defaultEndpoint,
    },
    capability,
    pricing,
    usage,
  };
}

async function loadContext() {
  const providerTemplates = await fetchProviderTemplates();
  const workspace = buildWorkspace(providerTemplates);
  return { providerTemplates, workspace };
}

export const aiAdminApi = {
  async getProviders(): Promise<AIProviderInsight[]> {
    const { providerTemplates, workspace } = await loadContext();

    return providerTemplates.map((template) => {
      const modelKeys = Object.keys(workspace.modelMetas).filter(
        (key) => workspace.modelMetas[key].provider === template.provider,
      );
      const records = modelKeys.map((key) => toModelRecord(workspace, providerTemplates, key));

      return {
        ...template,
        modelCount: records.length,
        activeModelCount: records.filter((record) => record.meta.isActive).length,
        imageModelCount: records.filter(
          (record) => record.capability.supportVision || record.capability.supportImageGeneration,
        ).length,
        thinkingModelCount: records.filter((record) => record.capability.supportThinking).length,
      };
    });
  },

  async getProvider(provider: string) {
    const providers = await this.getProviders();
    return providers.find((item) => item.provider === provider) ?? null;
  },

  async getModels(): Promise<AIModelRecord[]> {
    const { providerTemplates, workspace } = await loadContext();
    return Object.keys(workspace.modelMetas)
      .sort((left, right) =>
        workspace.modelMetas[left].displayName.localeCompare(workspace.modelMetas[right].displayName),
      )
      .map((key) => toModelRecord(workspace, providerTemplates, key));
  },

  async getModel(provider: string, modelName: string): Promise<AIModelRecord | null> {
    const { providerTemplates, workspace } = await loadContext();
    const key = getModelKey(provider, modelName);
    if (!workspace.modelMetas[key]) return null;
    return toModelRecord(workspace, providerTemplates, key);
  },

  async createModel(payload: CreateAIModelPayload): Promise<AIModelRecord> {
    const { providerTemplates, workspace } = await loadContext();
    const key = getModelKey(payload.provider, payload.modelName);
    const provider = providerTemplates.find((item) => item.provider === payload.provider);
    const timestamp = new Date().toISOString();

    workspace.modelMetas[key] = {
      provider: payload.provider,
      providerName: provider?.name ?? payload.provider,
      modelName: payload.modelName,
      displayName: payload.displayName,
      description: payload.description,
      defaultBaseUrl: provider?.defaultBaseUrl,
      defaultEndpoint: provider?.defaultEndpoint,
      isActive: payload.isActive,
      isSystemPreset: false,
      isFeatured: false,
      releaseStage: payload.releaseStage,
      source: 'custom',
      tags: payload.tags ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    workspace.capabilities[key] =
      provider?.modelCapabilities?.[payload.modelName] ||
      inferCapability(payload.provider, payload.modelName);
    workspace.pricingRules[key] = inferPricing(payload.provider, payload.modelName);
    workspace.usage[key] = inferUsage(payload.provider, payload.modelName);
    saveAIWorkspace(workspace);

    return toModelRecord(workspace, providerTemplates, key);
  },

  async updateModelMeta(provider: string, modelName: string, payload: UpdateAIModelMetaPayload) {
    const { providerTemplates, workspace } = await loadContext();
    const key = getModelKey(provider, modelName);
    const current = workspace.modelMetas[key];
    if (!current) throw new Error('Model not found');

    workspace.modelMetas[key] = {
      ...current,
      ...payload,
      updatedAt: new Date().toISOString(),
    };
    saveAIWorkspace(workspace);

    return toModelRecord(workspace, providerTemplates, key);
  },

  async updateCapability(provider: string, modelName: string, capability: AIModelCapability) {
    const { providerTemplates, workspace } = await loadContext();
    const key = getModelKey(provider, modelName);
    workspace.capabilities[key] = capability;
    saveAIWorkspace(workspace);
    return toModelRecord(workspace, providerTemplates, key);
  },

  async updatePricing(provider: string, modelName: string, pricing: AIModelPricingRule) {
    const { providerTemplates, workspace } = await loadContext();
    const key = getModelKey(provider, modelName);
    workspace.pricingRules[key] = {
      ...pricing,
      updatedAt: new Date().toISOString(),
    };
    saveAIWorkspace(workspace);
    return toModelRecord(workspace, providerTemplates, key);
  },

  async getPricingRules(): Promise<AIModelPricingRule[]> {
    const { workspace } = await loadContext();
    return Object.values(workspace.pricingRules).sort((left, right) =>
      `${left.provider}/${left.modelName}`.localeCompare(`${right.provider}/${right.modelName}`),
    );
  },

  async getUsageOverview(): Promise<AIUsageSnapshot[]> {
    const { workspace } = await loadContext();
    return Object.values(workspace.usage).sort((left, right) => right.requestCount - left.requestCount);
  },

  async getMonitoringSnapshot(): Promise<AIMonitoringSnapshot> {
    const response = await http.get<ApiEnvelope<Record<string, unknown>>>('/admin/ai-models/monitoring');
    return adaptMonitoringSnapshot((response.data?.data ?? {}) as Record<string, unknown>);
  },

  async updateMonitoringSettings(autoEnabled: boolean): Promise<AIMonitoringSettings> {
    const response = await http.put<ApiEnvelope<Record<string, unknown>>>('/admin/ai-models/monitoring/settings', {
      auto_enabled: autoEnabled,
    });
    return adaptMonitoringSettings((response.data?.data ?? {}) as Record<string, unknown>);
  },

  async runMonitoringCheckAll(): Promise<AIMonitoringSnapshot> {
    const response = await http.post<ApiEnvelope<Record<string, unknown>>>(
      '/admin/ai-models/monitoring/check-all',
      {},
      { timeout: 180000 },
    );
    return adaptMonitoringSnapshot((response.data?.data ?? {}) as Record<string, unknown>);
  },

  async runMonitoringCheckModel(id: number): Promise<AIMonitoringItem> {
    const response = await http.post<ApiEnvelope<Record<string, unknown>>>(
      `/admin/ai-models/monitoring/models/${id}/check`,
      {},
      { timeout: 30000 },
    );
    return adaptMonitoringItem((response.data?.data ?? {}) as Record<string, unknown>);
  },
};

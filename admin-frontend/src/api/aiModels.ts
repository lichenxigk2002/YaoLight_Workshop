import axios, { type AxiosResponse } from 'axios';
import http from '@/api/http';
import { formatDateTime as formatLocalizedDateTime } from '@/i18n/runtime';
import type {
  AIAdminModel,
  AIModelCapabilityConfig,
  AIMonitoringRecord,
  AIMonitoringSettings,
  AIMonitoringSnapshot,
  AIMonitoringSummary,
  AIModelPricingRule,
  AIModelsOverview,
  AIProviderDetail,
  AIProviderSummary,
  AIUsageRecord,
  CreateAIModelInput,
  PricingData,
  PricingType,
} from '@/types/aiModels';

interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

interface ListPayload<T> {
  list: T[];
  total: number;
}

interface BackendProviderSummary {
  provider: string;
  name: string;
  description: string;
  is_active: boolean;
  models_count: number;
  active_models_count: number;
  default_currency: string;
  capabilities: string[];
}

interface BackendPricingRule {
  id: number;
  managed_model_id?: number;
  provider: string;
  model_name: string;
  pricing_type: PricingType;
  currency: string;
  is_active: boolean;
  version: number;
  effective_at: string;
  expired_at?: string | null;
  description?: string | null;
  pricing_data: PricingData;
}

interface BackendUsageSummary {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  last_used_at?: string | null;
}

interface BackendProviderTemplateOption {
  provider: string;
  name: string;
  description?: string | null;
}

interface BackendCapabilityConfig extends AIModelCapabilityConfig {
  id?: number;
  provider?: string;
  model_name?: string;
  display_name?: string;
  is_active?: boolean;
}

interface BackendAdminModel {
  id: number;
  provider: string;
  model_name: string;
  display_name: string;
  description?: string | null;
  status: 'active' | 'disabled' | 'testing';
  is_active: boolean;
  sort_order: number;
  capability?: BackendCapabilityConfig | null;
  current_pricing?: BackendPricingRule | null;
  usage_summary: BackendUsageSummary;
}

interface BackendProviderDetail extends BackendProviderSummary {
  models: BackendAdminModel[];
}

interface BackendUsageRecord {
  managed_model_id?: number | null;
  provider: string;
  model_name: string;
  display_name: string;
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  total_cost: number;
  last_used_at?: string | null;
}

interface BackendMonitoringSettings {
  auto_enabled: boolean;
  probe_interval_minutes: number;
}

interface BackendMonitoringSummary {
  total_models: number;
  healthy_models: number;
  failed_models: number;
  unknown_models: number;
  not_configured_models: number;
  unsupported_models: number;
}

interface BackendMonitoringRecord {
  managed_model_id: number;
  provider: string;
  model_name: string;
  display_name: string;
  status: string;
  is_active: boolean;
  probe_status: 'unknown' | 'healthy' | 'failed' | 'not_configured';
  last_checked_at?: string | null;
  last_success_at?: string | null;
  last_latency_ms?: number | null;
  last_error?: string | null;
  last_response_preview?: string | null;
  last_probe_mode?: string | null;
  consecutive_failures: number;
}

interface BackendMonitoringSnapshot {
  settings: BackendMonitoringSettings;
  summary: BackendMonitoringSummary;
  is_checking: boolean;
  items: BackendMonitoringRecord[];
}

const EMPTY_CAPABILITY: AIModelCapabilityConfig = {
  support_temperature: false,
  support_max_tokens: false,
  support_top_p: false,
  support_stream: false,
  support_thinking: false,
  support_thinking_level: false,
  support_enable_thinking: false,
  support_frequency_penalty: false,
  support_presence_penalty: false,
  support_stop_sequences: false,
  support_vision: false,
  support_image_generation: false,
  max_tokens_limit: 0,
};

function toId(value: string | number | null | undefined): string {
  return value == null ? '' : String(value);
}

function trimText(value?: string | null): string {
  return value?.trim() ?? '';
}

function deriveProviderStatus(item: Pick<BackendProviderSummary, 'is_active' | 'models_count' | 'active_models_count'>) {
  if (!item.is_active) {
    return 'disabled' as const;
  }
  if (item.models_count > item.active_models_count) {
    return 'degraded' as const;
  }
  return 'healthy' as const;
}

function mapCapability(capability?: BackendCapabilityConfig | null): AIModelCapabilityConfig {
  if (!capability) {
    return EMPTY_CAPABILITY;
  }

  return {
    support_temperature: capability.support_temperature,
    support_max_tokens: capability.support_max_tokens,
    support_top_p: capability.support_top_p,
    support_stream: capability.support_stream,
    support_thinking: capability.support_thinking,
    support_thinking_level: capability.support_thinking_level,
    support_enable_thinking: capability.support_enable_thinking,
    support_frequency_penalty: capability.support_frequency_penalty,
    support_presence_penalty: capability.support_presence_penalty,
    support_stop_sequences: capability.support_stop_sequences,
    support_vision: capability.support_vision,
    support_image_generation: capability.support_image_generation,
    max_tokens_limit: capability.max_tokens_limit,
    capability_options: capability.capability_options,
  };
}

function mapPricingRule(rule: BackendPricingRule): AIModelPricingRule {
  return {
    id: toId(rule.id),
    managed_model_id: toId(rule.managed_model_id),
    provider: rule.provider,
    model_name: rule.model_name,
    pricing_type: rule.pricing_type,
    currency: rule.currency,
    is_active: rule.is_active,
    version: rule.version,
    effective_at: formatDateInput(rule.effective_at),
    expired_at: rule.expired_at ? formatDateInput(rule.expired_at) : null,
    description: trimText(rule.description),
    pricing_data: rule.pricing_data ?? {},
  };
}

function mapModel(model: BackendAdminModel): AIAdminModel {
  return {
    id: toId(model.id),
    provider: model.provider,
    model_name: model.model_name,
    display_name: model.display_name,
    status: model.status,
    is_active: model.is_active,
    sort_order: model.sort_order ?? 0,
    description: trimText(model.description),
    capability: mapCapability(model.capability),
    current_pricing: model.current_pricing ? mapPricingRule(model.current_pricing) : null,
    usage: {
      requests: model.usage_summary?.requests ?? 0,
      prompt_tokens: model.usage_summary?.prompt_tokens ?? 0,
      completion_tokens: model.usage_summary?.completion_tokens ?? 0,
      tokens: model.usage_summary?.total_tokens ?? 0,
      total_cost: model.usage_summary?.total_cost ?? 0,
      success_rate: null,
      avg_latency_ms: null,
      last_used_at: model.usage_summary?.last_used_at ? formatDateTime(model.usage_summary.last_used_at) : null,
    },
  };
}

function mapProvider(provider: BackendProviderSummary): AIProviderSummary {
  return {
    key: provider.provider,
    name: provider.name,
    description: provider.description,
    status: deriveProviderStatus(provider),
    models_count: provider.models_count,
    active_models_count: provider.active_models_count,
    default_currency: provider.default_currency,
    capabilities: provider.capabilities ?? [],
  };
}

function mapProviderDetail(detail: BackendProviderDetail): AIProviderDetail {
  return {
    ...mapProvider(detail),
    models: (detail.models ?? []).map(mapModel),
  };
}

function mapUsage(record: BackendUsageRecord): AIUsageRecord {
  const modelId = record.managed_model_id != null ? String(record.managed_model_id) : undefined;

  return {
    id: `${record.provider}:${record.model_name}`,
    provider: record.provider,
    model_id: modelId,
    model_name: record.model_name,
    display_name: record.display_name,
    requests: record.requests,
    input_tokens: record.prompt_tokens,
    output_tokens: record.completion_tokens,
    total_tokens: record.total_tokens,
    total_cost: record.total_cost,
    success_rate: null,
    avg_latency_ms: null,
    window_label: null,
    last_used_at: record.last_used_at ? formatDateTime(record.last_used_at) : null,
  };
}

function mapMonitoringSettings(settings: BackendMonitoringSettings): AIMonitoringSettings {
  return {
    auto_enabled: settings.auto_enabled,
    probe_interval_minutes: settings.probe_interval_minutes,
  };
}

function mapMonitoringSummary(summary: BackendMonitoringSummary): AIMonitoringSummary {
  return {
    total_models: summary.total_models,
    healthy_models: summary.healthy_models,
    failed_models: summary.failed_models,
    unknown_models: summary.unknown_models,
    not_configured_models: summary.not_configured_models,
    unsupported_models: summary.unsupported_models,
  };
}

function mapMonitoringRecord(record: BackendMonitoringRecord): AIMonitoringRecord {
  return {
    managed_model_id: String(record.managed_model_id),
    provider: record.provider,
    model_name: record.model_name,
    display_name: record.display_name,
    status: record.status,
    is_active: record.is_active,
    probe_status: record.probe_status,
    last_checked_at: record.last_checked_at ?? null,
    last_success_at: record.last_success_at ?? null,
    last_latency_ms: record.last_latency_ms ?? null,
    last_error: record.last_error ?? null,
    last_response_preview: record.last_response_preview ?? null,
    last_probe_mode: record.last_probe_mode ?? null,
    consecutive_failures: record.consecutive_failures ?? 0,
  };
}

function mapMonitoringSnapshot(snapshot: BackendMonitoringSnapshot): AIMonitoringSnapshot {
  return {
    settings: mapMonitoringSettings(snapshot.settings),
    summary: mapMonitoringSummary(snapshot.summary),
    is_checking: snapshot.is_checking,
    items: (snapshot.items ?? []).map(mapMonitoringRecord),
  };
}

function formatDateTime(value: string): string {
  return formatLocalizedDateTime(value, undefined, value);
}

function formatDateInput(value: string): string {
  if (!value) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 10);
}

function serializeDateInput(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
}

async function unwrap<T>(promise: Promise<AxiosResponse<ApiEnvelope<T>>>): Promise<T> {
  const response = await promise;
  return response.data.data;
}

function isNotFoundError(error: unknown) {
  return axios.isAxiosError(error) && error.response?.status === 404;
}

export function buildDefaultPricingData(type: PricingType): PricingData {
  switch (type) {
    case 'unified':
      return { price_per_million_tokens: 0 };
    case 'separate':
      return { input_price_per_million: 0, output_price_per_million: 0 };
    case 'multi_type':
      return {
        input_price_per_million: 0,
        output_price_per_million: 0,
        audio_price_per_million: 0,
        cache_read_price_per_million: 0,
        cache_write_price_per_million: 0,
        audio_cache_read_price_per_million: 0,
      };
    case 'segmented':
      return {
        segments: [{ context_length_limit: 128000, input_price_per_million: 0, output_price_per_million: 0 }],
      };
    case 'per_image':
      return { text_to_image_price: 0, image_to_image_price: 0, price_per_image: 0 };
    default:
      return {};
  }
}

export async function getAIModelsOverview(): Promise<AIModelsOverview> {
  const [providers, models, rules, usage] = await Promise.all([
    getAIProviders(),
    getAIModels(),
    getAIPricingRules(),
    getAIUsage(),
  ]);

  return {
    providers_count: providers.length,
    models_count: models.length,
    active_rules_count: rules.filter((rule) => rule.is_active).length,
    monthly_cost: usage.reduce((sum, item) => sum + item.total_cost, 0),
  };
}

export async function getAIOverviewModels(): Promise<AIAdminModel[]> {
  const payload = await unwrap(
    http.get<ApiEnvelope<ListPayload<BackendAdminModel>>>('/admin/ai-models'),
  );
  return payload.list.map(mapModel);
}

export async function getAIProviders(): Promise<AIProviderSummary[]> {
  const payload = await unwrap(http.get<ApiEnvelope<BackendProviderSummary[]>>('/admin/ai-models/providers'));
  return payload.map(mapProvider);
}

export async function getAIProviderOptions(): Promise<Array<{ key: string; name: string }>> {
  const payload = await unwrap(
    http.get<ApiEnvelope<BackendProviderTemplateOption[]>>('/ai/providers/templates'),
  );
  return payload.map((item) => ({
    key: item.provider,
    name: item.name,
  }));
}

export async function getAIProvider(providerKey: string): Promise<AIProviderDetail | null> {
  try {
    const payload = await unwrap(
      http.get<ApiEnvelope<BackendProviderDetail>>(`/admin/ai-models/providers/${providerKey}`),
    );
    return mapProviderDetail(payload);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function getAIModels(): Promise<AIAdminModel[]> {
  const payload = await unwrap(
    http.get<ApiEnvelope<ListPayload<BackendAdminModel>>>('/admin/ai-models/models'),
  );
  return payload.list.map(mapModel);
}

export async function getAIModel(id: string): Promise<AIAdminModel | null> {
  try {
    const payload = await unwrap(http.get<ApiEnvelope<BackendAdminModel>>(`/admin/ai-models/models/${id}`));
    return mapModel(payload);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export interface UpdateAIModelPayload {
  display_name?: string;
  description?: string | null;
  status?: string;
  is_active?: boolean;
  sort_order?: number;
}

export async function updateAIModel(id: string, payload: UpdateAIModelPayload): Promise<AIAdminModel> {
  const body: Record<string, unknown> = {};
  if (payload.display_name !== undefined) body.display_name = payload.display_name;
  if (payload.description !== undefined) body.description = payload.description;
  if (payload.status !== undefined) body.status = payload.status;
  if (payload.is_active !== undefined) body.is_active = payload.is_active;
  if (payload.sort_order !== undefined) body.sort_order = payload.sort_order;
  const result = await unwrap(
    http.put<ApiEnvelope<BackendAdminModel>>(`/admin/ai-models/models/${id}`, body),
  );
  return mapModel(result);
}

export async function createAIModel(input: CreateAIModelInput): Promise<AIAdminModel> {
  const payload = await unwrap(
    http.post<ApiEnvelope<BackendAdminModel>>('/admin/ai-models/models', {
      provider: input.provider,
      model_name: input.model_name,
      display_name: input.display_name,
      is_active: input.is_active,
      description: input.description?.trim() || null,
    }),
  );
  return mapModel(payload);
}

export async function deleteAIModel(id: string): Promise<void> {
  await unwrap(http.delete<ApiEnvelope<{ id: number }>>(`/admin/ai-models/models/${id}`));
}

export async function getAIModelCapability(id: string): Promise<AIModelCapabilityConfig | null> {
  try {
    const payload = await unwrap(
      http.get<ApiEnvelope<BackendCapabilityConfig>>(`/admin/ai-models/models/${id}/capability`),
    );
    return mapCapability(payload);
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }
    throw error;
  }
}

export async function saveAIModelCapability(
  id: string,
  payload: AIModelCapabilityConfig,
): Promise<AIModelCapabilityConfig> {
  const result = await unwrap(
    http.put<ApiEnvelope<BackendCapabilityConfig>>(`/admin/ai-models/models/${id}/capability`, payload),
  );
  return mapCapability(result);
}

export async function getAIModelPricing(id: string): Promise<AIModelPricingRule[]> {
  const payload = await unwrap(
    http.get<ApiEnvelope<ListPayload<BackendPricingRule>>>(`/admin/ai-models/models/${id}/pricing`),
  );
  return payload.list.map(mapPricingRule);
}

export async function saveAIModelPricing(id: string, payload: AIModelPricingRule): Promise<AIModelPricingRule> {
  const result = await unwrap(
    http.put<ApiEnvelope<BackendPricingRule>>(`/admin/ai-models/models/${id}/pricing`, {
      pricing_type: payload.pricing_type,
      currency: payload.currency,
      is_active: payload.is_active,
      effective_at: serializeDateInput(payload.effective_at),
      expired_at: serializeDateInput(payload.expired_at),
      description: payload.description?.trim() || null,
      pricing_data: payload.pricing_data,
    }),
  );
  return mapPricingRule(result);
}

export async function getAIPricingRules(): Promise<AIModelPricingRule[]> {
  const payload = await unwrap(
    http.get<ApiEnvelope<ListPayload<BackendPricingRule>>>('/admin/ai-models/pricing-rules'),
  );
  return payload.list.map(mapPricingRule);
}

export async function getAIUsage(modelId?: string): Promise<AIUsageRecord[]> {
  const payload = await unwrap(
    http.get<ApiEnvelope<ListPayload<BackendUsageRecord>>>('/admin/ai-models/usage', {
      params: modelId ? { model_id: modelId } : undefined,
    }),
  );
  return payload.list.map(mapUsage);
}

export async function getAIMonitoringSnapshot(): Promise<AIMonitoringSnapshot> {
  const payload = await unwrap(
    http.get<ApiEnvelope<BackendMonitoringSnapshot>>('/admin/ai-models/monitoring'),
  );
  return mapMonitoringSnapshot(payload);
}

export async function updateAIMonitoringSettings(autoEnabled: boolean): Promise<AIMonitoringSettings> {
  const payload = await unwrap(
    http.put<ApiEnvelope<BackendMonitoringSettings>>('/admin/ai-models/monitoring/settings', {
      auto_enabled: autoEnabled,
    }),
  );
  return mapMonitoringSettings(payload);
}

export async function runAIMonitoringCheckAll(): Promise<AIMonitoringSnapshot> {
  const payload = await unwrap(
    http.post<ApiEnvelope<BackendMonitoringSnapshot>>(
      '/admin/ai-models/monitoring/check-all',
      {},
      { timeout: 180000 },
    ),
  );
  return mapMonitoringSnapshot(payload);
}

export async function runAIModelMonitoringCheck(id: string): Promise<AIMonitoringRecord> {
  const payload = await unwrap(
    http.post<ApiEnvelope<BackendMonitoringRecord>>(
      `/admin/ai-models/monitoring/models/${id}/check`,
      {},
      { timeout: 30000 },
    ),
  );
  return mapMonitoringRecord(payload);
}

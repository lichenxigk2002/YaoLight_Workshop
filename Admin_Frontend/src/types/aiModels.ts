export type PricingType = 'unified' | 'separate' | 'multi_type' | 'segmented' | 'per_image';

export type ProviderStatus = 'healthy' | 'degraded' | 'disabled';
export type ModelStatus = 'active' | 'disabled' | 'testing';

export interface UnifiedPricingData {
  price_per_million_tokens?: number;
}

export interface SeparatePricingData {
  input_price_per_million?: number;
  output_price_per_million?: number;
}

export interface MultiTypePricingData {
  input_price_per_million?: number;
  output_price_per_million?: number;
  audio_price_per_million?: number;
  cache_read_price_per_million?: number;
  cache_write_price_per_million?: number;
  audio_cache_read_price_per_million?: number;
}

export interface SegmentedPricingTier {
  context_length_limit?: number | null;
  input_price_per_million?: number;
  output_price_per_million?: number;
  cache_read_price_per_million?: number;
}

export interface SegmentedPricingData {
  segments: SegmentedPricingTier[];
}

export interface PerImagePricingData {
  text_to_image_price?: number;
  image_to_image_price?: number;
  price_per_image?: number;
}

export type PricingData =
  | UnifiedPricingData
  | SeparatePricingData
  | MultiTypePricingData
  | SegmentedPricingData
  | PerImagePricingData;

export interface AIProviderSummary {
  key: string;
  name: string;
  description: string;
  status: ProviderStatus;
  models_count: number;
  active_models_count: number;
  default_currency: string;
  capabilities: string[];
}

export interface AIModelCapabilityConfig {
  support_temperature: boolean;
  support_max_tokens: boolean;
  support_top_p: boolean;
  support_stream: boolean;
  support_thinking: boolean;
  support_thinking_level: boolean;
  support_enable_thinking: boolean;
  support_frequency_penalty: boolean;
  support_presence_penalty: boolean;
  support_stop_sequences: boolean;
  support_vision: boolean;
  support_image_generation: boolean;
  max_tokens_limit: number;
  capability_options?: Record<string, unknown>;
}

export interface AIModelPricingRule {
  id: string;
  managed_model_id?: string;
  provider: string;
  model_name: string;
  pricing_type: PricingType;
  currency: string;
  is_active: boolean;
  version: number;
  effective_at: string;
  expired_at?: string | null;
  description?: string;
  pricing_data: PricingData;
}

export interface AIUsageSummary {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  tokens: number;
  total_cost: number;
  success_rate?: number | null;
  avg_latency_ms?: number | null;
  last_used_at?: string | null;
}

export interface AIAdminModel {
  id: string;
  provider: string;
  model_name: string;
  display_name: string;
  status: ModelStatus;
  is_active: boolean;
  description: string;
  capability: AIModelCapabilityConfig;
  current_pricing?: AIModelPricingRule | null;
  usage: AIUsageSummary;
}

export interface AIProviderDetail extends AIProviderSummary {
  models: AIAdminModel[];
}

export interface AIUsageRecord {
  id: string;
  provider: string;
  model_id?: string;
  model_name: string;
  display_name: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  total_cost: number;
  success_rate?: number | null;
  avg_latency_ms?: number | null;
  window_label?: string | null;
  last_used_at?: string | null;
}

export interface AIModelsOverview {
  providers_count: number;
  models_count: number;
  active_rules_count: number;
  monthly_cost: number;
}

export interface CreateAIModelInput {
  provider: string;
  model_name: string;
  display_name: string;
  is_active: boolean;
  description?: string;
}

export const PRICING_TYPE_OPTIONS: Array<{ label: string; value: PricingType }> = [
  { label: '统一单价', value: 'unified' },
  { label: '输入输出分离', value: 'separate' },
  { label: '多类型计费', value: 'multi_type' },
  { label: '分段计费', value: 'segmented' },
  { label: '按图片计费', value: 'per_image' },
];

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  unified: '统一单价',
  separate: '输入输出分离',
  multi_type: '多类型计费',
  segmented: '分段计费',
  per_image: '按图片计费',
};

export const PROVIDER_LABELS: Record<string, string> = {
  gpt: 'OpenAI / GPT',
  openai: 'OpenAI',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  qwen: '通义千问',
  zhipuai: '智谱 AI',
  doubao: '豆包',
  spark: '讯飞星火',
  hunyuan: '腾讯混元',
  gemini: 'Gemini',
  grok: 'Grok',
  moonshot: 'Moonshot',
};

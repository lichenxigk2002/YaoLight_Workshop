export type PricingType = 'unified' | 'separate' | 'multi_type' | 'segmented' | 'per_image';
export type ReleaseStage = 'ga' | 'beta' | 'preview' | 'deprecated';
export type ModelSource = 'provider_catalog' | 'custom';

export interface AIModelCapability {
  supportTemperature?: boolean;
  supportMaxTokens?: boolean;
  supportTopP?: boolean;
  supportStream?: boolean;
  supportThinking?: boolean;
  supportThinkingLevel?: boolean;
  supportEnableThinking?: boolean;
  supportFrequencyPenalty?: boolean;
  supportPresencePenalty?: boolean;
  supportStopSequences?: boolean;
  supportVision?: boolean;
  supportImageGeneration?: boolean;
  maxTokensLimit?: number;
  capabilityOptions?: Record<string, unknown>;
  displayName?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface AIProviderTemplate {
  provider: string;
  name: string;
  description?: string;
  icon?: string;
  defaultBaseUrl?: string;
  defaultEndpoint?: string;
  supportedModels: string[];
  defaultConfig: Record<string, unknown>;
  modelCapabilities?: Record<string, AIModelCapability>;
  isActive?: boolean;
}

export interface AIModelPricingRule {
  provider: string;
  modelName: string;
  pricingType: PricingType;
  currency: string;
  pricingData: Record<string, unknown>;
  isActive: boolean;
  description?: string;
  version: number;
  updatedAt: string;
}

export interface AIUsageSnapshot {
  provider: string;
  modelName: string;
  requestCount: number;
  totalTokens: number;
  estimatedRevenue: number;
  errorRate: number;
  avgLatencyMs: number;
  last7dRequests: number;
  last30dCost: number;
  updatedAt: string;
}

export interface AIAdminModelMeta {
  provider: string;
  providerName: string;
  modelName: string;
  displayName: string;
  description?: string;
  defaultBaseUrl?: string;
  defaultEndpoint?: string;
  isActive: boolean;
  isSystemPreset: boolean;
  isFeatured: boolean;
  releaseStage: ReleaseStage;
  source: ModelSource;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AIModelRecord {
  key: string;
  meta: AIAdminModelMeta;
  capability: AIModelCapability;
  pricing: AIModelPricingRule;
  usage: AIUsageSnapshot;
}

export interface AIProviderInsight extends AIProviderTemplate {
  modelCount: number;
  activeModelCount: number;
  imageModelCount: number;
  thinkingModelCount: number;
}

export interface AIAdminWorkspace {
  version: number;
  modelMetas: Record<string, AIAdminModelMeta>;
  capabilities: Record<string, AIModelCapability>;
  pricingRules: Record<string, AIModelPricingRule>;
  usage: Record<string, AIUsageSnapshot>;
}

export interface CreateAIModelPayload {
  provider: string;
  modelName: string;
  displayName: string;
  description?: string;
  releaseStage: ReleaseStage;
  tags?: string[];
  isActive: boolean;
}

export interface UpdateAIModelMetaPayload {
  displayName?: string;
  description?: string;
  releaseStage?: ReleaseStage;
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
}

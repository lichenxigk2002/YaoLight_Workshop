import type {
  AIModelCapability,
  AIModelPricingRule,
  AIProviderTemplate,
  AIUsageSnapshot,
  PricingType,
  ReleaseStage,
} from './types';

const now = new Date().toISOString();

export const fallbackProviderTemplates: AIProviderTemplate[] = [
  {
    provider: 'openai',
    name: 'OpenAI',
    description: 'Default OpenAI-compatible provider template.',
    defaultBaseUrl: 'https://api.openai.com/v1',
    supportedModels: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
    defaultConfig: { temperature: 0.7, maxTokens: 4096 },
    modelCapabilities: {
      'gpt-4o': { supportVision: true, supportStream: true, supportThinking: true, isActive: true, displayName: 'GPT-4o' },
      'gpt-4o-mini': { supportVision: true, supportStream: true, isActive: true, displayName: 'GPT-4o mini' },
      'o3-mini': { supportStream: true, supportThinking: true, supportThinkingLevel: true, isActive: true, displayName: 'o3-mini' },
    },
    isActive: true,
  },
  {
    provider: 'deepseek',
    name: 'DeepSeek',
    description: 'DeepSeek provider template.',
    defaultBaseUrl: 'https://api.deepseek.com',
    supportedModels: ['deepseek-chat', 'deepseek-reasoner'],
    defaultConfig: { temperature: 0.7, maxTokens: 2000 },
    modelCapabilities: {
      'deepseek-chat': { supportStream: true, supportThinking: false, isActive: true, displayName: 'DeepSeek Chat' },
      'deepseek-reasoner': { supportStream: true, supportThinking: true, supportThinkingLevel: true, isActive: true, displayName: 'DeepSeek Reasoner' },
    },
    isActive: true,
  },
  {
    provider: 'qwen',
    name: 'Qwen',
    description: 'Alibaba Qwen models through compatible endpoints.',
    defaultBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    supportedModels: ['qwen-plus', 'qwen-max', 'qwen-vl-max'],
    defaultConfig: { temperature: 0.7, maxTokens: 2000 },
    modelCapabilities: {
      'qwen-plus': { supportStream: true, isActive: true, displayName: 'Qwen Plus' },
      'qwen-max': { supportStream: true, supportThinking: true, isActive: true, displayName: 'Qwen Max' },
      'qwen-vl-max': { supportStream: true, supportVision: true, isActive: true, displayName: 'Qwen VL Max' },
    },
    isActive: true,
  },
];

function hashValue(input: string) {
  return input.split('').reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);
}

export function inferReleaseStage(modelName: string): ReleaseStage {
  const lowerName = modelName.toLowerCase();
  if (lowerName.includes('preview')) return 'preview';
  if (lowerName.includes('beta')) return 'beta';
  if (lowerName.includes('legacy') || lowerName.includes('deprecated')) return 'deprecated';
  return 'ga';
}

export function inferCapability(provider: string, modelName: string): AIModelCapability {
  const lowerName = `${provider} ${modelName}`.toLowerCase();
  const image = lowerName.includes('image') || lowerName.includes('vl') || lowerName.includes('vision');
  const thinking = lowerName.includes('reason') || lowerName.includes('think') || lowerName.includes('o1') || lowerName.includes('o3');
  return {
    supportTemperature: true,
    supportMaxTokens: true,
    supportTopP: true,
    supportStream: true,
    supportThinking: thinking,
    supportThinkingLevel: thinking,
    supportEnableThinking: thinking,
    supportFrequencyPenalty: !thinking,
    supportPresencePenalty: !thinking,
    supportStopSequences: true,
    supportVision: image,
    supportImageGeneration: lowerName.includes('image'),
    maxTokensLimit: thinking ? 65536 : 32768,
    capabilityOptions: image ? { visionModes: ['image_url', 'file_upload'] } : {},
    displayName: modelName,
    sortOrder: 0,
    isActive: true,
  };
}

function buildUnifiedPricing(provider: string, modelName: string) {
  const factor = (hashValue(`${provider}-${modelName}`) % 18) + 4;
  return { price_per_million_tokens: Number((factor / 10).toFixed(2)) };
}

function buildSeparatePricing(provider: string, modelName: string) {
  const base = (hashValue(`${provider}-${modelName}`) % 14) + 6;
  return {
    input_price_per_million: Number((base / 20).toFixed(2)),
    output_price_per_million: Number((base / 10).toFixed(2)),
  };
}

export function inferPricingType(modelName: string): PricingType {
  const lowerName = modelName.toLowerCase();
  if (lowerName.includes('image')) return 'per_image';
  if (lowerName.includes('reason') || lowerName.includes('o3')) return 'multi_type';
  if (lowerName.includes('128k') || lowerName.includes('long')) return 'segmented';
  if (lowerName.includes('mini') || lowerName.includes('plus')) return 'separate';
  return 'unified';
}

export function inferPricing(provider: string, modelName: string): AIModelPricingRule {
  const pricingType = inferPricingType(modelName);
  let pricingData: Record<string, unknown>;

  if (pricingType === 'per_image') {
    pricingData = {
      text_to_image_price: 0.12,
      image_to_image_price: 0.18,
      price_per_image: 0.15,
    };
  } else if (pricingType === 'multi_type') {
    pricingData = {
      input_price_per_million: 0.55,
      output_price_per_million: 2.2,
      audio_price_per_million: 1.4,
      cache_read_price_per_million: 0.08,
      cache_write_price_per_million: 0.12,
      audio_cache_read_price_per_million: 0.1,
    };
  } else if (pricingType === 'segmented') {
    pricingData = {
      segments: [
        {
          context_length_limit: 128000,
          input_price_per_million: 0.4,
          output_price_per_million: 1.2,
          cache_read_price_per_million: 0.05,
        },
        {
          context_length_limit: null,
          input_price_per_million: 0.75,
          output_price_per_million: 2.1,
          cache_read_price_per_million: 0.08,
        },
      ],
    };
  } else if (pricingType === 'separate') {
    pricingData = buildSeparatePricing(provider, modelName);
  } else {
    pricingData = buildUnifiedPricing(provider, modelName);
  }

  return {
    provider,
    modelName,
    pricingType,
    currency: 'USD',
    pricingData,
    isActive: true,
    description: `Seed pricing rule for ${modelName}.`,
    version: 1,
    updatedAt: now,
  };
}

export function inferUsage(provider: string, modelName: string): AIUsageSnapshot {
  const seed = hashValue(`${provider}:${modelName}`);
  return {
    provider,
    modelName,
    requestCount: 2000 + (seed % 9000),
    totalTokens: 800000 + seed * 9,
    estimatedRevenue: Number(((seed % 4000) / 10 + 120).toFixed(2)),
    errorRate: Number((((seed % 40) + 2) / 100).toFixed(2)),
    avgLatencyMs: 450 + (seed % 1200),
    last7dRequests: 400 + (seed % 1600),
    last30dCost: Number(((seed % 1200) / 10 + 60).toFixed(2)),
    updatedAt: now,
  };
}

import type { AIModelCapability, AIModelPricingRule, PricingType, ReleaseStage } from './types';

function formatLabel(value: string) {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' ? value : fallback;
}

export function decodeParam(value: string | undefined) {
  return value ? decodeURIComponent(value) : '';
}

export function buildProviderPath(provider: string) {
  return `/ai-models/providers/${encodeURIComponent(provider)}`;
}

export function buildModelPath(
  provider: string,
  modelName: string,
  section: 'overview' | 'capability' | 'pricing' = 'overview',
) {
  const base = `/ai-models/models/${encodeURIComponent(provider)}/${encodeURIComponent(modelName)}`;
  if (section === 'overview') return base;
  return `${base}/${section}`;
}

export function formatPricingType(type: PricingType) {
  return formatLabel(type);
}

export function formatReleaseStage(stage: ReleaseStage) {
  return stage.toUpperCase();
}

export function getCapabilityLabels(capability: AIModelCapability) {
  const labels: string[] = [];
  if (capability.supportThinking) labels.push('Thinking');
  if (capability.supportVision) labels.push('Vision');
  if (capability.supportImageGeneration) labels.push('Image');
  if (capability.supportStream) labels.push('Streaming');
  if (capability.supportTopP) labels.push('Top P');
  if (capability.supportStopSequences) labels.push('Stops');
  return labels;
}

export function getPricingSummary(pricing: AIModelPricingRule) {
  const data = pricing.pricingData;

  if (pricing.pricingType === 'unified') {
    return `${toNumber(data.price_per_million_tokens)} / 1M tokens`;
  }

  if (pricing.pricingType === 'separate') {
    return `in ${toNumber(data.input_price_per_million)} / out ${toNumber(data.output_price_per_million)}`;
  }

  if (pricing.pricingType === 'multi_type') {
    return `multi channel pricing with cache and audio`; 
  }

  if (pricing.pricingType === 'segmented') {
    const segments = Array.isArray(data.segments) ? data.segments.length : 0;
    return `${segments} context segments`;
  }

  return `image ${toNumber(data.price_per_image)} each`;
}

export function formatMoney(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

import type { ModelStatus, PricingType, ProviderStatus } from '@/types/aiModels';

type Translator = (key: string, params?: Record<string, string | number>) => string;

function resolveOrFallback(t: Translator, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function getAIProviderLabel(provider: string, t: Translator) {
  return resolveOrFallback(t, `aiModels.providerLabels.${provider}`, provider);
}

export function getAIPricingTypeLabel(type: PricingType, t: Translator) {
  return resolveOrFallback(t, `aiModels.pricingTypeLabels.${type}`, type);
}

export function getAIPricingTypeOptions(t: Translator): Array<{ label: string; value: PricingType }> {
  return [
    { label: getAIPricingTypeLabel('unified', t), value: 'unified' },
    { label: getAIPricingTypeLabel('separate', t), value: 'separate' },
    { label: getAIPricingTypeLabel('multi_type', t), value: 'multi_type' },
    { label: getAIPricingTypeLabel('segmented', t), value: 'segmented' },
    { label: getAIPricingTypeLabel('per_image', t), value: 'per_image' },
  ];
}

export function getAIModelStatusLabel(status: ModelStatus | string, t: Translator) {
  return resolveOrFallback(t, `aiModels.modelStatus.${status}`, status);
}

export function getAIProviderStatusLabel(status: ProviderStatus | string, t: Translator) {
  return resolveOrFallback(t, `aiProviders.status${status[0]?.toUpperCase() ?? ''}${status.slice(1)}`, status);
}

import type { PricingType, ReleaseStage } from './types';

export const AI_MODULE_TABS = [
  { key: 'providers', label: 'Providers', path: '/ai-models/providers' },
  { key: 'models', label: 'Models', path: '/ai-models/models' },
  { key: 'pricing', label: 'Pricing Rules', path: '/ai-models/pricing-rules' },
  { key: 'usage', label: 'Usage', path: '/ai-models/usage' },
  { key: 'monitoring', label: 'Monitoring', path: '/ai-models/monitoring' },
];

export const MODEL_DETAIL_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'capability', label: 'Capability' },
  { key: 'pricing', label: 'Pricing' },
];

export const PRICING_TYPE_OPTIONS: Array<{ label: string; value: PricingType }> = [
  { label: 'Unified', value: 'unified' },
  { label: 'Separate', value: 'separate' },
  { label: 'Multi type', value: 'multi_type' },
  { label: 'Segmented', value: 'segmented' },
  { label: 'Per image', value: 'per_image' },
];

export const RELEASE_STAGE_OPTIONS: Array<{ label: string; value: ReleaseStage }> = [
  { label: 'GA', value: 'ga' },
  { label: 'Beta', value: 'beta' },
  { label: 'Preview', value: 'preview' },
  { label: 'Deprecated', value: 'deprecated' },
];

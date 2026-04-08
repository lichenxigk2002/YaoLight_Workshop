import {
  fallbackProviderTemplates,
  inferCapability,
  inferPricing,
  inferReleaseStage,
  inferUsage,
} from './mock';
import type {
  AIAdminModelMeta,
  AIAdminWorkspace,
  AIProviderTemplate,
} from './types';

const AI_WORKSPACE_KEY = 'yaolight_admin_ai_workspace';
const AI_WORKSPACE_VERSION = 1;

function getKey(provider: string, modelName: string) {
  return `${provider.toLowerCase()}::${modelName}`;
}

function readWorkspace(): AIAdminWorkspace | null {
  const raw = localStorage.getItem(AI_WORKSPACE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as AIAdminWorkspace;
    if (parsed.version !== AI_WORKSPACE_VERSION) return null;
    return parsed;
  } catch {
    localStorage.removeItem(AI_WORKSPACE_KEY);
    return null;
  }
}

function writeWorkspace(workspace: AIAdminWorkspace) {
  localStorage.setItem(AI_WORKSPACE_KEY, JSON.stringify(workspace));
}

function buildSeedModelMeta(
  providerTemplate: AIProviderTemplate,
  modelName: string,
  isSystemPreset: boolean,
): AIAdminModelMeta {
  const capability = providerTemplate.modelCapabilities?.[modelName];
  const timestamp = new Date().toISOString();

  return {
    provider: providerTemplate.provider,
    providerName: providerTemplate.name,
    modelName,
    displayName: capability?.displayName || modelName,
    description: providerTemplate.description,
    defaultBaseUrl: providerTemplate.defaultBaseUrl,
    defaultEndpoint: providerTemplate.defaultEndpoint,
    isActive: capability?.isActive ?? true,
    isSystemPreset,
    isFeatured: isSystemPreset,
    releaseStage: inferReleaseStage(modelName),
    source: 'provider_catalog',
    tags: [providerTemplate.provider],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function buildSeedWorkspace(providerTemplates: AIProviderTemplate[]): AIAdminWorkspace {
  const workspace: AIAdminWorkspace = {
    version: AI_WORKSPACE_VERSION,
    modelMetas: {},
    capabilities: {},
    pricingRules: {},
    usage: {},
  };

  const templates = providerTemplates.length > 0 ? providerTemplates : fallbackProviderTemplates;

  templates.forEach((providerTemplate) => {
    providerTemplate.supportedModels.forEach((modelName) => {
      const key = getKey(providerTemplate.provider, modelName);
      workspace.modelMetas[key] = buildSeedModelMeta(providerTemplate, modelName, true);
      workspace.capabilities[key] =
        providerTemplate.modelCapabilities?.[modelName] ||
        inferCapability(providerTemplate.provider, modelName);
      workspace.pricingRules[key] = inferPricing(providerTemplate.provider, modelName);
      workspace.usage[key] = inferUsage(providerTemplate.provider, modelName);
    });
  });

  return workspace;
}

export function getModelKey(provider: string, modelName: string) {
  return getKey(provider, modelName);
}

export function getAIWorkspace(providerTemplates: AIProviderTemplate[]): AIAdminWorkspace {
  const seed = buildSeedWorkspace(providerTemplates);
  const stored = readWorkspace();

  if (!stored) {
    writeWorkspace(seed);
    return seed;
  }

  const merged: AIAdminWorkspace = {
    version: AI_WORKSPACE_VERSION,
    modelMetas: { ...seed.modelMetas, ...stored.modelMetas },
    capabilities: { ...seed.capabilities, ...stored.capabilities },
    pricingRules: { ...seed.pricingRules, ...stored.pricingRules },
    usage: { ...seed.usage, ...stored.usage },
  };

  writeWorkspace(merged);
  return merged;
}

export function saveAIWorkspace(workspace: AIAdminWorkspace) {
  writeWorkspace(workspace);
}

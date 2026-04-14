import { useI18n } from '@/i18n';
import type { PermissionOption } from './types';

const PERMISSION_RESOURCE_LABEL_KEY_MAP: Record<string, string> = {
  dashboard: 'menu.dashboard',
  users: 'menu.users',
  permissions: 'menu.permissions',
  workflow_templates: 'menu.workflowTemplates',
  node_types: 'menu.nodeTypes',
  knowledge_base: 'menu.knowledgeBase',
  crawler_rules: 'menu.crawlerRules',
  app_logs: 'menu.appLogs',
  system_configs: 'menu.systemConfigs',
  operation_logs: 'menu.operationLogs',
  'ai_models.overview': 'menu.aiModelsOverview',
  'ai_models.providers': 'menu.aiModelsProviders',
  'ai_models.models': 'menu.aiModelsModels',
  'ai_models.pricing_rules': 'menu.aiModelsPricingRules',
  'ai_models.usage': 'menu.aiModelsUsage',
  'tasks.overview': 'menu.tasksOverview',
  'tasks.running': 'menu.tasksRunning',
  'tasks.failures': 'menu.tasksFailures',
  'billing.overview': 'menu.billingOverview',
  'billing.quota_recovery': 'menu.billingQuotaRecovery',
  'billing.admin_grant': 'menu.billingAdminGrant',
  'billing.orders': 'menu.billingOrders',
  'billing.ledger': 'menu.billingLedger',
  'billing.token_ledger': 'menu.billingTokenLedger',
  'notifications.send': 'menu.notificationsSend',
  'notifications.jobs': 'menu.notificationsJobs',
  'notifications.log': 'menu.notificationsLog',
  'notifications.analytics': 'menu.notificationsAnalytics',
  'notifications.templates': 'menu.notificationsTemplates',
};

function formatResourceKey(resourceKey: string) {
  return resourceKey.replace(/\./g, ' / ').replace(/_/g, ' ');
}

export function usePermissionLabels() {
  const { t } = useI18n();

  const getResourceLabel = (resourceKey: string): string => {
    const i18nKey = PERMISSION_RESOURCE_LABEL_KEY_MAP[resourceKey];
    return i18nKey ? t(i18nKey as 'menu.dashboard') : formatResourceKey(resourceKey);
  };

  const getPermissionActionLabel = (action: PermissionOption['action']) => {
    return action === 'view' ? t('permissions.matrix.actionView') : t('permissions.matrix.actionEdit');
  };

  return { getResourceLabel, getPermissionActionLabel };
}

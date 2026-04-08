import type { AdminMenuItem } from '@/types/menu';

const PATH_TO_RESOURCE: Array<[RegExp, string]> = [
  [/^\/$/, 'dashboard'],
  [/^\/permissions(\/roles|\/admins|\/matrix)?$/, 'permissions'],
  [/^\/users$/, 'users'],
  [/^\/workflow-templates$/, 'workflow_templates'],
  [/^\/workflow-templates\/\d+\/canvas$/, 'workflow_templates.canvas'],
  [/^\/node-types$/, 'node_types'],
  [/^\/knowledge-base$/, 'knowledge_base'],
  [/^\/crawler-rules$/, 'crawler_rules'],
  [/^\/ai-models$/, 'ai_models.overview'],
  [/^\/ai-models\/providers(?:\/[^/]+)?$/, 'ai_models.providers'],
  [/^\/ai-models\/models(?:\/new)?$/, 'ai_models.models'],
  [/^\/ai-models\/models\/\d+(?:\/capability|\/pricing)?$/, 'ai_models.models'],
  [/^\/ai-models\/pricing-rules$/, 'ai_models.pricing_rules'],
  [/^\/ai-models\/usage$/, 'ai_models.usage'],
  [/^\/ai-models\/monitoring$/, 'ai_models.overview'],
  [/^\/tasks$/, 'tasks.overview'],
  [/^\/tasks\/running$/, 'tasks.running'],
  [/^\/tasks\/failures$/, 'tasks.failures'],
  [/^\/tasks\/\d+(?:\/nodes|\/logs)?$/, 'tasks.detail'],
  [/^\/billing$/, 'billing.overview'],
  [/^\/billing\/quota-recovery$/, 'billing.quota_recovery'],
  [/^\/billing\/admin-grant$/, 'billing.admin_grant'],
  [/^\/billing\/orders$/, 'billing.orders'],
  [/^\/billing\/ledger$/, 'billing.ledger'],
  [/^\/billing\/token-ledger$/, 'billing.token_ledger'],
  [/^\/system-configs$/, 'system_configs'],
  [/^\/notifications\/send$/, 'notifications.send'],
  [/^\/notifications\/jobs$/, 'notifications.jobs'],
  [/^\/notifications\/log$/, 'notifications.log'],
  [/^\/notifications\/analytics$/, 'notifications.analytics'],
  [/^\/notifications\/templates$/, 'notifications.templates'],
  [/^\/operation-logs$/, 'operation_logs'],
];

export function hasPermission(permissions: string[], permission: string) {
  return permissions.includes(permission);
}

export function canViewResource(permissions: string[], resourceKey?: string) {
  if (!resourceKey) return true;
  return hasPermission(permissions, `${resourceKey}:view`);
}

export function canEditResource(permissions: string[], resourceKey?: string) {
  if (!resourceKey) return false;
  return hasPermission(permissions, `${resourceKey}:edit`);
}

export function resolveResourceFromPath(pathname: string) {
  return PATH_TO_RESOURCE.find(([pattern]) => pattern.test(pathname))?.[1] ?? null;
}

export function filterMenuByPermissions(items: AdminMenuItem[], permissions: string[]): AdminMenuItem[] {
  return items
    .map((item) => ({
      ...item,
      children: item.children ? filterMenuByPermissions(item.children, permissions) : undefined,
    }))
    .filter((item) => {
      if (item.children) {
        return item.children.length > 0;
      }
      return canViewResource(permissions, item.permissionKey);
    });
}

export function findFirstAccessiblePath(items: AdminMenuItem[]): string | null {
  for (const item of items) {
    if (item.children?.length) {
      const nested = findFirstAccessiblePath(item.children);
      if (nested) {
        return nested;
      }
    }
    if (item.path) {
      return item.path;
    }
  }
  return null;
}

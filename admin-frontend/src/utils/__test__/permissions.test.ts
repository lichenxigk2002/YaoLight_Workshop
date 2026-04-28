import { describe, expect, it } from 'vitest';
import type { AdminMenuItem } from '@/types/menu';
import {
  canEditResource,
  canViewResource,
  filterMenuByPermissions,
  findFirstAccessiblePath,
  hasPermission,
  resolveResourceFromPath,
} from '../permissions';

describe('admin permissions', () => {
  it('checks exact view and edit permissions', () => {
    const permissions = ['users:view', 'tasks.overview:view', 'users:edit'];

    expect(hasPermission(permissions, 'users:view')).toBe(true);
    expect(canViewResource(permissions, 'users')).toBe(true);
    expect(canViewResource(permissions, 'tasks.running')).toBe(false);
    expect(canEditResource(permissions, 'users')).toBe(true);
    expect(canEditResource(permissions, 'tasks.overview')).toBe(false);
  });

  it('resolves resources from admin paths', () => {
    expect(resolveResourceFromPath('/')).toBe('dashboard');
    expect(resolveResourceFromPath('/users')).toBe('users');
    expect(resolveResourceFromPath('/workflow-templates/12/canvas')).toBe('workflow_templates.canvas');
    expect(resolveResourceFromPath('/ai-models/models/99/pricing')).toBe('ai_models.models');
    expect(resolveResourceFromPath('/tasks/42/logs')).toBe('tasks.detail');
    expect(resolveResourceFromPath('/unknown')).toBeNull();
  });

  it('filters nested menus and keeps parents with visible children', () => {
    const items: AdminMenuItem[] = [
      { key: 'users', path: '/users', label: 'Users', permissionKey: 'users' },
      {
        key: 'tasks',
        label: 'Tasks',
        children: [
          { key: 'overview', path: '/tasks', label: 'Overview', permissionKey: 'tasks.overview' },
          { key: 'running', path: '/tasks/running', label: 'Running', permissionKey: 'tasks.running' },
        ],
      },
      { key: 'logs', path: '/logs/app', label: 'Logs', permissionKey: 'app_logs' },
    ];

    const filtered = filterMenuByPermissions(items, ['tasks.running:view']);

    expect(filtered).toHaveLength(1);
    expect(filtered[0].key).toBe('tasks');
    expect(filtered[0].children?.map((item) => item.key)).toEqual(['running']);
    expect(findFirstAccessiblePath(filtered)).toBe('/tasks/running');
  });

  it('returns null when no accessible path exists', () => {
    expect(findFirstAccessiblePath([])).toBeNull();
  });
});

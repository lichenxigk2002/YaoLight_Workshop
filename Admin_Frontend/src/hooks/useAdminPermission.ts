import { getAdminSession } from '@/utils/storage';
import { canEditResource, canViewResource } from '@/utils/permissions';

export function useAdminPermission(resourceKey: string) {
  const permissions = getAdminSession()?.user.permissions ?? [];

  return {
    canView: canViewResource(permissions, resourceKey),
    canEdit: canEditResource(permissions, resourceKey),
    permissions,
  };
}

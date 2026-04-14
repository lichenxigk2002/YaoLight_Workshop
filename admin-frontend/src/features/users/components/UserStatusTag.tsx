import { Tag } from 'antd';
import { useI18n } from '@/i18n';
import type { AdminUserStatus } from '../types';

interface UserStatusTagProps {
  status: AdminUserStatus;
}

export default function UserStatusTag({ status }: UserStatusTagProps) {
  const { t } = useI18n();

  const statusMap: Record<AdminUserStatus, { color: string; label: string }> = {
    active: { color: 'success', label: t('users.statusActive') },
    inactive: { color: 'default', label: t('users.statusInactive') },
    suspended: { color: 'error', label: t('users.statusSuspended') },
  };

  const meta = statusMap[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

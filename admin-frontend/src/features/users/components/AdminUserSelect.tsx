import { Avatar, Select, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getAdminUsers } from '../api';
import type { AdminUserListItem } from '../types';
import { useI18n } from '@/i18n';
import styles from './AdminUserSelect.module.scss';

interface AdminUserSelectProps {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

interface UserOption {
  label: string;
  value: string;
  user: AdminUserListItem;
}

function mergeUsers(current: AdminUserListItem[], incoming: AdminUserListItem[]) {
  const map = new Map<number, AdminUserListItem>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function renderUserOption(user: AdminUserListItem, t: (key: string) => string) {
  return (
    <div className={styles.option}>
      <Avatar size={34} src={user.avatar_url ?? undefined}>
        {user.username.slice(0, 1).toUpperCase()}
      </Avatar>
      <div className={styles.body}>
        <div className={styles.topRow}>
          <span className={styles.name}>{user.username}</span>
          <span className={styles.role}>{user.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}</span>
        </div>
        <div className={styles.meta}>
          <span>ID {user.id}</span>
          <span>NO.{user.user_no}</span>
          <span>{user.email || t('common.noEmail')}</span>
        </div>
      </div>
    </div>
  );
}

export default function AdminUserSelect({
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
}: AdminUserSelectProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);

  const options = useMemo<UserOption[]>(
    () =>
      users.map((user) => ({
        label: `${user.username} · ID ${user.id} · NO.${user.user_no}`,
        value: String(user.id),
        user,
      })),
    [users],
  );

  async function loadUsers(keyword?: string) {
    setLoading(true);
    try {
      const data = await getAdminUsers({
        page: 1,
        page_size: 20,
        keyword: keyword?.trim() || undefined,
      });
      setUsers((current) => mergeUsers(current, Array.isArray(data.list) ? data.list : []));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('billing.formUserSearchFailed'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <Select<string, UserOption>
      showSearch
      allowClear={allowClear}
      filterOption={false}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      loading={loading}
      listHeight={320}
      optionLabelProp="label"
      notFoundContent={loading ? <Spin size="small" /> : t('common.empty')}
      onFocus={() => void loadUsers()}
      onSearch={(keyword) => {
        void loadUsers(keyword);
      }}
      onChange={(nextValue) => {
        onChange?.(nextValue);
      }}
      options={options}
      optionRender={(option) => renderUserOption((option.data as UserOption).user, t)}
    />
  );
}

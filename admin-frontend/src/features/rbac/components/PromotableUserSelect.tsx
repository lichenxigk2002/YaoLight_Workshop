import { Avatar, Select, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { getRbacPromotableUsers } from '../api';
import type { PromotableUserOption } from '../types';
import { useI18n } from '@/i18n';

interface PromotableUserSelectProps {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

interface UserOption {
  label: string;
  value: string;
  user: PromotableUserOption;
}

function mergeUsers(current: PromotableUserOption[], incoming: PromotableUserOption[]) {
  const map = new Map<number, PromotableUserOption>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function renderUserOption(user: PromotableUserOption) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <Avatar size={34} src={user.avatar_url ?? undefined}>
        {user.username.slice(0, 1).toUpperCase()}
      </Avatar>
      <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: 'var(--admin-ink)' }}>{user.username}</span>
          <span style={{ fontSize: 12, color: 'var(--admin-ink-soft)' }}>#{user.user_no}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12, color: 'var(--admin-ink-soft)' }}>
          <span>ID {user.id}</span>
          <span>{user.email}</span>
          <span>{user.status}</span>
        </div>
      </div>
    </div>
  );
}

export default function PromotableUserSelect({
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
}: PromotableUserSelectProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<PromotableUserOption[]>([]);

  const options = useMemo<UserOption[]>(
    () =>
      users.map((user) => ({
        label: `${user.username} / ID ${user.id} / NO.${user.user_no}`,
        value: String(user.id),
        user,
      })),
    [users],
  );

  async function loadUsers(keyword?: string) {
    setLoading(true);
    try {
      const list = await getRbacPromotableUsers(keyword);
      setUsers((current) => mergeUsers(current, Array.isArray(list) ? list : []));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载可提权用户失败');
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
      optionRender={(option) => renderUserOption((option.data as UserOption).user)}
    />
  );
}

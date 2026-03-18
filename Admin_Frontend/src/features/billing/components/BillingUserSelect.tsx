import { Avatar, Select, Spin, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/i18n';
import { searchBillingUsers } from '../api/quota';
import type { BillingUserOption } from '../types';
import styles from '@/features/users/components/AdminUserSelect.module.scss';

interface BillingUserSelectProps {
  value?: string;
  onChange?: (value?: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
}

interface UserOption {
  label: string;
  value: string;
  user: BillingUserOption;
}

function mergeUsers(current: BillingUserOption[], incoming: BillingUserOption[]) {
  const map = new Map<number, BillingUserOption>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function renderUserOption(user: BillingUserOption, t: (key: string) => string) {
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

export default function BillingUserSelect({
  value,
  onChange,
  placeholder,
  disabled,
  allowClear = true,
}: BillingUserSelectProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<BillingUserOption[]>([]);

  const options = useMemo<UserOption[]>(
    () =>
      users.map((user) => ({
        label: `${user.username} | ID ${user.id} | NO.${user.user_no}`,
        value: String(user.id),
        user,
      })),
    [users],
  );

  async function loadUsers(keyword?: string) {
    setLoading(true);
    try {
      const data = await searchBillingUsers(keyword, 20);
      setUsers((current) => mergeUsers(current, data));
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

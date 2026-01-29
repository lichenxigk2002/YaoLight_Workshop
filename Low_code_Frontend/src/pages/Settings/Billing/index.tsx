import { useEffect, useMemo, useState } from 'react';
import { App, Card, Table } from 'antd';
import { useTranslation } from 'react-i18next';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { ProviderIcon, StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import type { TokenTransaction } from '@/types/user';
import styles from './index.module.scss';

export default function Billing() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<TokenTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    const refreshUserInfo = async () => {
      try {
        const userData = await userApi.getCurrentUser();
        setUser(userData);
      } catch (error: any) {
        message.error(error.message || t('profile.getUserInfoFailed'));
      }
    };
    refreshUserInfo();
  }, [message, setUser, t]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const res = await userApi.getTokenTransactions({ page, pageSize });
        setList(Array.isArray(res?.list) ? res.list : []);
        setTotal(typeof res?.total === 'number' ? res.total : 0);
      } catch (error: any) {
        message.error(error.message || t('common.operationFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [message, page, pageSize, t]);

  const columns = useMemo(
    () => [
      {
        title: t('settings.time'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (value: string) => {
          const d = value ? new Date(value) : null;
          return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : '-';
        },
      },
      {
        title: t('settings.model'),
        key: 'model',
        render: (_: any, record: TokenTransaction) => {
          const provider = record.provider || '';
          const model = record.model_name || '';
          const text = provider && model ? `${provider} / ${model}` : model || provider || '-';
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {provider && <ProviderIcon provider={provider} size={20} />}
              <span>{text}</span>
            </div>
          );
        },
      },
      {
        title: t('settings.stardustConsumption'),
        dataIndex: 'amount',
        key: 'amount',
        width: 120,
        render: (value: number) => {
          // amount 可能是负数（扣除），显示时取绝对值
          const absValue = typeof value === 'number' ? Math.abs(value) : 0;
          return absValue.toLocaleString();
        },
      },
      {
        title: t('settings.amount'),
        key: 'cost',
        width: 160,
        render: (_: any, record: TokenTransaction) => {
          const cost = typeof record.cost === 'number' ? record.cost : 0;
          const currency = record.currency || 'USD';
          if (!cost) return <span>-</span>;
          return (
            <span>
              {cost.toFixed(6)} {currency}
            </span>
          );
        },
      },
    ],
    [t]
  );

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.billing')} />

      <Card className={styles.summary}>
        {t('settings.currentStardustBalance')}: {user?.token_balance?.toLocaleString() || 0} <StardustIcon size={16} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
      </Card>

      <Table
        rowKey="id"
        columns={columns as any}
        dataSource={list}
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          pageSizeOptions: [10, 20, 50, 100],
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </div>
  );
}


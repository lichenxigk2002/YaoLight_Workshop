import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Segmented, Space, Table, Tabs } from 'antd';
import { useTranslation } from 'react-i18next';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { ProviderIcon, StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import type { BillPeriod, BillSummary, TokenTransaction } from '@/types/user';
import styles from './index.module.scss';

type TabKey = 'transactions' | 'bill';

/** 根据周期与当前时间得到账单请求参数 */
function getBillParamsForNow(period: BillPeriod): { period: BillPeriod; year: number; month: number; day?: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  if (period === 'day') {
    return { period: 'day', year, month, day };
  }
  if (period === 'month') {
    return { period: 'month', year, month };
  }
  if (period === 'quarter') {
    const quarter = Math.ceil(month / 3);
    return { period: 'quarter', year, month: quarter };
  }
  return { period: 'year', year, month: 1 };
}

/** 将 BillSummary 的 start_at/end_at 转为 YYYY-MM-DD 供流水接口使用 */
function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

export default function Billing() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();

  const [activeTab, setActiveTab] = useState<TabKey>('transactions');
  const [billPeriod, setBillPeriod] = useState<BillPeriod>('month');
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [billLoading, setBillLoading] = useState(false);
  const [exportPdfLoading, setExportPdfLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<TokenTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dateFilter, setDateFilter] = useState<{ start_date?: string; end_date?: string }>({});

  useEffect(() => {
    const refreshUserInfo = async () => {
      try {
        const userData = await userApi.getCurrentUser();
        setUser(userData);
      } catch (error: unknown) {
        const err = error as { message?: string };
        message.error(err?.message || t('profile.getUserInfoFailed'));
      }
    };
    refreshUserInfo();
  }, [message, setUser, t]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const res = await userApi.getTokenTransactions({
          page,
          pageSize,
          ...dateFilter,
        });
        setList(Array.isArray(res?.list) ? res.list : []);
        setTotal(typeof res?.total === 'number' ? res.total : 0);
      } catch (error: unknown) {
        const err = error as { message?: string };
        message.error(err?.message || t('common.operationFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [message, page, pageSize, dateFilter, t]);

  useEffect(() => {
    if (activeTab !== 'bill') return;
    const fetchBillSummary = async () => {
      try {
        setBillLoading(true);
        const params = getBillParamsForNow(billPeriod);
        const res = await userApi.getBillSummary(params);
        setBillSummary(res ?? null);
      } catch (error: unknown) {
        const err = error as { message?: string };
        message.error(err?.message || t('settings.getBillSummaryFailed'));
        setBillSummary(null);
      } finally {
        setBillLoading(false);
      }
    };
    fetchBillSummary();
  }, [activeTab, billPeriod, message, t]);

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
        render: (_: unknown, record: TokenTransaction) => {
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
          const absValue = typeof value === 'number' ? Math.abs(value) : 0;
          return absValue.toLocaleString();
        },
      },
      {
        title: t('settings.amount'),
        key: 'cost',
        width: 160,
        render: (_: unknown, record: TokenTransaction) => {
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

  const handleViewTransactionsInPeriod = () => {
    if (!billSummary) return;
    setDateFilter({
      start_date: toDateOnly(billSummary.start_at),
      end_date: toDateOnly(billSummary.end_at),
    });
    setPage(1);
    setActiveTab('transactions');
  };

  const handleExportPDF = async () => {
    try {
      setExportPdfLoading(true);
      const params = getBillParamsForNow(billPeriod);
      await userApi.exportBillPDF(params);
      message.success(t('settings.exportBillPDFSuccess'));
    } catch (error: unknown) {
      const err = error as { message?: string };
      message.error(err?.message || t('settings.exportBillPDFFailed'));
    } finally {
      setExportPdfLoading(false);
    }
  };

  const billPeriodOptions = [
    { label: t('settings.billDay'), value: 'day' as BillPeriod },
    { label: t('settings.billMonth'), value: 'month' as BillPeriod },
    { label: t('settings.billQuarter'), value: 'quarter' as BillPeriod },
    { label: t('settings.billYear'), value: 'year' as BillPeriod },
  ];

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.billing')} />

      <Card className={styles.summary}>
        {t('settings.currentStardustBalance')}: {user?.token_balance?.toLocaleString() ?? 0}{' '}
        <StardustIcon size={16} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
      </Card>

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as TabKey)}
        items={[
          {
            key: 'transactions',
            label: t('settings.transactions'),
            children: (
              <>
                {(dateFilter.start_date || dateFilter.end_date) && (
                  <div className={styles.filterHint}>
                    {dateFilter.start_date} ~ {dateFilter.end_date}
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setDateFilter({});
                        setPage(1);
                      }}
                    >
                      {t('settings.clearDateFilter')}
                    </a>
                  </div>
                )}
                <Table
                  rowKey="id"
                  columns={columns as never[]}
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
                      if (nextPageSize) setPageSize(nextPageSize);
                    },
                  }}
                />
              </>
            ),
          },
          {
            key: 'bill',
            label: t('settings.bill'),
            children: (
              <>
                <div className={styles.billPeriodBar}>
                  <span className={styles.billPeriodLabel}>{t('settings.currentPeriod')}:</span>
                  <Segmented
                    options={billPeriodOptions}
                    value={billPeriod}
                    onChange={(v) => setBillPeriod(v as BillPeriod)}
                  />
                </div>
                {billLoading ? (
                  <Card loading className={styles.billSummaryCard} />
                ) : billSummary ? (
                  <>
                    <div className={styles.billSummaryGrid}>
                      <Card size="small" className={styles.billSummaryCard}>
                        <div className={styles.billSummaryLabel}>{t('settings.income')}</div>
                        <div className={styles.billSummaryValueIncome}>
                          +{billSummary.total_income.toLocaleString()}
                        </div>
                      </Card>
                      <Card size="small" className={styles.billSummaryCard}>
                        <div className={styles.billSummaryLabel}>{t('settings.expense')}</div>
                        <div className={styles.billSummaryValueExpense}>
                          -{billSummary.total_expense.toLocaleString()}
                        </div>
                      </Card>
                      <Card size="small" className={styles.billSummaryCard}>
                        <div className={styles.billSummaryLabel}>{t('settings.transactionCount')}</div>
                        <div className={styles.billSummaryValue}>{billSummary.transaction_count}</div>
                      </Card>
                    </div>
                    <div className={styles.billRange}>
                      {toDateOnly(billSummary.start_at)} ~ {toDateOnly(billSummary.end_at)}
                    </div>
                    <Space wrap className={styles.billActions}>
                      <Button type="primary" loading={exportPdfLoading} onClick={handleExportPDF}>
                        {t('settings.exportBillPDF')}
                      </Button>
                      <a
                        href="#"
                        className={styles.viewTransactionsLink}
                        onClick={(e) => {
                          e.preventDefault();
                          handleViewTransactionsInPeriod();
                        }}
                      >
                        {t('settings.viewTransactionsInPeriod')}
                      </a>
                    </Space>
                  </>
                ) : (
                  <Card className={styles.billSummaryCard}>
                    <div className={styles.billEmpty}>{t('settings.getBillSummaryFailed')}</div>
                  </Card>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Radio, Table } from 'antd';
import type { DatePickerProps } from 'antd';
import type { RadioChangeEvent } from 'antd/es/radio';
import { useTranslation } from 'react-i18next';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { ProviderIcon, StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import type {
  BillPeriod,
  BillSummary,
  BillSummaryParams,
  TokenTransaction,
} from '@/types/user';
import styles from './index.module.scss';

export default function Billing() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [billLoading, setBillLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [list, setList] = useState<TokenTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [period, setPeriod] = useState<BillPeriod>('month');
  const [billDate, setBillDate] = useState<Dayjs>(() => dayjs());
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<string | undefined>();
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>();

  const buildBillParams = useCallback(
    (p: BillPeriod, d: Dayjs): BillSummaryParams => {
      const year = d.year();
      const month = d.month() + 1;
      const day = d.date();

      if (p === 'day') {
        return { period: 'day', year, month, day };
      }
      if (p === 'month') {
        return { period: 'month', year, month };
      }
      if (p === 'quarter') {
        const quarter = Math.floor((month - 1) / 3) + 1;
        return { period: 'quarter', year, month: quarter };
      }
      return { period: 'year', year };
    },
    []
  );

  const billParams = useMemo(
    () => buildBillParams(period, billDate),
    [billDate, buildBillParams, period]
  );

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
    const fetchBillSummary = async () => {
      try {
        setBillLoading(true);
        const sum = await userApi.getBillSummary(billParams);
        setBillSummary(sum);
      } catch (error: any) {
        message.error(error?.message || t('settings.getBillSummaryFailed'));
        setBillSummary(null);
      } finally {
        setBillLoading(false);
      }
    };
    fetchBillSummary();
  }, [billParams, message, t]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
        const res = await userApi.getTokenTransactions({
          page,
          pageSize,
          start_date: filterStartDate,
          end_date: filterEndDate,
        });
        setList(Array.isArray(res?.list) ? res.list : []);
        setTotal(typeof res?.total === 'number' ? res.total : 0);
      } catch (error: any) {
        message.error(error.message || t('common.operationFailed'));
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [filterEndDate, filterStartDate, message, page, pageSize, t]);

  const formatDateRangeLabel = (start?: string, end?: string) => {
    if (!start && !end) return '-';
    const fmt = (v?: string) => (v ? v.slice(0, 10) : '-');
    return `${fmt(start)} ~ ${fmt(end)}`;
  };

  const handleApplyPeriodToTransactions = () => {
    if (!billSummary) return;
    const start = billSummary.start_at?.slice(0, 10);
    const end = billSummary.end_at?.slice(0, 10);
    setFilterStartDate(start);
    setFilterEndDate(end);
    setPage(1);
  };

  const handleClearFilter = () => {
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    setPage(1);
  };

  const handleExportPDF = async () => {
    try {
      setExporting(true);
      await userApi.exportBillPDF(billParams);
      message.success(t('settings.exportBillPDFSuccess'));
    } catch (error: any) {
      message.error(error?.message || t('settings.exportBillPDFFailed'));
    } finally {
      setExporting(false);
    }
  };

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

  const pickerMode = useMemo<Exclude<DatePickerProps['picker'], undefined>>(
    () => {
      if (period === 'day') return 'date';
      if (period === 'month') return 'month';
      if (period === 'quarter') return 'quarter';
      return 'year';
    },
    [period]
  );

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.billing')} />

      <Card className={styles.summary}>
        {t('settings.currentStardustBalance')}: {user?.token_balance?.toLocaleString() || 0} <StardustIcon size={16} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
      </Card>

      <div className={styles.billPeriodBar}>
        <span className={styles.billPeriodLabel}>{t('settings.bill')}</span>
        <Radio.Group
          size="small"
          value={period}
          onChange={(e: RadioChangeEvent) => setPeriod(e.target.value as BillPeriod)}
          disabled={billLoading}
        >
          <Radio.Button value="day">{t('settings.billDay')}</Radio.Button>
          <Radio.Button value="month">{t('settings.billMonth')}</Radio.Button>
          <Radio.Button value="quarter">{t('settings.billQuarter')}</Radio.Button>
          <Radio.Button value="year">{t('settings.billYear')}</Radio.Button>
        </Radio.Group>
        <DatePicker
          size="small"
          allowClear={false}
          picker={pickerMode}
          value={billDate}
          onChange={(value: Dayjs | null) => {
            setBillDate(value || dayjs());
          }}
          disabled={billLoading}
        />
        <Button size="small" onClick={handleApplyPeriodToTransactions} disabled={!billSummary}>
          {t('settings.viewTransactionsInPeriod')}
        </Button>
        <Button size="small" type="link" onClick={handleExportPDF} loading={exporting}>
          {t('settings.exportBillPDF')}
        </Button>
      </div>

      {billSummary && (
        <>
          <div className={styles.billRange}>
            {t('settings.currentPeriod')}: {formatDateRangeLabel(billSummary.start_at, billSummary.end_at)}
          </div>
          <div className={styles.billSummaryGrid}>
            <Card size="small" className={styles.billSummaryCard}>
              <div className={styles.billSummaryLabel}>{t('settings.income')}</div>
              <div className={styles.billSummaryValueIncome}>
                +{(billSummary.total_income ?? 0).toLocaleString()}
              </div>
            </Card>
            <Card size="small" className={styles.billSummaryCard}>
              <div className={styles.billSummaryLabel}>{t('settings.expense')}</div>
              <div className={styles.billSummaryValueExpense}>
                -{(billSummary.total_expense ?? 0).toLocaleString()}
              </div>
            </Card>
            <Card size="small" className={styles.billSummaryCard}>
              <div className={styles.billSummaryLabel}>{t('settings.transactionCount')}</div>
              <div className={styles.billSummaryValue}>
                {(billSummary.transaction_count ?? 0).toLocaleString()}
              </div>
            </Card>
          </div>
        </>
      )}

      {(filterStartDate || filterEndDate) && (
        <div className={styles.filterHint}>
          {t('settings.transactions')}：{formatDateRangeLabel(filterStartDate, filterEndDate)}
          <Button
            type="link"
            size="small"
            className={styles.viewTransactionsLink}
            onClick={handleClearFilter}
          >
            {t('settings.clearDateFilter')}
          </Button>
        </div>
      )}

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
          onChange: (nextPage: number, nextPageSize: number) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </div>
  );
}


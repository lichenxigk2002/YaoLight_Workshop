import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, DatePicker, Segmented, Typography } from 'antd';
import type { DatePickerProps } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import type {
  BillPeriod,
  BillSummary,
  BillSummaryParams,
} from '@/types/user';
import Statistics from './components/Statistics';
import TransactionList from './components/TransactionList';
import styles from './index.module.scss';

const { Text } = Typography;

export default function Billing() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();

  const [billLoading, setBillLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState<BillPeriod>('month');
  const [billDate, setBillDate] = useState<Dayjs>(() => dayjs());
  const [billSummary, setBillSummary] = useState<BillSummary | null>(null);

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

  const formatDateRangeLabel = (start?: string, end?: string) => {
    if (!start && !end) return '-';
    const fmt = (v?: string) => (v ? v.slice(0, 10) : '-');
    return `${fmt(start)} ~ ${fmt(end)}`;
  };

  const handleApplyPeriodToTransactions = () => {
    if (!billSummary) return;
    const start = billSummary.start_at?.slice(0, 10);
    const end = billSummary.end_at?.slice(0, 10);
    const searchParams = new URLSearchParams();
    if (start) searchParams.set('start', start);
    if (end) searchParams.set('end', end);
    navigate(`/settings/token-transactions?${searchParams.toString()}`);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <SettingsPageTitle title={t('settings.billing')} style={{ marginBottom: 0 }} />
        <Card bordered={false} size="small" bodyStyle={{ padding: '8px 16px' }} style={{ borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
          <Text type="secondary" style={{ marginRight: 8 }}>{t('settings.currentStardustBalance')}:</Text>
          <Text strong style={{ fontSize: 16 }}>{user?.token_balance?.toLocaleString() || 0}</Text>
          <StardustIcon size={16} style={{ marginLeft: 4, verticalAlign: '-2px' }} />
        </Card>
      </div>

      <Card bordered={false} className={styles.billFilterCard}>
        <div className={styles.billFilterHeader}>
           <div className={styles.leftControls}>
              <Segmented
                value={period}
                onChange={(val) => setPeriod(val as BillPeriod)}
                options={[
                  { label: t('settings.billDay'), value: 'day' },
                  { label: t('settings.billMonth'), value: 'month' },
                  { label: t('settings.billQuarter'), value: 'quarter' },
                  { label: t('settings.billYear'), value: 'year' },
                ]}
              />
              <DatePicker
                picker={pickerMode}
                value={billDate}
                onChange={(val) => setBillDate(val || dayjs())}
                allowClear={false}
                style={{ width: 140 }}
                disabled={billLoading}
              />
           </div>
           <div className={styles.rightControls}>
              <Button onClick={handleApplyPeriodToTransactions} disabled={!billSummary}>
                {t('settings.viewTransactionsInPeriod')}
              </Button>
              <Button type="primary" ghost onClick={handleExportPDF} loading={exporting}>
                {t('settings.exportBillPDF')}
              </Button>
           </div>
        </div>

        {billSummary && (
          <div className={styles.billSummaryContent}>
             <div className={styles.periodInfo}>
               <Text type="secondary">{t('settings.currentPeriod')}:</Text> {formatDateRangeLabel(billSummary.start_at, billSummary.end_at)}
             </div>
             <div className={styles.metricsGrid}>
                <div className={styles.metricItem}>
                   <div className={styles.metricLabel}>{t('settings.income')}</div>
                   <div className={styles.metricValue} style={{ color: '#52c41a' }}>+{billSummary.total_income?.toLocaleString() ?? 0}</div>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metricItem}>
                   <div className={styles.metricLabel}>{t('settings.expense')}</div>
                   <div className={styles.metricValue} style={{ color: '#ff4d4f' }}>-{billSummary.total_expense?.toLocaleString() ?? 0}</div>
                </div>
                <div className={styles.metricDivider} />
                <div className={styles.metricItem}>
                   <div className={styles.metricLabel}>{t('settings.transactionCount')}</div>
                   <div className={styles.metricValue}>{billSummary.transaction_count?.toLocaleString() ?? 0}</div>
                </div>
             </div>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 24 }}>
        <Card bordered={false}>
          <Statistics />
        </Card>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, DatePicker, Segmented } from 'antd';
import {
  CalendarOutlined,
  CloudDownloadOutlined,
  FileSearchOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import type { DatePickerProps } from 'antd';
import { useTranslation } from 'react-i18next';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { subscribePaymentEvents } from '@/utils/paymentEvents';
import type { BillPeriod, BillSummary, BillSummaryParams } from '@/types/user';
import Statistics from './components/Statistics';
import styles from './index.module.scss';

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

  const buildBillParams = useCallback((p: BillPeriod, d: Dayjs): BillSummaryParams => {
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
  }, []);

  const billParams = useMemo(() => buildBillParams(period, billDate), [billDate, buildBillParams, period]);

  const refreshUserInfo = useCallback(
    async (silent = false) => {
      try {
        const userData = await userApi.getCurrentUser();
        setUser(userData);
      } catch (error: any) {
        if (!silent) {
          message.error(error.message || t('profile.getUserInfoFailed'));
        }
      }
    },
    [message, setUser, t],
  );

  const refreshBillSummary = useCallback(
    async (silent = false) => {
      try {
        setBillLoading(true);
        const sum = await userApi.getBillSummary(billParams);
        setBillSummary(sum);
      } catch (error: any) {
        if (!silent) {
          message.error(error?.message || t('settings.getBillSummaryFailed'));
        }
        setBillSummary(null);
      } finally {
        setBillLoading(false);
      }
    },
    [billParams, message, t],
  );

  useEffect(() => {
    void refreshUserInfo();
  }, [refreshUserInfo]);

  useEffect(() => {
    void refreshBillSummary();
  }, [refreshBillSummary]);

  useEffect(() => {
    const unsubscribe = subscribePaymentEvents(() => {
      void refreshUserInfo(true);
      void refreshBillSummary(true);
    });

    return unsubscribe;
  }, [refreshBillSummary, refreshUserInfo]);

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

  const pickerMode = useMemo<Exclude<DatePickerProps['picker'], undefined>>(() => {
    if (period === 'day') return 'date';
    if (period === 'month') return 'month';
    if (period === 'quarter') return 'quarter';
    return 'year';
  }, [period]);

  return (
    <div className={styles.page}>
      <section className={styles.heroSection}>
        <div className={styles.heroHeader}>
          <SettingsPageTitle
            title={t('settings.billingOverview', 'Billing')}
            desc={t(
              'settings.billingPageDescription',
              'Track balance, billing period, and model consumption in one place.',
            )}
            icon={<WalletOutlined />}
            style={{ marginBottom: 0 }}
          />
          <div className={styles.balanceChip}>
            <span className={styles.balanceChipLabel}>{t('settings.currentStardustBalance')}</span>
            <span className={styles.balanceChipValue}>{(user?.token_balance || 0).toLocaleString()}</span>
            <StardustIcon size={16} />
          </div>
        </div>
        <div className={styles.heroFootnote}>
          <CalendarOutlined />
          <span>
            {t('settings.currentPeriod', 'Current period')}:
            {' '}
            {billSummary
              ? formatDateRangeLabel(billSummary.start_at, billSummary.end_at)
              : t('settings.loadingPeriod', 'Preparing billing period')}
          </span>
        </div>
      </section>

      <section className={styles.surfaceCard}>
        <div className={styles.sectionIntro}>
          <div>
            <div className={styles.eyebrow}>{t('settings.bill', 'Bill')}</div>
            <h2 className={styles.sectionTitle}>{t('settings.billing', 'Billing')}</h2>
            <p className={styles.sectionDesc}>
              {t(
                'settings.billingFiltersDescription',
                'Choose a period to review income, expense, and transaction count.',
              )}
            </p>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.toolbarGroup}>
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
              className={styles.datePicker}
              disabled={billLoading}
            />
          </div>

          <div className={styles.toolbarGroup}>
            <Button
              className={styles.secondaryButton}
              icon={<FileSearchOutlined />}
              onClick={handleApplyPeriodToTransactions}
              disabled={!billSummary}
            >
              {t('settings.viewTransactionsInPeriod')}
            </Button>
            <Button
              type="primary"
              className={styles.primaryButton}
              icon={<CloudDownloadOutlined />}
              onClick={handleExportPDF}
              loading={exporting}
            >
              {t('settings.exportBillPDF')}
            </Button>
          </div>
        </div>

        {billSummary ? (
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <div className={styles.summaryTitle}>{t('settings.currentPeriod', 'Current period')}</div>
              <div className={styles.summaryRange}>
                {formatDateRangeLabel(billSummary.start_at, billSummary.end_at)}
              </div>
            </div>

            <div className={styles.summaryGrid}>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>{t('settings.income')}</div>
                <div className={`${styles.metricValue} ${styles.metricPositive}`}>
                  +{billSummary.total_income?.toLocaleString() ?? 0}
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>{t('settings.expense')}</div>
                <div className={`${styles.metricValue} ${styles.metricNegative}`}>
                  -{billSummary.total_expense?.toLocaleString() ?? 0}
                </div>
              </div>
              <div className={styles.metricCard}>
                <div className={styles.metricLabel}>{t('settings.transactionCount')}</div>
                <div className={styles.metricValue}>
                  {billSummary.transaction_count?.toLocaleString() ?? 0}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.summaryPlaceholder} aria-busy={billLoading}>
            <div className={styles.summaryPlaceholderLabel}>
              {billLoading
                ? t('settings.billSummaryLoading', 'Preparing bill summary...')
                : t('settings.billSummaryEmpty', 'No bill summary for the current period')}
            </div>
          </div>
        )}
      </section>

      <section className={styles.statisticsSection}>
        <Statistics />
      </section>
    </div>
  );
}

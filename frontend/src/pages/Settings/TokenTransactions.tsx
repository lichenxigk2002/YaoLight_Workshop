import { useState } from 'react';
import { App } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import TransactionList from './Billing/components/TransactionList';
import styles from './token-transactions.module.scss';

export default function TokenTransactions() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();

  const initialStart = searchParams.get('start') || undefined;
  const initialEnd = searchParams.get('end') || undefined;

  const [filterStartDate, setFilterStartDate] = useState<string | undefined>(initialStart);
  const [filterEndDate, setFilterEndDate] = useState<string | undefined>(initialEnd);

  const handleClearFilter = () => {
    setFilterStartDate(undefined);
    setFilterEndDate(undefined);
    message.success(t('settings.clearDateFilterSuccess'));
  };

  return (
    <div className={styles.page}>
      <SettingsPageTitle
        title={t('settings.tokenTransactionsTitle')}
        desc={t('settings.tokenTransactionsDescription')}
        icon={<HistoryOutlined />}
        style={{ marginBottom: 0 }}
      />

      <TransactionList
        filterStartDate={filterStartDate}
        filterEndDate={filterEndDate}
        onClearDateFilter={handleClearFilter}
      />
    </div>
  );
}

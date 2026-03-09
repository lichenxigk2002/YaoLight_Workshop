import { useState } from 'react';
import { App, Card, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import TransactionList from './Billing/components/TransactionList';

const { Text } = Typography;

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
    message.success(t('settings.clearDateFilterSuccess', '已清除时间筛选'));
  };

  return (
    <div>
      <SettingsPageTitle title={t('settings.tokenTransactionsTitle', 'Token 流水')} />

      <Card bordered={false} style={{ marginTop: 16, marginBottom: 16 }}>
        <Text type="secondary">
          {t(
            'settings.tokenTransactionsDescription',
            '查看按模型与供应商维度统计的 Token 消耗流水记录。'
          )}
        </Text>
      </Card>

      <Card bordered={false}>
        <TransactionList
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          onClearDateFilter={handleClearFilter}
        />
      </Card>
    </div>
  );
}


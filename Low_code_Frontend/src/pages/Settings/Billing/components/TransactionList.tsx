import { useEffect, useMemo, useState } from 'react';
import { App, Button, Select, Table, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { userApi } from '@/api/user';
import { ProviderIcon } from '@/components/Icons';
import { TokenTransaction } from '@/types/user';

interface TransactionListProps {
  filterStartDate?: string;
  filterEndDate?: string;
  onClearDateFilter?: () => void;
}

export default function TransactionList({
  filterStartDate,
  filterEndDate,
  onClearDateFilter,
}: TransactionListProps) {
  const { t } = useTranslation();
  const { message } = App.useApp();

  const [loading, setLoading] = useState(false);
  const [list, setList] = useState<TokenTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [providerOptions, setProviderOptions] = useState<{ provider: string; models: string[] }[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>();
  const [selectedModel, setSelectedModel] = useState<string | undefined>();

  const availableModels = useMemo(() => {
    if (!selectedProvider) {
      const all = new Set<string>();
      providerOptions.forEach((item) => item.models.forEach((model) => all.add(model)));
      return Array.from(all);
    }

    const found = providerOptions.find((item) => item.provider === selectedProvider);
    return found ? found.models : [];
  }, [providerOptions, selectedProvider]);

  useEffect(() => {
    void fetchOptions();
  }, []);

  useEffect(() => {
    void fetchTransactions();
  }, [filterEndDate, filterStartDate, page, pageSize, selectedModel, selectedProvider]);

  async function fetchOptions() {
    try {
      const res = await userApi.getTransactionOptions();
      setProviderOptions(res.items || []);
    } catch (error) {
      console.error(error);
    }
  }

  async function fetchTransactions() {
    try {
      setLoading(true);
      const res = await userApi.getTokenTransactions({
        page,
        pageSize,
        start_date: filterStartDate,
        end_date: filterEndDate,
        provider: selectedProvider,
        model: selectedModel,
      });
      setList(Array.isArray(res?.list) ? res.list : []);
      setTotal(typeof res?.total === 'number' ? res.total : 0);
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleProviderChange(value?: string) {
    setSelectedProvider(value);
    setSelectedModel(undefined);
  }

  function handleModelChange(value?: string) {
    setSelectedModel(value);

    if (value && !selectedProvider) {
      const possibleProviders = providerOptions.filter((item) => item.models.includes(value));
      if (possibleProviders.length === 1) {
        setSelectedProvider(possibleProviders[0].provider);
      }
    }
  }

  function formatDateRangeLabel(start?: string, end?: string) {
    if (!start && !end) {
      return '-';
    }

    const fmt = (raw?: string) => (raw ? raw.slice(0, 10) : '-');
    return `${fmt(start)} ~ ${fmt(end)}`;
  }

  const columns = useMemo(
    () => [
      {
        title: t('settings.time'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 180,
        render: (value: string) => {
          const date = value ? new Date(value) : null;
          return date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '-';
        },
      },
      {
        title: t('settings.model'),
        key: 'model',
        render: (_: unknown, record: TokenTransaction) => {
          const provider = record.provider || '';
          const model = record.model_name || '';

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              {provider ? <ProviderIcon provider={provider} size={20} /> : null}
              <span>{model || '-'}</span>
            </div>
          );
        },
      },
      {
        title: (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {t('settings.tokenDetails')}
            <Tooltip title="Input / Output">
              <InfoCircleOutlined style={{ color: '#999', cursor: 'pointer' }} />
            </Tooltip>
          </div>
        ),
        key: 'tokens',
        width: 150,
        render: (_: unknown, record: TokenTransaction) => {
          const input = record.prompt_tokens || 0;
          const output = record.completion_tokens || 0;
          const totalTokens = record.total_tokens || 0;

          return (
            <Tooltip title={`${t('settings.totalTokens')}: ${totalTokens}`}>
              <span style={{ whiteSpace: 'nowrap' }}>
                {input} / {output}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: t('settings.description'),
        key: 'description',
        width: 200,
        render: (_: unknown, record: TokenTransaction) => {
          let displayText = record.description;

          if (!displayText) {
            if (record.type === 'chat' || (record.provider && !record.model_name)) {
              displayText = 'YaoLight AI Assistant';
            } else {
              displayText = record.type || '-';
            }
          }

          const match =
            displayText.match(/^(.*?)\s*（(.*?)）$/) ||
            displayText.match(/^(.*?)\s*\((.*?)\)$/);

          if (match) {
            const mainText = match[1];
            const tooltipText = match[2];
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                <span>{mainText}</span>
                <Tooltip title={tooltipText}>
                  <InfoCircleOutlined style={{ color: '#999', cursor: 'pointer' }} />
                </Tooltip>
              </div>
            );
          }

          return <span style={{ whiteSpace: 'nowrap' }}>{displayText}</span>;
        },
      },
      {
        title: t('settings.stardustChange'),
        dataIndex: 'amount',
        key: 'amount',
        width: 120,
        render: (value: number) => {
          const isIncome = typeof value === 'number' && value > 0;
          const isExpense = typeof value === 'number' && value < 0;
          const absValue = typeof value === 'number' ? Math.abs(value) : 0;

          return (
            <span
              style={{
                whiteSpace: 'nowrap',
                color: isIncome ? '#52c41a' : isExpense ? '#ff4d4f' : '#999',
                fontWeight: 'bold',
              }}
            >
              {isIncome ? '+' : isExpense ? '-' : ''}
              {absValue.toLocaleString()}
            </span>
          );
        },
      },
      {
        title: t('settings.amount'),
        key: 'cost',
        width: 160,
        render: (_: unknown, record: TokenTransaction) => {
          const cost = typeof record.cost === 'number' ? record.cost : 0;
          const currency = record.currency || 'USD';
          if (!cost) {
            return <span>-</span>;
          }

          return (
            <span style={{ whiteSpace: 'nowrap' }}>
              {cost.toFixed(6)} {currency}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <Select
          placeholder={t('settings.filterByProvider')}
          style={{ width: 200 }}
          allowClear
          value={selectedProvider}
          onChange={handleProviderChange}
        >
          {providerOptions.map((item) => (
            <Select.Option key={item.provider} value={item.provider}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ProviderIcon provider={item.provider} size={16} />
                {item.provider}
              </div>
            </Select.Option>
          ))}
        </Select>

        <Select
          placeholder={t('settings.filterByModel')}
          style={{ width: 240 }}
          allowClear
          value={selectedModel}
          onChange={handleModelChange}
        >
          {availableModels.map((model) => (
            <Select.Option key={model} value={model}>
              {model}
            </Select.Option>
          ))}
        </Select>

        {filterStartDate || filterEndDate ? (
          <div style={{ color: '#888', fontSize: '14px' }}>
            {t('settings.transactions')}：{formatDateRangeLabel(filterStartDate, filterEndDate)}
            <Button type="link" size="small" onClick={onClearDateFilter}>
              {t('settings.clearDateFilter')}
            </Button>
          </div>
        ) : null}
      </div>

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

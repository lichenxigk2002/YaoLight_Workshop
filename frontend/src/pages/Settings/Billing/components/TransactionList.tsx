import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Select, Table, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import { userApi } from '@/api/user';
import { ProviderIcon } from '@/components/Icons';
import type { TokenTransaction } from '@/types/user';
import styles from './transaction-list.module.scss';

interface TransactionListProps {
  filterStartDate?: string;
  filterEndDate?: string;
  onClearDateFilter?: () => void;
}

function formatNumber(value?: number) {
  return (value || 0).toLocaleString();
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

  const fetchOptions = useCallback(async () => {
    try {
      const res = await userApi.getTransactionOptions();
      setProviderOptions(res.items || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
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
  }, [filterEndDate, filterStartDate, message, page, pageSize, selectedModel, selectedProvider, t]);

  useEffect(() => {
    void fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  function handleProviderChange(value?: string) {
    setSelectedProvider(value);
    setSelectedModel(undefined);
    setPage(1);
  }

  function handleModelChange(value?: string) {
    setSelectedModel(value);
    setPage(1);

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

  const columns = useMemo<ColumnsType<TokenTransaction>>(
    () => [
      {
        title: t('settings.time'),
        dataIndex: 'created_at',
        key: 'created_at',
        width: 156,
        render: (value: string) => {
          const date = value ? new Date(value) : null;
          return (
            <span className={styles.timeValue}>
              {date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : '-'}
            </span>
          );
        },
      },
      {
        title: t('settings.model'),
        key: 'model',
        width: 204,
        render: (_, record) => {
          const provider = record.provider || '';
          const model = record.display_name || record.model_name || '';

          return (
            <div className={styles.modelCell}>
              {provider ? <ProviderIcon provider={provider} size={20} /> : null}
              <span className={styles.modelText}>{model || '-'}</span>
            </div>
          );
        },
      },
      {
        title: (
          <div className={styles.inlineLabel}>
            {t('settings.tokenDetails')}
            <Tooltip title="Input / Output">
              <InfoCircleOutlined className={styles.inlineInfoIcon} />
            </Tooltip>
          </div>
        ),
        key: 'tokens',
        width: 132,
        render: (_, record) => {
          const input = record.prompt_tokens || 0;
          const output = record.completion_tokens || 0;
          const totalTokens = record.total_tokens || 0;

          return (
            <Tooltip title={`${t('settings.totalTokens')}: ${totalTokens}`}>
              <span className={styles.tokenPair}>
                {formatNumber(input)} / {formatNumber(output)}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: t('settings.description'),
        key: 'description',
        width: 190,
        render: (_, record) => {
          let displayText = record.description;

          if (!displayText) {
            if (record.type === 'chat' || (record.provider && !record.model_name)) {
              displayText = 'YaoLight AI Assistant';
            } else {
              displayText = record.type || '-';
            }
          }

          const match =
            displayText.match(/^(.*?)\s*（(.*?)）/) ||
            displayText.match(/^(.*?)\s*\((.*?)\)$/);

          if (match) {
            return (
              <div className={styles.descriptionLabel}>
                <Tooltip title={match[1]}>
                  <span className={styles.descriptionText}>{match[1]}</span>
                </Tooltip>
                <Tooltip title={match[2]}>
                  <InfoCircleOutlined className={styles.inlineInfoIcon} />
                </Tooltip>
              </div>
            );
          }

          return (
            <Tooltip title={displayText}>
              <span className={styles.descriptionText}>{displayText}</span>
            </Tooltip>
          );
        },
      },
      {
        title: t('settings.stardustChange'),
        dataIndex: 'amount',
        key: 'amount',
        width: 118,
        render: (value: number) => {
          const isIncome = typeof value === 'number' && value > 0;
          const isExpense = typeof value === 'number' && value < 0;
          const absValue = typeof value === 'number' ? Math.abs(value) : 0;

          return (
            <span
              className={`${styles.amountPill} ${
                isIncome ? styles.amountPositive : isExpense ? styles.amountNegative : styles.amountNeutral
              }`}
            >
              {isIncome ? '+' : isExpense ? '-' : ''}
              {formatNumber(absValue)}
            </span>
          );
        },
      },
      {
        title: t('settings.amount'),
        key: 'cost',
        width: 128,
        render: (_, record) => {
          const cost = typeof record.cost === 'number' ? record.cost : 0;
          const currency = record.currency || 'USD';
          if (!cost) {
            return <span>-</span>;
          }

          return (
            <span className={styles.costValue}>
              {cost.toFixed(6)} {currency}
            </span>
          );
        },
      },
    ],
    [t],
  );

  return (
    <div className={styles.container}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <Select
            placeholder={t('settings.filterByProvider')}
            className={styles.filterSelect}
            allowClear
            value={selectedProvider}
            onChange={handleProviderChange}
          >
            {providerOptions.map((item) => (
              <Select.Option key={item.provider} value={item.provider}>
                <div className={styles.modelCell}>
                  <ProviderIcon provider={item.provider} size={16} />
                  {item.provider}
                </div>
              </Select.Option>
            ))}
          </Select>

          <Select
            placeholder={t('settings.filterByModel')}
            className={styles.filterSelectWide}
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
        </div>

        {(filterStartDate || filterEndDate) && (
          <div className={styles.dateFilterPill}>
            <span>
              {t('settings.transactions')}:
              {' '}
              {formatDateRangeLabel(filterStartDate, filterEndDate)}
            </span>
            <Button type="link" size="small" onClick={onClearDateFilter}>
              {t('settings.clearDateFilter')}
            </Button>
          </div>
        )}
      </div>

      <Table<TokenTransaction>
        rowKey="id"
        columns={columns}
        dataSource={list}
        loading={loading}
        size="small"
        tableLayout="fixed"
        scroll={{ x: 920 }}
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

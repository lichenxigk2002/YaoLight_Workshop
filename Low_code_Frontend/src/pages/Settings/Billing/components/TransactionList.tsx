import { useEffect, useMemo, useState } from 'react';
import { App, Button, Select, Table, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { InfoCircleOutlined } from '@ant-design/icons';
import { userApi } from '@/api/user';
import { TokenTransaction } from '@/types/user';
import { ProviderIcon } from '@/components/Icons';

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

  // 计算当前可选的 models
  const availableModels = useMemo(() => {
    if (!selectedProvider) {
      // 如果没选 Provider，显示所有 Model（去重）
      const all = new Set<string>();
      providerOptions.forEach(p => p.models.forEach(m => all.add(m)));
      return Array.from(all);
    }
    const found = providerOptions.find(p => p.provider === selectedProvider);
    return found ? found.models : [];
  }, [selectedProvider, providerOptions]);

  useEffect(() => {
    fetchOptions();
  }, []);

  const fetchOptions = async () => {
    try {
      const res = await userApi.getTransactionOptions();
      setProviderOptions(res.items || []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [filterStartDate, filterEndDate, page, pageSize, selectedProvider, selectedModel]);

  const fetchTransactions = async () => {
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
  };

  const handleProviderChange = (val?: string) => {
    setSelectedProvider(val);
    setSelectedModel(undefined); // 切换 Provider 时重置 Model
  };

  const handleModelChange = (val?: string) => {
    setSelectedModel(val);
    // 如果选了 Model，且当前没选 Provider，或者选的 Model 不在当前 Provider 里（虽然过滤了应该不会），
    // 可以尝试自动反推 Provider。但因为不同 Provider 可能有同名 Model（较少见），
    // 且这里我们允许“只选 Model”，所以不强制反填 Provider。
    // 如果用户希望“只看 gpt-4”，那就不管它是 azure 还是 openai 的。
    // 如果需要严格联动，可以反向查找。
    if (val && !selectedProvider) {
       const possibleProviders = providerOptions.filter(p => p.models.includes(val));
       if (possibleProviders.length === 1) {
         setSelectedProvider(possibleProviders[0].provider);
       }
    }
  };

  const formatDateRangeLabel = (start?: string, end?: string) => {
    if (!start && !end) return '-';
    const fmt = (v?: string) => (v ? v.slice(0, 10) : '-');
    return `${fmt(start)} ~ ${fmt(end)}`;
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
          // 仅显示图标 + 模型名称
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}>
              {provider && <ProviderIcon provider={provider} size={20} />}
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
        render: (_: any, record: TokenTransaction) => {
          const input = record.prompt_tokens || 0;
          const output = record.completion_tokens || 0;
          const total = record.total_tokens || 0;
          return (
            <Tooltip title={`${t('settings.totalTokens')}: ${total}`}>
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
        width: 200, // 给描述列一个最小宽度
        render: (_: any, record: TokenTransaction) => {
          // 如果 description 为空，但有 provider，或者 type 为 chat，则显示默认名称
          const desc = record.description;
          let displayText = desc;
          if (!displayText) {
            if (record.type === 'chat' || (record.provider && !record.model_name)) {
               displayText = 'YaoLight AI Assistant'; 
            } else {
               displayText = record.type || '-';
            }
          }

          // 提取括号内容
          const match = displayText.match(/^(.*?)\s*（(.*?)）$/) || displayText.match(/^(.*?)\s*\((.*?)\)$/);
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
        title: t('settings.stardustConsumption'),
        dataIndex: 'amount',
        key: 'amount',
        width: 120,
        render: (value: number) => {
          const absValue = typeof value === 'number' ? Math.abs(value) : 0;
          return <span style={{ whiteSpace: 'nowrap' }}>{absValue.toLocaleString()}</span>;
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
            <span style={{ whiteSpace: 'nowrap' }}>
              {cost.toFixed(6)} {currency}
            </span>
          );
        },
      },
    ],
    [t]
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
          {availableModels.map((m) => (
            <Select.Option key={m} value={m}>
              {m}
            </Select.Option>
          ))}
        </Select>

        {(filterStartDate || filterEndDate) && (
          <div style={{ color: '#888', fontSize: '14px' }}>
            {t('settings.transactions')}：{formatDateRangeLabel(filterStartDate, filterEndDate)}
            <Button type="link" size="small" onClick={onClearDateFilter}>
              {t('settings.clearDateFilter')}
            </Button>
          </div>
        )}
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

import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { userApi } from '@/api/user';
import { TokenStats, ModelTokenStats } from '@/types/user';
import { ProviderIcon } from '@/components/Icons';

export default function Statistics() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<TokenStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await userApi.getTokenStats();
      setStats(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('settings.model'),
      key: 'model',
      render: (_: any, record: ModelTokenStats) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {record.provider && <ProviderIcon provider={record.provider} size={20} />}
          <span>{record.model_name}</span>
        </div>
      ),
    },
    {
      title: t('settings.todayInput'),
      dataIndex: ['today', 'input_tokens'],
      key: 'today_input',
      render: (val: number) => val?.toLocaleString() || 0,
    },
    {
      title: t('settings.todayOutput'),
      dataIndex: ['today', 'output_tokens'],
      key: 'today_output',
      render: (val: number) => val?.toLocaleString() || 0,
    },
    {
      title: t('settings.todayTotal'),
      dataIndex: ['today', 'total_tokens'],
      key: 'today_total',
      render: (val: number) => val?.toLocaleString() || 0,
    },
    {
      title: t('settings.totalInput'),
      dataIndex: ['total', 'input_tokens'],
      key: 'total_input',
      render: (val: number) => val?.toLocaleString() || 0,
    },
    {
      title: t('settings.totalOutput'),
      dataIndex: ['total', 'output_tokens'],
      key: 'total_output',
      render: (val: number) => val?.toLocaleString() || 0,
    },
    {
      title: t('settings.totalTotal'),
      dataIndex: ['total', 'total_tokens'],
      key: 'total_total',
      render: (val: number) => val?.toLocaleString() || 0,
    },
  ];

  if (loading && !stats) {
    return <Spin />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Row gutter={24}>
        <Col span={12}>
          <Card title={t('settings.todayConsumption')} bordered={false}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title={t('settings.inputTokens')} value={stats?.today.input_tokens} groupSeparator="," />
              </Col>
              <Col span={8}>
                <Statistic title={t('settings.outputTokens')} value={stats?.today.output_tokens} groupSeparator="," />
              </Col>
              <Col span={8}>
                <Statistic title={t('settings.totalTokens')} value={stats?.today.total_tokens} groupSeparator="," />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card title={t('settings.cumulativeConsumption')} bordered={false}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title={t('settings.inputTokens')} value={stats?.total.input_tokens} groupSeparator="," />
              </Col>
              <Col span={8}>
                <Statistic title={t('settings.outputTokens')} value={stats?.total.output_tokens} groupSeparator="," />
              </Col>
              <Col span={8}>
                <Statistic title={t('settings.totalTokens')} value={stats?.total.total_tokens} groupSeparator="," />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>

      <Card title={t('settings.modelAnalytics')} bordered={false}>
        <Table
          rowKey={(r) => `${r.provider}-${r.model_name}`}
          columns={columns}
          dataSource={stats?.models || []}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
}

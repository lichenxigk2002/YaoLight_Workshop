import { useEffect, useState } from 'react';
import { Button, Card, Descriptions, Empty, Table, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import PageHero from '@/components/PageHero';
import { getAIProvider } from '@/api/aiModels';
import type { AIProviderDetail } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph } = Typography;

const providerStatusLabels = {
  healthy: '健康',
  degraded: '波动',
  disabled: '停用',
} as const;

export default function ProviderDetailPage() {
  const { provider } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<AIProviderDetail | null | undefined>(undefined);

  useEffect(() => {
    if (!provider) {
      setDetail(null);
      return;
    }

    void getAIProvider(provider).then(setDetail);
  }, [provider]);

  if (detail === undefined) {
    return <Card loading bordered={false} className={styles.card} />;
  }

  if (!detail) {
    return <Empty description="服务商不存在" className={styles.emptyBlock} />;
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="服务商详情"
        title={(
          <div className={styles.providerHeading}>
            <ProviderIcon provider={detail.key} size={28} />
            <span>{detail.name}</span>
          </div>
        )}
        description={detail.description}
        tags={[providerStatusLabels[detail.status], `${detail.models_count} 个模型`, detail.default_currency]}
        action={<Button onClick={() => navigate('/ai-models/providers')}>返回列表</Button>}
      />

      <div className={styles.grid}>
        <div className={styles.span5}>
          <Card bordered={false} className={styles.card} title="服务商信息">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="标识">{detail.key}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag
                  color={detail.status === 'healthy' ? 'green' : detail.status === 'degraded' ? 'orange' : 'default'}
                >
                  {providerStatusLabels[detail.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="默认币种">{detail.default_currency}</Descriptions.Item>
              <Descriptions.Item label="启用模型">
                {detail.active_models_count}/{detail.models_count}
              </Descriptions.Item>
              <Descriptions.Item label="能力标签">
                {detail.capabilities.map((capability) => (
                  <Tag key={capability}>{capability}</Tag>
                ))}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>

        <div className={styles.span7}>
          <Card bordered={false} className={styles.card} title="挂载模型">
            <Paragraph className={styles.muted}>
              这里展示当前服务商下的模型资源。能力和计费继续在模型详情页中维护。
            </Paragraph>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={detail.models}
              columns={[
                { title: '显示名', dataIndex: 'display_name' },
                { title: '模型名', dataIndex: 'model_name' },
                {
                  title: '状态',
                  dataIndex: 'status',
                  render: (status: string) => (
                    <Tag color={status === 'active' ? 'green' : status === 'testing' ? 'blue' : 'default'}>
                      {status === 'active' ? '启用' : status === 'testing' ? '测试中' : status}
                    </Tag>
                  ),
                },
                {
                  title: '操作',
                  key: 'actions',
                  render: (_, record) => (
                    <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                      查看详情
                    </Button>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Button, Card, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { getAIModels } from '@/api/aiModels';
import { PRICING_TYPE_LABELS, PROVIDER_LABELS } from '@/types/aiModels';
import type { AIAdminModel } from '@/types/aiModels';
import styles from './AIModels.module.scss';

const { Paragraph, Title } = Typography;

function getModelPricingType(model: AIAdminModel): string {
  if (model.current_pricing?.pricing_type) {
    return PRICING_TYPE_LABELS[model.current_pricing.pricing_type];
  }
  return '未配置';
}

function getStatusLabel(status: string) {
  if (status === 'active') {
    return '启用';
  }
  if (status === 'testing') {
    return '测试中';
  }
  return status;
}

export default function ModelsPage() {
  const navigate = useNavigate();
  const [models, setModels] = useState<AIAdminModel[]>([]);

  useEffect(() => {
    void getAIModels().then(setModels);
  }, []);

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <Title level={3} className={styles.sectionTitle}>
            模型
          </Title>
          <Paragraph className={styles.muted}>
            新建模型时只录入基础信息，能力和计费在详情页继续维护。
          </Paragraph>
        </div>
        <Button type="primary" onClick={() => navigate('/ai-models/models/new')}>
          新建模型
        </Button>
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={models}
          columns={[
            {
              title: '显示名',
              dataIndex: 'display_name',
              render: (value: string, record) => (
                <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                  {value}
                </Button>
              ),
            },
            {
              title: '服务商',
              dataIndex: 'provider',
              render: (provider: string) => (
                <div className={styles.providerCell}>
                  <ProviderIcon provider={provider} size={18} />
                  <div className={styles.providerCellText}>
                    <div>{PROVIDER_LABELS[provider] ?? provider}</div>
                    <div className={styles.providerKey}>{provider}</div>
                  </div>
                </div>
              ),
            },
            { title: '模型名', dataIndex: 'model_name' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : status === 'testing' ? 'blue' : 'default'}>
                  {getStatusLabel(status)}
                </Tag>
              ),
            },
            {
              title: '当前计费',
              key: 'pricing_type',
              render: (_, record) => getModelPricingType(record),
            },
            {
              title: '请求量',
              key: 'requests',
              render: (_, record) => record.usage.requests.toLocaleString(),
            },
            {
              title: '操作',
              key: 'actions',
              render: (_, record) => (
                <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                  进入详情
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

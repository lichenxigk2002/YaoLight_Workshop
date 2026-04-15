import { useEffect, useState } from 'react';
import { App, Button, Card, Space, Spin, Table, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate, useParams } from 'react-router-dom';
import { getCrawlerRule, getCrawlerRuleUsages } from '@/api/crawlerRules';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import type { CrawlerRuleDetail, CrawlerRuleUsage } from '@/types/crawlerRules';
import styles from './CrawlerRules.module.scss';

const { Paragraph, Text, Title } = Typography;

export default function RuleUsagesPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useAdminPermission('crawler_rules');
  const [rule, setRule] = useState<CrawlerRuleDetail | null>(null);
  const [usages, setUsages] = useState<CrawlerRuleUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([getCrawlerRule(Number(id)), getCrawlerRuleUsages(Number(id))])
      .then(([detail, usagePayload]) => {
        setRule(detail);
        setUsages(usagePayload.list);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载规则引用关系失败');
      })
      .finally(() => setLoading(false));
  }, [id, message]);

  const columns: ColumnsType<CrawlerRuleUsage> = [
    {
      title: '工作流',
      dataIndex: 'workflow_name',
      render: (value: string, record) => (
        <div>
          <div>{value}</div>
          <Text type="secondary">ID: {record.workflow_id}</Text>
        </div>
      ),
    },
    {
      title: '节点',
      dataIndex: 'node_id',
      render: (value: string, record) => (
        <div>
          <div>{value}</div>
          <Text type="secondary">{record.node_type}</Text>
        </div>
      ),
    },
    { title: '最近引用时间', dataIndex: 'referenced_at' },
  ];

  if (loading) {
    return <div className={styles.page} style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}><Spin /></div>;
  }

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Button onClick={() => navigate('/crawler-rules')}>返回列表</Button>
            <Button onClick={() => navigate(`/crawler-rules/${id}`)}>规则详情</Button>
            {canEdit ? <Button onClick={() => navigate(`/crawler-rules/${id}/test`)}>规则测试</Button> : null}
          </Space>
          <div>
            <Title level={3} className={styles.sectionTitle}>引用关系</Title>
            <Paragraph className={styles.muted}>
              {rule ? `查看规则「${rule.name}」被哪些工作流节点引用。` : '规则不存在'}
            </Paragraph>
          </div>
        </Space>
      </Card>

      <Card bordered={false} className={styles.card}>
        <Table<CrawlerRuleUsage>
          rowKey={(record) => `${record.workflow_id}-${record.node_id}`}
          dataSource={usages}
          columns={columns}
          locale={{ emptyText: '当前没有检测到工作流引用这个规则。' }}
          pagination={false}
        />
      </Card>
    </div>
  );
}

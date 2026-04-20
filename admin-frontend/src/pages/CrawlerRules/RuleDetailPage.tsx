import { useEffect, useState } from 'react';
import { App, Button, Card, Descriptions, Form, Space, Spin, Tabs, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getCrawlerRule, updateCrawlerRule } from '@/api/crawlerRules';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import type { CrawlerRuleDetail } from '@/types/crawlerRules';
import RuleEditorDrawer from './components/RuleEditorDrawer';
import styles from './CrawlerRules.module.scss';
import { detailToFormValues, formatSuccessRate, getStatusMeta, prettyJson, type RuleFormValues, toRulePayload } from './utils';

const { Paragraph, Text, Title } = Typography;

export default function RuleDetailPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams();
  const { canEdit } = useAdminPermission('crawler_rules');
  const [form] = Form.useForm<RuleFormValues>();
  const [rule, setRule] = useState<CrawlerRuleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getCrawlerRule(Number(id))
      .then((payload) => {
        setRule(payload);
        form.setFieldsValue(detailToFormValues(payload));
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : '加载规则详情失败');
      })
      .finally(() => setLoading(false));
  }, [id, form, message]);

  const handleSave = async () => {
    if (!id) return;
    try {
      const values = await form.validateFields();
      const payload = toRulePayload(values);
      setSaving(true);
      const updated = await updateCrawlerRule(Number(id), payload);
      setRule(updated);
      form.setFieldsValue(detailToFormValues(updated));
      setDrawerOpen(false);
      message.success('规则已更新');
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page} style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <Spin />
      </div>
    );
  }

  if (!rule) {
    return (
      <div className={styles.page}>
        <Card bordered={false} className={styles.card}>
          <Paragraph>规则不存在或已删除。</Paragraph>
        </Card>
      </div>
    );
  }

  const statusMeta = getStatusMeta(rule.is_active);

  return (
    <div className={styles.page}>
      <Card bordered={false} className={styles.card}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <Button onClick={() => navigate('/crawler-rules')}>返回列表</Button>
            {canEdit ? <Button onClick={() => navigate(`/crawler-rules/${rule.id}/test`)}>规则测试</Button> : null}
            <Button onClick={() => navigate(`/crawler-rules/${rule.id}/usages`)}>查看引用</Button>
            {canEdit ? <Button type="primary" onClick={() => setDrawerOpen(true)}>编辑规则</Button> : null}
          </Space>
          <div>
            <Title level={3} className={styles.sectionTitle}>{rule.name}</Title>
            <Paragraph className={styles.muted}>{rule.description || '当前规则未填写描述。'}</Paragraph>
            <Space wrap>
              <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
              <Tag color="blue">v{rule.version}</Tag>
              <Tag color="gold">使用 {rule.usage_count}</Tag>
              <Tag color="purple">成功率 {formatSuccessRate(rule.success_rate)}</Tag>
            </Space>
          </div>
        </Space>
      </Card>

      <Card bordered={false} className={styles.card}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="规则 ID">{rule.id}</Descriptions.Item>
          <Descriptions.Item label="URL 模式类型">{rule.url_pattern_type}</Descriptions.Item>
          <Descriptions.Item label="URL 模式" span={2}>{rule.url_pattern || '-'}</Descriptions.Item>
          <Descriptions.Item label="请求方法">{rule.method}</Descriptions.Item>
          <Descriptions.Item label="User-Agent">{rule.user_agent || '-'}</Descriptions.Item>
          <Descriptions.Item label="超时">{rule.timeout}s</Descriptions.Item>
          <Descriptions.Item label="重试">{rule.retry_count} 次 / 延迟 {rule.retry_delay}s</Descriptions.Item>
          <Descriptions.Item label="跟随重定向">{rule.follow_redirects ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="校验证书">{rule.verify_ssl ? '是' : '否'}</Descriptions.Item>
          <Descriptions.Item label="Headless">{rule.javascript_enabled ? '启用' : '关闭'}</Descriptions.Item>
          <Descriptions.Item label="执行截图">{rule.screenshot ? '启用' : '关闭'}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card bordered={false} className={styles.card}>
        <Tabs
          items={[
            { key: 'headers', label: 'Headers', children: <pre className={styles.resultCode}>{prettyJson(rule.headers, '{}')}</pre> },
            { key: 'params', label: 'Params', children: <pre className={styles.resultCode}>{prettyJson(rule.params, '{}')}</pre> },
            { key: 'body', label: 'Body', children: <pre className={styles.resultCode}>{prettyJson(rule.body, '-')}</pre> },
            { key: 'selectors', label: 'Selectors', children: <pre className={styles.resultCode}>{prettyJson(rule.selectors, '{}')}</pre> },
            { key: 'extract', label: 'Data Extraction', children: <pre className={styles.resultCode}>{prettyJson(rule.data_extraction, '{}')}</pre> },
            { key: 'pagination', label: 'Pagination', children: <pre className={styles.resultCode}>{prettyJson(rule.pagination, '{}')}</pre> },
            { key: 'proxy', label: 'Proxy', children: <pre className={styles.resultCode}>{prettyJson(rule.proxy_config, '{}')}</pre> },
            { key: 'cookies', label: 'Cookies', children: <pre className={styles.resultCode}>{prettyJson(rule.cookies, '{}')}</pre> },
          ]}
        />
        <Text type="secondary">详情页保留规则的完整配置视图，便于后续按页面和操作范围继续细化管理权限。</Text>
      </Card>

      <RuleEditorDrawer
        open={drawerOpen}
        editingRuleId={rule.id}
        saving={saving}
        canEdit={canEdit}
        form={form}
        onClose={() => { setDrawerOpen(false); form.setFieldsValue(detailToFormValues(rule)); }}
        onSave={handleSave}
      />
    </div>
  );
}

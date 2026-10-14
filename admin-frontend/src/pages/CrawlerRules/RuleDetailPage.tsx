import { useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Descriptions, Form, Space, Spin, Tabs, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getCrawlerRule, updateCrawlerRule } from '@/api/crawlerRules';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import type { CrawlerRuleDetail } from '@/types/crawlerRules';
import RuleEditorDrawer from './components/RuleEditorDrawer';
import styles from './CrawlerRules.module.scss';
import { detailToFormValues, formatSuccessRate, getStatusMeta, prettyJson, type RuleFormValues, toRulePayload } from './utils';

const { Paragraph, Text, Title } = Typography;

interface TutorialSection {
  heading: string;
  items: string[];
}

function parseTutorial(raw?: string | null) {
  const lines = (raw || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { summary: '', sections: [] as TutorialSection[] };

  const summaryLine = lines[0].startsWith('适用场景') ? lines[0] : '';
  const contentLines = summaryLine ? lines.slice(1) : lines;
  const sections: TutorialSection[] = [];
  let current: TutorialSection | null = null;

  contentLines.forEach((line) => {
    if (line.endsWith('：')) {
      current = { heading: line.slice(0, -1), items: [] };
      sections.push(current);
      return;
    }

    if (!current) {
      current = { heading: '说明', items: [] };
      sections.push(current);
    }
    current.items.push(line);
  });

  return { summary: summaryLine, sections };
}

function renderTutorial(raw?: string | null, expanded = false) {
  const parsed = parseTutorial(raw);

  if (!parsed.summary && parsed.sections.length === 0) {
    return <Paragraph className={styles.muted}>当前规则还没有配套教程。</Paragraph>;
  }

  const visibleSections = expanded ? parsed.sections : parsed.sections.slice(0, 4);

  return (
    <div className={styles.tutorialPanel}>
      {parsed.summary ? <Paragraph className={styles.tutorialSummary}>{parsed.summary}</Paragraph> : null}
      <div className={styles.tutorialGrid}>
        {visibleSections.map((section) => (
          <div key={section.heading} className={styles.tutorialSection}>
            <Text strong className={styles.tutorialSectionTitle}>{section.heading}</Text>
            <div className={styles.tutorialBlock}>
              {section.items.map((line, index) => (
                <Paragraph key={`${section.heading}-${index}-${line.slice(0, 12)}`} className={styles.tutorialLine}>
                  {line}
                </Paragraph>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
  const [tutorialExpanded, setTutorialExpanded] = useState(false);

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
  const tutorialMeta = useMemo(() => parseTutorial(rule.tutorial), [rule.tutorial]);
  const hasTutorialOverflow = tutorialMeta.sections.length > 4;

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
        <div className={styles.sectionHeader}>
          <Title level={4} className={styles.sectionTitle}>使用教程</Title>
          {hasTutorialOverflow ? (
            <Button type="link" className={styles.inlineLink} onClick={() => setTutorialExpanded((value) => !value)}>
              {tutorialExpanded ? '收起教程' : '展开完整教程'}
            </Button>
          ) : null}
        </div>
        {renderTutorial(rule.tutorial, tutorialExpanded)}
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

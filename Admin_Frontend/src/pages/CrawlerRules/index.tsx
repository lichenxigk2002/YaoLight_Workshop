import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import PageHero from '@/components/PageHero';
import {
  cloneCrawlerRule,
  createCrawlerRule,
  deleteCrawlerRule,
  getCrawlerRule,
  getCrawlerRuleUsages,
  listCrawlerRules,
  setCrawlerRuleStatus,
  testCrawlerRule,
  updateCrawlerRule,
} from '@/api/crawlerRules';
import type {
  CrawlerRuleDetail,
  CrawlerRuleListItem,
  CrawlerRulePayload,
  CrawlerRuleTestResult,
  CrawlerRuleUsage,
} from '@/types/crawlerRules';
import styles from './CrawlerRules.module.scss';

const { Paragraph, Text } = Typography;

type FilterStatus = 'all' | 'active' | 'inactive';

interface RuleFormValues {
  name: string;
  description: string;
  version: string;
  url_pattern: string;
  url_pattern_type: 'regex' | 'glob' | 'exact';
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers_json: string;
  params_json: string;
  body_json: string;
  selectors_json: string;
  data_extraction_json: string;
  pagination_json: string;
  proxy_config_json: string;
  cookies_json: string;
  timeout: number;
  retry_count: number;
  retry_delay: number;
  user_agent: string;
  follow_redirects: boolean;
  verify_ssl: boolean;
  wait_time: number;
  javascript_enabled: boolean;
  screenshot: boolean;
  is_active: boolean;
}

interface TestFormValues {
  test_url: string;
  override_json: string;
}

const DEFAULT_RULE_FORM: RuleFormValues = {
  name: '',
  description: '',
  version: '1.0.0',
  url_pattern: '',
  url_pattern_type: 'regex',
  method: 'GET',
  headers_json: '{}',
  params_json: '{}',
  body_json: '',
  selectors_json: '{\n  "primary": "",\n  "wait_for_selector": ""\n}',
  data_extraction_json: '{\n  "mode": "custom",\n  "extract_type": "text",\n  "extract_attr": ""\n}',
  pagination_json: '',
  proxy_config_json: '',
  cookies_json: '',
  timeout: 30,
  retry_count: 3,
  retry_delay: 1,
  user_agent: '',
  follow_redirects: true,
  verify_ssl: true,
  wait_time: 0,
  javascript_enabled: false,
  screenshot: false,
  is_active: true,
};

const DEFAULT_TEST_FORM: TestFormValues = {
  test_url: '',
  override_json: '{\n  "timeout": 30\n}',
};

function prettyJson(value: unknown, fallback = '{}') {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function parseJsonField(label: string, raw: string, mode: 'object' | 'optional-object' | 'optional-any') {
  const text = raw.trim();
  if (!text) {
    if (mode === 'optional-object' || mode === 'optional-any') {
      return undefined;
    }
    return {};
  }

  const value = JSON.parse(text) as unknown;
  if (mode !== 'optional-any' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return value;
}

function toRulePayload(values: RuleFormValues): CrawlerRulePayload {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    version: values.version.trim() || '1.0.0',
    url_pattern: values.url_pattern.trim(),
    url_pattern_type: values.url_pattern_type,
    method: values.method,
    headers: (parseJsonField('请求头', values.headers_json, 'object') as Record<string, unknown>) ?? {},
    params: (parseJsonField('查询参数', values.params_json, 'object') as Record<string, unknown>) ?? {},
    body: parseJsonField('请求体', values.body_json, 'optional-any'),
    selectors: (parseJsonField('选择器配置', values.selectors_json, 'object') as Record<string, unknown>) ?? {},
    data_extraction: parseJsonField('提取配置', values.data_extraction_json, 'optional-object') as Record<string, unknown> | undefined,
    pagination: parseJsonField('分页配置', values.pagination_json, 'optional-object') as Record<string, unknown> | undefined,
    proxy_config: parseJsonField('代理配置', values.proxy_config_json, 'optional-object') as Record<string, unknown> | undefined,
    cookies: parseJsonField('Cookies', values.cookies_json, 'optional-object') as Record<string, unknown> | undefined,
    timeout: values.timeout,
    retry_count: values.retry_count,
    retry_delay: values.retry_delay,
    user_agent: values.user_agent.trim() || null,
    follow_redirects: values.follow_redirects,
    verify_ssl: values.verify_ssl,
    wait_time: values.wait_time,
    javascript_enabled: values.javascript_enabled,
    screenshot: values.screenshot,
    is_active: values.is_active,
  };
}

function detailToFormValues(detail: CrawlerRuleDetail): RuleFormValues {
  return {
    name: detail.name ?? '',
    description: detail.description ?? '',
    version: detail.version ?? '1.0.0',
    url_pattern: detail.url_pattern ?? '',
    url_pattern_type: detail.url_pattern_type ?? 'regex',
    method: detail.method ?? 'GET',
    headers_json: prettyJson(detail.headers, '{}'),
    params_json: prettyJson(detail.params, '{}'),
    body_json: detail.body === null || detail.body === undefined ? '' : prettyJson(detail.body, ''),
    selectors_json: prettyJson(detail.selectors, '{}'),
    data_extraction_json: detail.data_extraction ? prettyJson(detail.data_extraction, '{}') : '',
    pagination_json: detail.pagination ? prettyJson(detail.pagination, '{}') : '',
    proxy_config_json: detail.proxy_config ? prettyJson(detail.proxy_config, '{}') : '',
    cookies_json: detail.cookies ? prettyJson(detail.cookies, '{}') : '',
    timeout: detail.timeout ?? 30,
    retry_count: detail.retry_count ?? 3,
    retry_delay: detail.retry_delay ?? 1,
    user_agent: detail.user_agent ?? '',
    follow_redirects: detail.follow_redirects ?? true,
    verify_ssl: detail.verify_ssl ?? true,
    wait_time: detail.wait_time ?? 0,
    javascript_enabled: detail.javascript_enabled ?? false,
    screenshot: detail.screenshot ?? false,
    is_active: detail.is_active ?? true,
  };
}

function getStatusMeta(active: boolean) {
  return active ? { color: 'green', label: '启用中' } : { color: 'default', label: '已停用' };
}

function formatSuccessRate(value?: number | null) {
  if (value === null || value === undefined) {
    return '-';
  }
  return `${value.toFixed(2)}%`;
}

export default function CrawlerRulesPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<RuleFormValues>();
  const [testForm] = Form.useForm<TestFormValues>();
  const [rules, setRules] = useState<CrawlerRuleListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testingRule, setTestingRule] = useState<CrawlerRuleListItem | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<CrawlerRuleTestResult | null>(null);
  const [usagesOpen, setUsagesOpen] = useState(false);
  const [usagesLoading, setUsagesLoading] = useState(false);
  const [usages, setUsages] = useState<CrawlerRuleUsage[]>([]);
  const [usageRule, setUsageRule] = useState<CrawlerRuleListItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    listCrawlerRules({
      keyword: keyword || undefined,
      is_active: status === 'all' ? undefined : status === 'active',
      page,
      page_size: pageSize,
    })
      .then((payload) => {
        if (cancelled) return;
        setRules(payload.list);
        setTotal(payload.total);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : '加载规则列表失败');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [keyword, status, page, pageSize, message]);

  const openCreateDrawer = () => {
    setEditingRuleId(null);
    form.setFieldsValue(DEFAULT_RULE_FORM);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (record: CrawlerRuleListItem) => {
    setDrawerOpen(true);
    setEditingRuleId(record.id);
    form.setFieldsValue(DEFAULT_RULE_FORM);
    try {
      const detail = await getCrawlerRule(record.id);
      form.setFieldsValue(detailToFormValues(detail));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载规则详情失败');
      setDrawerOpen(false);
    }
  };

  const reloadRules = async (nextPage = page) => {
    const payload = await listCrawlerRules({
      keyword: keyword || undefined,
      is_active: status === 'all' ? undefined : status === 'active',
      page: nextPage,
      page_size: pageSize,
    });
    setRules(payload.list);
    setTotal(payload.total);
  };

  const handleSaveRule = async () => {
    try {
      const values = await form.validateFields();
      const payload = toRulePayload(values);
      setSaving(true);
      if (editingRuleId) {
        await updateCrawlerRule(editingRuleId, payload);
        message.success('规则已更新');
      } else {
        await createCrawlerRule(payload);
        message.success('规则已创建');
      }
      setDrawerOpen(false);
      setPage(1);
      await reloadRules(1);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = async (record: CrawlerRuleListItem) => {
    try {
      await deleteCrawlerRule(record.id);
      message.success('规则已删除');
      await reloadRules(page);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除规则失败');
    }
  };

  const handleToggleStatus = async (record: CrawlerRuleListItem, checked: boolean) => {
    try {
      await setCrawlerRuleStatus(record.id, checked);
      message.success(`规则已${checked ? '启用' : '停用'}`);
      setRules((current) => current.map((item) => (item.id === record.id ? { ...item, is_active: checked } : item)));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新状态失败');
    }
  };

  const handleCloneRule = async (record: CrawlerRuleListItem) => {
    try {
      await cloneCrawlerRule(record.id);
      message.success('规则已复制');
      setPage(1);
      await reloadRules(1);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '复制规则失败');
    }
  };

  const openTestModal = (record: CrawlerRuleListItem) => {
    setTestingRule(record);
    setTestResult(null);
    testForm.setFieldsValue(DEFAULT_TEST_FORM);
    setTestModalOpen(true);
  };

  const handleRunTest = async () => {
    if (!testingRule) return;
    try {
      const values = await testForm.validateFields();
      const override = parseJsonField('测试覆盖配置', values.override_json, 'optional-object') as Record<string, unknown> | undefined;
      setTesting(true);
      const result = await testCrawlerRule({
        rule_id: testingRule.id,
        test_url: values.test_url.trim(),
        override,
      });
      setTestResult(result);
      message.success(result.success ? '规则测试完成' : '规则测试返回失败结果');
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '规则测试失败');
    } finally {
      setTesting(false);
    }
  };

  const openUsagesDrawer = async (record: CrawlerRuleListItem) => {
    setUsageRule(record);
    setUsages([]);
    setUsagesOpen(true);
    setUsagesLoading(true);
    try {
      const payload = await getCrawlerRuleUsages(record.id);
      setUsages(payload.list);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载引用关系失败');
    } finally {
      setUsagesLoading(false);
    }
  };

  const enabledCount = rules.filter((item) => item.is_active).length;
  const usageTotal = rules.reduce((sum, item) => sum + item.usage_count, 0);
  const avgSuccessRate = rules.length > 0 ? rules.reduce((sum, item) => sum + (item.success_rate ?? 0), 0) / rules.length : 0;

  const columns: ColumnsType<CrawlerRuleListItem> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button type="link" onClick={() => void openEditDrawer(record)}>
          {value}
        </Button>
      ),
    },
    { title: '版本', dataIndex: 'version', width: 120 },
    {
      title: 'URL 模式',
      dataIndex: 'url_pattern',
      ellipsis: true,
      render: (value: string | null | undefined, record) => (
        <div>
          <div>{value || '-'}</div>
          <Text type="secondary">{record.url_pattern_type}</Text>
        </div>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 160,
      render: (_value, record) => {
        const meta = getStatusMeta(record.is_active);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Switch size="small" checked={record.is_active} onChange={(checked) => void handleToggleStatus(record, checked)} />
          </Space>
        );
      },
    },
    { title: '使用次数', dataIndex: 'usage_count', width: 120 },
    {
      title: '成功率',
      dataIndex: 'success_rate',
      width: 120,
      render: (value: number | null | undefined) => formatSuccessRate(value),
    },
    { title: '更新时间', dataIndex: 'updated_at', width: 180 },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => void openEditDrawer(record)}>
            编辑
          </Button>
          <Button type="link" onClick={() => openTestModal(record)}>
            测试
          </Button>
          <Button type="link" onClick={() => void openUsagesDrawer(record)}>
            引用
          </Button>
          <Button type="link" onClick={() => void handleCloneRule(record)}>
            复制
          </Button>
          <Popconfirm title="确认删除这个规则？" description="规则会被软删除，已引用工作流请同步检查。" onConfirm={() => void handleDeleteRule(record)}>
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="Crawler Rules"
        title="爬虫规则中心"
        description="集中管理可复用的抓取规则模板，支持规则测试、工作流引用关系查看和运行指标回收。"
        tags={['规则资产化', '测试验证', '工作流复用', '运行统计']}
        action={
          <Space>
            <Button onClick={() => void reloadRules(page)}>刷新</Button>
            <Button type="primary" onClick={openCreateDrawer}>
              新建规则
            </Button>
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="当前页规则数" value={rules.length} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="启用中" value={enabledCount} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="累计使用次数" value={usageTotal} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="平均成功率" value={avgSuccessRate} precision={2} suffix="%" />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>规则列表</Paragraph>
            <Paragraph className={styles.muted}>支持关键字、状态筛选，并可直接执行规则运维动作。</Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder="搜索名称 / 描述 / URL 模式"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
              style={{ width: 260 }}
            />
            <Select<FilterStatus>
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'active', label: '仅启用' },
                { value: 'inactive', label: '仅停用' },
              ]}
              style={{ width: 140 }}
            />
            <Button
              type="primary"
              onClick={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
            >
              查询
            </Button>
            <Button
              onClick={() => {
                setKeywordInput('');
                setKeyword('');
                setStatus('all');
                setPage(1);
              }}
            >
              重置
            </Button>
          </div>
        </div>

        <Table<CrawlerRuleListItem>
          rowKey="id"
          loading={loading}
          dataSource={rules}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 条`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 20);
            },
          }}
        />
      </Card>

      <Drawer
        title={editingRuleId ? `编辑规则 #${editingRuleId}` : '新建规则'}
        width={920}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSaveRule()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_RULE_FORM} className={styles.form}>
          <Tabs
            items={[
              {
                key: 'basic',
                label: '基础信息',
                children: (
                  <div className={styles.tabBlock}>
                    <Row gutter={16}>
                      <Col xs={24} md={12}>
                        <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
                          <Input placeholder="例如：新闻正文抽取规则" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={12}>
                        <Form.Item name="version" label="版本号">
                          <Input placeholder="1.0.0" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="description" label="规则说明">
                      <Input.TextArea rows={3} placeholder="说明这个规则适用于哪些站点、页面结构或采集目的。" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col xs={24} md={14}>
                        <Form.Item name="url_pattern" label="URL 模式" rules={[{ required: true, message: '请输入 URL 模式' }]}>
                          <Input placeholder="例如：https://example.com/article/*" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item name="url_pattern_type" label="模式类型">
                          <Select options={[{ value: 'regex', label: 'regex' }, { value: 'glob', label: 'glob' }, { value: 'exact', label: 'exact' }]} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item name="method" label="请求方法">
                          <Select options={['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((value) => ({ value, label: value }))} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
              {
                key: 'runtime',
                label: '运行参数',
                children: (
                  <div className={styles.tabBlock}>
                    <Row gutter={16}>
                      <Col xs={24} md={6}>
                        <Form.Item name="timeout" label="超时（秒）">
                          <InputNumber min={1} max={600} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item name="retry_count" label="重试次数">
                          <InputNumber min={0} max={20} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item name="retry_delay" label="重试延迟（秒）">
                          <InputNumber min={0} max={60} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={6}>
                        <Form.Item name="wait_time" label="请求后等待（秒）">
                          <InputNumber min={0} max={120} style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="user_agent" label="User-Agent">
                      <Input placeholder="留空则由后端使用默认 UA" />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col xs={12} md={6}>
                        <Form.Item name="follow_redirects" label="跟随重定向" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name="verify_ssl" label="校验证书" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name="javascript_enabled" label="启用 Headless" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                      <Col xs={12} md={6}>
                        <Form.Item name="screenshot" label="执行截图" valuePropName="checked">
                          <Switch />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="is_active" label="规则启用" valuePropName="checked">
                      <Switch checkedChildren="启用" unCheckedChildren="停用" />
                    </Form.Item>
                  </div>
                ),
              },
              {
                key: 'json',
                label: 'JSON 配置',
                children: (
                  <div className={styles.tabBlock}>
                    <Paragraph className={styles.muted}>复杂字段按 JSON 编辑。常用 schema 已与后端文档保持一致。</Paragraph>
                    <Row gutter={16}>
                      <Col xs={24} lg={12}>
                        <Form.Item name="headers_json" label="Headers JSON">
                          <Input.TextArea rows={7} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Form.Item name="params_json" label="Params JSON">
                          <Input.TextArea rows={7} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Form.Item name="body_json" label="Body JSON / 文本">
                      <Input.TextArea rows={6} className={styles.codeArea} />
                    </Form.Item>
                    <Row gutter={16}>
                      <Col xs={24} lg={12}>
                        <Form.Item name="selectors_json" label="Selectors JSON">
                          <Input.TextArea rows={8} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Form.Item name="data_extraction_json" label="Data Extraction JSON">
                          <Input.TextArea rows={8} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col xs={24} lg={8}>
                        <Form.Item name="pagination_json" label="Pagination JSON">
                          <Input.TextArea rows={7} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={8}>
                        <Form.Item name="proxy_config_json" label="Proxy Config JSON">
                          <Input.TextArea rows={7} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={8}>
                        <Form.Item name="cookies_json" label="Cookies JSON">
                          <Input.TextArea rows={7} className={styles.codeArea} />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>

      <Modal open={testModalOpen} title={testingRule ? `测试规则：${testingRule.name}` : '测试规则'} width={960} onCancel={() => setTestModalOpen(false)} onOk={() => void handleRunTest()} okText="执行测试" confirmLoading={testing}>
        <Form form={testForm} layout="vertical" initialValues={DEFAULT_TEST_FORM}>
          <Form.Item name="test_url" label="测试 URL" rules={[{ required: true, message: '请输入测试 URL' }]}>
            <Input placeholder="https://example.com/article/123" />
          </Form.Item>
          <Form.Item name="override_json" label="覆盖配置 JSON（可选）">
            <Input.TextArea rows={7} className={styles.codeArea} />
          </Form.Item>
        </Form>

        {testResult ? (
          <>
            <Divider />
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="执行状态" value={testResult.success ? '成功' : '失败'} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="状态码" value={testResult.status_code ?? '-'} />
                </Card>
              </Col>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic title="耗时" value={testResult.response_time ?? 0} suffix="ms" />
                </Card>
              </Col>
            </Row>
            <Descriptions bordered size="small" column={1} className={styles.resultPanel}>
              <Descriptions.Item label="最终 URL">{testResult.url ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="错误信息">{testResult.error || '-'}</Descriptions.Item>
              <Descriptions.Item label="提取结果">
                <pre className={styles.resultCode}>{prettyJson(testResult.data ?? testResult.extracted ?? {}, '{}')}</pre>
              </Descriptions.Item>
              <Descriptions.Item label="原始 HTML">
                <pre className={styles.resultCode}>{testResult.raw_html || '-'}</pre>
              </Descriptions.Item>
            </Descriptions>
          </>
        ) : null}
      </Modal>

      <Drawer open={usagesOpen} title={usageRule ? `规则引用：${usageRule.name}` : '规则引用'} width={760} onClose={() => setUsagesOpen(false)}>
        <Table<CrawlerRuleUsage>
          rowKey={(record) => `${record.workflow_id}-${record.node_id}`}
          loading={usagesLoading}
          dataSource={usages}
          columns={[
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
          ]}
          locale={{ emptyText: '当前没有检测到工作流引用这个规则。' }}
          pagination={false}
        />
      </Drawer>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
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
  Tag,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import PageHero from '@/components/PageHero';
import {
  createKnowledge,
  deleteKnowledge,
  getKnowledge,
  getKnowledgeSummary,
  listKnowledge,
  runKnowledgeSearchTest,
  setKnowledgeStatus,
  updateKnowledge,
} from '@/api/knowledgeBase';
import type {
  KnowledgeCategory,
  KnowledgeDetail,
  KnowledgeItem,
  KnowledgePayload,
  KnowledgeScope,
  KnowledgeSearchTestResult,
  KnowledgeSummary,
} from '@/types/knowledgeBase';
import styles from './KnowledgeBase.module.scss';

const { Paragraph, Text } = Typography;

type FilterStatus = 'all' | 'active' | 'inactive';

interface KnowledgeFormValues {
  scope: KnowledgeScope;
  user_id?: number;
  category: KnowledgeCategory;
  target: string;
  title: string;
  content: string;
  tags_text: string;
  is_active: boolean;
}

interface SearchFormValues {
  query: string;
  user_id?: number;
  limit: number;
}

const categoryOptions: Array<{ value: KnowledgeCategory; label: string; color: string }> = [
  { value: 'node_usage', label: '节点用法', color: 'blue' },
  { value: 'error_repair', label: '错误修复', color: 'red' },
  { value: 'best_practice', label: '最佳实践', color: 'green' },
  { value: 'scene_template', label: '场景模板', color: 'purple' },
];

const DEFAULT_FORM_VALUES: KnowledgeFormValues = {
  scope: 'system',
  category: 'best_practice',
  target: '',
  title: '',
  content: '',
  tags_text: '',
  is_active: true,
};

const DEFAULT_SEARCH_VALUES: SearchFormValues = {
  query: '',
  limit: 5,
};

function detailToFormValues(detail: KnowledgeDetail): KnowledgeFormValues {
  return {
    scope: detail.scope,
    user_id: detail.user_id ?? undefined,
    category: detail.category,
    target: detail.target ?? '',
    title: detail.title,
    content: detail.content,
    tags_text: detail.tags.join(', '),
    is_active: detail.is_active,
  };
}

function parseTags(text: string) {
  return Array.from(
    new Set(
      text
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toPayload(values: KnowledgeFormValues): KnowledgePayload {
  return {
    user_id: values.scope === 'private' ? values.user_id ?? null : null,
    category: values.category,
    target: values.target.trim(),
    title: values.title.trim(),
    content: values.content.trim(),
    tags: parseTags(values.tags_text),
    is_active: values.is_active,
  };
}

function getCategoryMeta(category: KnowledgeCategory) {
  return categoryOptions.find((item) => item.value === category) ?? categoryOptions[0];
}

function getScopeMeta(scope: KnowledgeScope) {
  return scope === 'system'
    ? { color: 'geekblue', label: '系统公共' }
    : { color: 'gold', label: '用户私有' };
}

function getStatusMeta(active: boolean) {
  return active ? { color: 'green', label: '启用中' } : { color: 'default', label: '已停用' };
}

export default function KnowledgeBasePage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<KnowledgeFormValues>();
  const [searchForm] = Form.useForm<SearchFormValues>();
  const scope = Form.useWatch('scope', form);

  const [summary, setSummary] = useState<KnowledgeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | KnowledgeScope>('all');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<KnowledgeSearchTestResult | null>(null);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const payload = await getKnowledgeSummary();
      setSummary(payload);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载知识库概览失败');
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const payload = await listKnowledge({
        keyword: keyword || undefined,
        category: category === 'all' ? undefined : category,
        scope: scopeFilter,
        is_active: status === 'all' ? undefined : status === 'active',
        page,
        page_size: pageSize,
      });
      setItems(payload.list);
      setTotal(payload.total);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载知识条目失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    void loadList();
  }, [keyword, category, scopeFilter, status, page, pageSize]);

  const reloadAll = async (nextPage = page) => {
    await Promise.all([
      loadSummary(),
      listKnowledge({
        keyword: keyword || undefined,
        category: category === 'all' ? undefined : category,
        scope: scopeFilter,
        is_active: status === 'all' ? undefined : status === 'active',
        page: nextPage,
        page_size: pageSize,
      }).then((payload) => {
        setItems(payload.list);
        setTotal(payload.total);
      }),
    ]);
  };

  const openCreateDrawer = () => {
    setEditingId(null);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (record: KnowledgeItem) => {
    setDrawerOpen(true);
    setEditingId(record.id);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    try {
      const detail = await getKnowledge(record.id);
      form.setFieldsValue(detailToFormValues(detail));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载知识详情失败');
      setDrawerOpen(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = toPayload(values);
      setSaving(true);
      if (editingId) {
        await updateKnowledge(editingId, payload);
        message.success('知识条目已更新');
      } else {
        await createKnowledge(payload);
        message.success('知识条目已创建');
      }
      setDrawerOpen(false);
      setPage(1);
      await reloadAll(1);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: KnowledgeItem) => {
    try {
      await deleteKnowledge(record.id);
      message.success('知识条目已删除');
      await reloadAll(page);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除知识条目失败');
    }
  };

  const handleStatusChange = async (record: KnowledgeItem, checked: boolean) => {
    try {
      await setKnowledgeStatus(record.id, checked);
      message.success(`知识条目已${checked ? '启用' : '停用'}`);
      setItems((current) => current.map((item) => (item.id === record.id ? { ...item, is_active: checked } : item)));
      void loadSummary();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '更新状态失败');
    }
  };

  const handleRunSearch = async () => {
    try {
      const values = await searchForm.validateFields();
      setSearchLoading(true);
      const result = await runKnowledgeSearchTest({
        query: values.query.trim(),
        user_id: values.user_id || undefined,
        limit: values.limit,
      });
      setSearchResult(result);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      }
    } finally {
      setSearchLoading(false);
    }
  };

  const columns: ColumnsType<KnowledgeItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      render: (value: string, record) => (
        <Button type="link" onClick={() => void openEditDrawer(record)}>
          {value}
        </Button>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (value: KnowledgeCategory) => {
        const meta = getCategoryMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '目标',
      dataIndex: 'target',
      width: 140,
      render: (value: string) => value || <Text type="secondary">通用</Text>,
    },
    {
      title: '范围',
      dataIndex: 'scope',
      width: 120,
      render: (value: KnowledgeScope, record) => {
        const meta = getScopeMeta(value);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {record.user_id ? <Text type="secondary">用户 #{record.user_id}</Text> : null}
          </Space>
        );
      },
    },
    {
      title: '内容摘要',
      dataIndex: 'content_excerpt',
      render: (value: string) => <div className={styles.excerpt}>{value || '-'}</div>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 220,
      render: (value: string[]) =>
        value.length > 0 ? (
          <div className={styles.tagRow}>
            {value.slice(0, 4).map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
            {value.length > 4 ? <Tag>+{value.length - 4}</Tag> : null}
          </div>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: '状态',
      key: 'status',
      width: 150,
      render: (_value, record) => {
        const meta = getStatusMeta(record.is_active);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Switch size="small" checked={record.is_active} onChange={(checked) => void handleStatusChange(record, checked)} />
          </Space>
        );
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 180,
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => void openEditDrawer(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除这个知识条目？"
            description="删除后不会参与知识检索。"
            onConfirm={() => void handleDelete(record)}
          >
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
        eyebrow="RAG / Knowledge Base"
        title="知识库管理"
        description="集中维护 Alkaid 的软知识条目，包括节点用法、错误修复、最佳实践和场景模板，并支持直接验证检索效果。"
        tags={['公共知识', '用户私有知识', 'RAG 检索', '运营维护']}
        action={
          <Space>
            <Button onClick={() => void reloadAll(page)}>刷新</Button>
            <Button onClick={() => {
              setSearchResult(null);
              searchForm.setFieldsValue(DEFAULT_SEARCH_VALUES);
              setSearchOpen(true);
            }}
            >
              检索测试
            </Button>
            <Button type="primary" onClick={openCreateDrawer}>
              新建知识
            </Button>
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="知识条目总数" value={summary?.total ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="启用中" value={summary?.active ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="系统公共知识" value={summary?.system_count ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="用户私有知识" value={summary?.private_count ?? 0} loading={summaryLoading} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>知识条目列表</Paragraph>
            <Paragraph className={styles.muted}>按关键词、分类、范围和启停状态筛选，直接维护 Alkaid 的知识上下文。</Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder="搜索标题 / 内容 / target"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
              style={{ width: 260 }}
            />
            <Select
              value={category}
              onChange={(value) => {
                setPage(1);
                setCategory(value);
              }}
              style={{ width: 150 }}
              options={[
                { value: 'all', label: '全部分类' },
                ...categoryOptions.map((item) => ({ value: item.value, label: item.label })),
              ]}
            />
            <Select
              value={scopeFilter}
              onChange={(value) => {
                setPage(1);
                setScopeFilter(value);
              }}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '全部范围' },
                { value: 'system', label: '系统公共' },
                { value: 'private', label: '用户私有' },
              ]}
            />
            <Select<FilterStatus>
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: '全部状态' },
                { value: 'active', label: '仅启用' },
                { value: 'inactive', label: '仅停用' },
              ]}
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
                setCategory('all');
                setScopeFilter('all');
                setStatus('all');
                setPage(1);
              }}
            >
              重置
            </Button>
          </div>
        </div>

        <Table<KnowledgeItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
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
        title={editingId ? `编辑知识 #${editingId}` : '新建知识'}
        width={860}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES} className={styles.form}>
          <div className={styles.formGrid}>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="scope" label="知识范围" rules={[{ required: true, message: '请选择知识范围' }]}>
                  <Select
                    options={[
                      { value: 'system', label: '系统公共' },
                      { value: 'private', label: '用户私有' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="category" label="知识分类" rules={[{ required: true, message: '请选择知识分类' }]}>
                  <Select options={categoryOptions.map((item) => ({ value: item.value, label: item.label }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="user_id"
                  label="用户 ID"
                  rules={
                    scope === 'private'
                      ? [{ required: true, message: '用户私有知识必须填写用户 ID' }]
                      : []
                  }
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder="留空表示系统公共知识" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={10}>
                <Form.Item name="target" label="Target">
                  <Input placeholder="如 ai / crawler / output，可留空" />
                </Form.Item>
              </Col>
              <Col xs={24} md={14}>
                <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
                  <Input placeholder="例如：AI 节点调试建议" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入知识内容' }]}>
              <Input.TextArea rows={14} placeholder="这里填写会被 RAG 检索和注入给 Alkaid 的知识正文。" />
            </Form.Item>
            <Form.Item name="tags_text" label="标签">
              <Input.TextArea rows={3} placeholder="用逗号或换行分隔，例如：AI节点, 排错, 最佳实践" />
            </Form.Item>
            <Form.Item name="is_active" label="启用状态" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </div>
        </Form>
      </Drawer>

      <Modal
        open={searchOpen}
        title="知识检索测试"
        width={960}
        onCancel={() => setSearchOpen(false)}
        onOk={() => void handleRunSearch()}
        okText="执行检索"
        confirmLoading={searchLoading}
      >
        <Form form={searchForm} layout="vertical" initialValues={DEFAULT_SEARCH_VALUES}>
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item name="query" label="测试查询" rules={[{ required: true, message: '请输入测试查询' }]}>
                <Input placeholder="例如：AI 节点如何减少报错？" />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="user_id" label="用户 ID">
                <InputNumber min={1} style={{ width: '100%' }} placeholder="可选" />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="limit" label="返回条数">
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {searchResult ? (
          <>
            <div className={styles.searchSummary}>
              查询词：<Text strong>{searchResult.query}</Text>，共召回 <Text strong>{searchResult.total}</Text> 条知识
            </div>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={searchResult.list}
              columns={[
                {
                  title: '标题',
                  dataIndex: 'title',
                  render: (value: string, record: KnowledgeSearchTestResult['list'][number]) => (
                    <div>
                      <div>{value}</div>
                      <div className={styles.excerpt}>{record.content_excerpt}</div>
                    </div>
                  ),
                },
                {
                  title: '分类',
                  dataIndex: 'category',
                  width: 120,
                  render: (value: KnowledgeCategory) => {
                    const meta = getCategoryMeta(value);
                    return <Tag color={meta.color}>{meta.label}</Tag>;
                  },
                },
                {
                  title: '范围',
                  dataIndex: 'scope',
                  width: 120,
                  render: (value: KnowledgeScope, record: KnowledgeSearchTestResult['list'][number]) => {
                    const meta = getScopeMeta(value);
                    return (
                      <Space direction="vertical" size={4}>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        {record.user_id ? <Text type="secondary">用户 #{record.user_id}</Text> : null}
                      </Space>
                    );
                  },
                },
                {
                  title: 'Target',
                  dataIndex: 'target',
                  width: 140,
                  render: (value: string) => value || <Text type="secondary">通用</Text>,
                },
                {
                  title: '标签',
                  dataIndex: 'tags',
                  width: 220,
                  render: (value: string[]) =>
                    value.length > 0 ? (
                      <div className={styles.tagRow}>
                        {value.map((tag) => (
                          <Tag key={tag}>{tag}</Tag>
                        ))}
                      </div>
                    ) : (
                      <Text type="secondary">-</Text>
                    ),
                },
              ]}
            />
          </>
        ) : null}
      </Modal>
    </div>
  );
}

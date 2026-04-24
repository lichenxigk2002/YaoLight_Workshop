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
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
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

const categoryOptions: Array<{ value: KnowledgeCategory; labelKey: string; color: string }> = [
  { value: 'node_usage', labelKey: 'knowledgeBase.categoryNodeUsage', color: 'blue' },
  { value: 'error_repair', labelKey: 'knowledgeBase.categoryErrorRepair', color: 'red' },
  { value: 'best_practice', labelKey: 'knowledgeBase.categoryBestPractice', color: 'green' },
  { value: 'scene_template', labelKey: 'knowledgeBase.categorySceneTemplate', color: 'purple' },
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

export default function KnowledgeBasePage() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('knowledge_base');
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
      message.error(error instanceof Error ? error.message : t('knowledgeBase.loadSummaryFailed'));
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
      message.error(error instanceof Error ? error.message : t('knowledgeBase.loadListFailed'));
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
      message.error(error instanceof Error ? error.message : t('knowledgeBase.loadDetailFailed'));
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
        message.success(t('knowledgeBase.updateSuccess'));
      } else {
        await createKnowledge(payload);
        message.success(t('knowledgeBase.createSuccess'));
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
      message.success(t('knowledgeBase.deleteSuccess'));
      await reloadAll(page);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('knowledgeBase.deleteFailed'));
    }
  };

  const handleStatusChange = async (record: KnowledgeItem, checked: boolean) => {
    try {
      await setKnowledgeStatus(record.id, checked);
      message.success(checked ? t('knowledgeBase.enableSuccess') : t('knowledgeBase.disableSuccess'));
      setItems((current) => current.map((item) => (item.id === record.id ? { ...item, is_active: checked } : item)));
      void loadSummary();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('knowledgeBase.updateStatusFailed'));
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

  const getScopeMeta = (scopeValue: KnowledgeScope) =>
    scopeValue === 'system'
      ? { color: 'geekblue', label: t('knowledgeBase.scopeSystem') }
      : { color: 'gold', label: t('knowledgeBase.scopePrivate') };

  const getStatusMeta = (active: boolean) =>
    active
      ? { color: 'green', label: t('knowledgeBase.statusActive') }
      : { color: 'default', label: t('knowledgeBase.statusInactive') };

  const columns: ColumnsType<KnowledgeItem> = [
    {
      title: t('knowledgeBase.columnTitle'),
      dataIndex: 'title',
      render: (value: string, record) => (
        <Button type="link" onClick={() => void openEditDrawer(record)}>
          {value}
        </Button>
      ),
    },
    {
      title: t('knowledgeBase.columnCategory'),
      dataIndex: 'category',
      width: 120,
      render: (value: KnowledgeCategory) => {
        const meta = getCategoryMeta(value);
        return <Tag color={meta.color}>{t(meta.labelKey)}</Tag>;
      },
    },
    {
      title: t('knowledgeBase.columnTarget'),
      dataIndex: 'target',
      width: 140,
      render: (value: string) => value || <Text type="secondary">{t('knowledgeBase.targetGeneral')}</Text>,
    },
    {
      title: t('knowledgeBase.columnScope'),
      dataIndex: 'scope',
      width: 120,
      render: (value: KnowledgeScope, record) => {
        const meta = getScopeMeta(value);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            {record.user_id ? <Text type="secondary">{t('knowledgeBase.userIdDisplay', { id: record.user_id })}</Text> : null}
          </Space>
        );
      },
    },
    {
      title: t('knowledgeBase.columnExcerpt'),
      dataIndex: 'content_excerpt',
      render: (value: string) => <div className={styles.excerpt}>{value || '-'}</div>,
    },
    {
      title: t('knowledgeBase.columnTags'),
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
      title: t('knowledgeBase.columnStatus'),
      key: 'status',
      width: 150,
      render: (_value, record) => {
        const meta = getStatusMeta(record.is_active);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{meta.label}</Tag>
            <Switch size="small" checked={record.is_active} disabled={!canEdit} onChange={(checked) => void handleStatusChange(record, checked)} />
          </Space>
        );
      },
    },
    {
      title: t('knowledgeBase.columnUpdatedAt'),
      dataIndex: 'updated_at',
      width: 180,
    },
    {
      title: t('knowledgeBase.columnActions'),
      key: 'actions',
      width: 160,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => void openEditDrawer(record)}>
            {t('knowledgeBase.actionEdit')}
          </Button>
          {canEdit ? (
            <Popconfirm
              title={t('knowledgeBase.deleteConfirmTitle')}
              description={t('knowledgeBase.deleteConfirmDescription')}
              onConfirm={() => void handleDelete(record)}
            >
              <Button type="link" danger>
                {t('knowledgeBase.actionDelete')}
              </Button>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('knowledgeBase.heroEyebrow')}
        title={t('knowledgeBase.heroTitle')}
        description={t('knowledgeBase.heroDescription')}
        tags={[
          t('knowledgeBase.heroTagPublic'),
          t('knowledgeBase.heroTagPrivate'),
          t('knowledgeBase.heroTagSearch'),
          t('knowledgeBase.heroTagOps'),
        ]}
        action={
          <Space>
            <Button onClick={() => void reloadAll(page)}>{t('knowledgeBase.actionRefresh')}</Button>
            <Button onClick={() => {
              setSearchResult(null);
              searchForm.setFieldsValue(DEFAULT_SEARCH_VALUES);
              setSearchOpen(true);
            }}
            >
              {t('knowledgeBase.actionSearchTest')}
            </Button>
            {canEdit ? <Button type="primary" onClick={openCreateDrawer}>{t('knowledgeBase.actionCreate')}</Button> : null}
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('knowledgeBase.metricTotal')} value={summary?.total ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('knowledgeBase.metricActive')} value={summary?.active ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('knowledgeBase.metricSystem')} value={summary?.system_count ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('knowledgeBase.metricPrivate')} value={summary?.private_count ?? 0} loading={summaryLoading} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>{t('knowledgeBase.listTitle')}</Paragraph>
            <Paragraph className={styles.muted}>{t('knowledgeBase.listDescription')}</Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder={t('knowledgeBase.keywordPlaceholder')}
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
                { value: 'all', label: t('knowledgeBase.allCategories') },
                ...categoryOptions.map((item) => ({ value: item.value, label: t(item.labelKey) })),
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
                { value: 'all', label: t('knowledgeBase.allScopes') },
                { value: 'system', label: t('knowledgeBase.scopeSystem') },
                { value: 'private', label: t('knowledgeBase.scopePrivate') },
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
                { value: 'all', label: t('knowledgeBase.allStatuses') },
                { value: 'active', label: t('knowledgeBase.onlyActive') },
                { value: 'inactive', label: t('knowledgeBase.onlyInactive') },
              ]}
            />
            <Button
              type="primary"
              onClick={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
            >
              {t('knowledgeBase.actionQuery')}
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
              {t('knowledgeBase.actionReset')}
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
            showTotal: (value) => t('knowledgeBase.paginationTotal', { total: value }),
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 20);
            },
          }}
        />
      </Card>

      <Drawer
        title={editingId ? t('knowledgeBase.drawerEditTitle', { id: editingId }) : t('knowledgeBase.drawerCreateTitle')}
        width={860}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>{t('knowledgeBase.actionCancel')}</Button>
            {canEdit ? <Button type="primary" loading={saving} onClick={() => void handleSave()}>{t('knowledgeBase.actionSave')}</Button> : null}
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES} className={styles.form} disabled={!canEdit}>
          <div className={styles.formGrid}>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item name="scope" label={t('knowledgeBase.formScope')} rules={[{ required: true, message: t('knowledgeBase.formScopeRequired') }]}>
                  <Select
                    options={[
                      { value: 'system', label: t('knowledgeBase.scopeSystem') },
                      { value: 'private', label: t('knowledgeBase.scopePrivate') },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item name="category" label={t('knowledgeBase.formCategory')} rules={[{ required: true, message: t('knowledgeBase.formCategoryRequired') }]}>
                  <Select options={categoryOptions.map((item) => ({ value: item.value, label: t(item.labelKey) }))} />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item
                  name="user_id"
                  label={t('knowledgeBase.formUserId')}
                  rules={
                    scope === 'private'
                      ? [{ required: true, message: t('knowledgeBase.formUserIdRequired') }]
                      : []
                  }
                >
                  <InputNumber min={1} style={{ width: '100%' }} placeholder={t('knowledgeBase.formUserIdPlaceholder')} />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col xs={24} md={10}>
                <Form.Item name="target" label={t('knowledgeBase.formTarget')}>
                  <Input placeholder={t('knowledgeBase.formTargetPlaceholder')} />
                </Form.Item>
              </Col>
              <Col xs={24} md={14}>
                <Form.Item name="title" label={t('knowledgeBase.formTitle')} rules={[{ required: true, message: t('knowledgeBase.formTitleRequired') }]}>
                  <Input placeholder={t('knowledgeBase.formTitlePlaceholder')} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="content" label={t('knowledgeBase.formContent')} rules={[{ required: true, message: t('knowledgeBase.formContentRequired') }]}>
              <Input.TextArea rows={14} placeholder={t('knowledgeBase.formContentPlaceholder')} />
            </Form.Item>
            <Form.Item name="tags_text" label={t('knowledgeBase.formTags')}>
              <Input.TextArea rows={3} placeholder={t('knowledgeBase.formTagsPlaceholder')} />
            </Form.Item>
            <Form.Item name="is_active" label={t('knowledgeBase.formActiveStatus')} valuePropName="checked">
              <Switch checkedChildren={t('knowledgeBase.enable')} unCheckedChildren={t('knowledgeBase.disable')} />
            </Form.Item>
          </div>
        </Form>
      </Drawer>

      <Modal
        open={searchOpen}
        title={t('knowledgeBase.searchModalTitle')}
        width={960}
        onCancel={() => setSearchOpen(false)}
        onOk={() => void handleRunSearch()}
        okText={t('knowledgeBase.searchModalOk')}
        confirmLoading={searchLoading}
      >
        <Form form={searchForm} layout="vertical" initialValues={DEFAULT_SEARCH_VALUES}>
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item name="query" label={t('knowledgeBase.searchQuery')} rules={[{ required: true, message: t('knowledgeBase.searchQueryRequired') }]}>
                <Input placeholder={t('knowledgeBase.searchQueryPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="user_id" label={t('knowledgeBase.formUserId')}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder={t('knowledgeBase.optional')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="limit" label={t('knowledgeBase.searchLimit')}>
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>

        {searchResult ? (
          <>
            <div className={styles.searchSummary}>
              {t('knowledgeBase.searchSummaryPrefix')}: <Text strong>{searchResult.query}</Text>, {t('knowledgeBase.searchSummaryTotal', { total: searchResult.total })}
            </div>
            <Table
              rowKey="id"
              pagination={false}
              dataSource={searchResult.list}
              columns={[
                {
                  title: t('knowledgeBase.columnTitle'),
                  dataIndex: 'title',
                  render: (value: string, record: KnowledgeSearchTestResult['list'][number]) => (
                    <div>
                      <div>{value}</div>
                      <div className={styles.excerpt}>{record.content_excerpt}</div>
                    </div>
                  ),
                },
                {
                  title: t('knowledgeBase.columnCategory'),
                  dataIndex: 'category',
                  width: 120,
                  render: (value: KnowledgeCategory) => {
                    const meta = getCategoryMeta(value);
                    return <Tag color={meta.color}>{t(meta.labelKey)}</Tag>;
                  },
                },
                {
                  title: t('knowledgeBase.columnScope'),
                  dataIndex: 'scope',
                  width: 120,
                  render: (value: KnowledgeScope, record: KnowledgeSearchTestResult['list'][number]) => {
                    const meta = getScopeMeta(value);
                    return (
                      <Space direction="vertical" size={4}>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        {record.user_id ? <Text type="secondary">{t('knowledgeBase.userIdDisplay', { id: record.user_id })}</Text> : null}
                      </Space>
                    );
                  },
                },
                {
                  title: t('knowledgeBase.columnTarget'),
                  dataIndex: 'target',
                  width: 140,
                  render: (value: string) => value || <Text type="secondary">{t('knowledgeBase.targetGeneral')}</Text>,
                },
                {
                  title: t('knowledgeBase.columnTags'),
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

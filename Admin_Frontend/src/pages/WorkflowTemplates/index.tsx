import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  Empty,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined } from '@ant-design/icons';
import ReactFlow, { Background, BackgroundVariant, Edge, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import {
  createWorkflowTemplate,
  deleteWorkflowTemplate,
  getWorkflowTemplate,
  getSourceWorkflowCanvas,
  getWorkflowTemplateSummary,
  listWorkflowTemplates,
  searchSourceWorkflows,
  syncWorkflowTemplate,
  updateWorkflowTemplate,
} from '@/api/workflowTemplates';
import type {
  WorkflowTemplateDetail,
  WorkflowTemplateCanvas,
  WorkflowTemplateListItem,
  WorkflowTemplatePayload,
  WorkflowTemplateSourceWorkflowItem,
  WorkflowTemplateStatus,
  WorkflowTemplateSummary,
} from '@/types/workflowTemplates';
import styles from './WorkflowTemplates.module.scss';

const { Paragraph, Text } = Typography;
type PreviewNode = Node<{ label: ReactNode }>;
type PreviewEdge = Edge;

interface TemplateFormValues {
  source_workflow_id?: number;
  name: string;
  description?: string;
  category?: string;
  tags_text?: string;
  status: WorkflowTemplateStatus;
  is_public: boolean;
}

const DEFAULT_FORM_VALUES: TemplateFormValues = {
  name: '',
  status: 'draft',
  is_public: false,
};

function parseTags(text?: string) {
  return Array.from(
    new Set(
      (text || '')
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function toFormValues(detail: WorkflowTemplateDetail): TemplateFormValues {
  return {
    name: detail.name,
    description: detail.description || undefined,
    category: detail.category || undefined,
    tags_text: detail.tags.join(', '),
    status: detail.status,
    is_public: detail.is_public,
  };
}

function toPayload(values: TemplateFormValues): WorkflowTemplatePayload {
  return {
    source_workflow_id: values.source_workflow_id,
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    category: values.category?.trim() || undefined,
    tags: parseTags(values.tags_text),
    status: values.status,
    is_public: values.is_public,
  };
}

function toPreviewGraph(canvas: WorkflowTemplateCanvas, t: (key: string, params?: Record<string, string | number>) => string) {
  const nodes: PreviewNode[] = [
    ...(canvas.nodes || []).map((node) => ({
      id: node.id,
      position: node.position || { x: 0, y: 0 },
      data: {
        label: (
          <div className={styles.previewNodeInner}>
            <strong>{node.data?.label || t(`workflowTemplateCanvas.node.${node.type}.label`)}</strong>
            <span>{node.type}</span>
          </div>
        ),
      },
      style: {
        borderRadius: 14,
        border: '1px solid #91caff',
        background: '#ffffff',
        width: 180,
        padding: 0,
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
      },
      draggable: false,
      selectable: false,
    })),
    ...(canvas.commentCards || []).map((card) => ({
      id: card.id,
      position: card.position || { x: 0, y: 0 },
      data: {
        label: (
          <div className={styles.previewCommentInner}>
            <strong>{t('workflowTemplateCanvas.commentTitle')}</strong>
            <span>{card.data?.text || t('workflowTemplateCanvas.canvasNote')}</span>
          </div>
        ),
      },
      style: {
        borderRadius: 14,
        border: '1px solid rgba(212, 177, 6, 0.28)',
        background: card.data?.color || '#fffacd',
        width: 180,
        padding: 0,
        boxShadow: '0 10px 24px rgba(15, 23, 42, 0.06)',
      },
      draggable: false,
      selectable: false,
    })),
  ];

  const edges: PreviewEdge[] = (canvas.edges || []).map((edge) => ({
    id: edge.id || `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    animated: false,
  }));

  return { nodes, edges };
}

function getStatusOptions(t: (key: string, params?: Record<string, string | number>) => string) {
  return [
    { value: 'draft' as const, label: t('workflowTemplates.statusDraft'), color: 'default' },
    { value: 'published' as const, label: t('workflowTemplates.statusPublished'), color: 'green' },
    { value: 'archived' as const, label: t('workflowTemplates.statusArchived'), color: 'orange' },
    { value: 'disabled' as const, label: t('workflowTemplates.statusDisabled'), color: 'red' },
  ];
}

export default function WorkflowTemplatesPage() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const { locale, t } = useI18n();
  const [form] = Form.useForm<TemplateFormValues>();

  const [summary, setSummary] = useState<WorkflowTemplateSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [items, setItems] = useState<WorkflowTemplateListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [categoryInput, setCategoryInput] = useState('');
  const [category, setCategory] = useState('');
  const [publicFilter, setPublicFilter] = useState<'all' | 'public' | 'private'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [detail, setDetail] = useState<WorkflowTemplateDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [sourceOptions, setSourceOptions] = useState<WorkflowTemplateSourceWorkflowItem[]>([]);
  const [sourceSearching, setSourceSearching] = useState(false);
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);
  const [sourcePreviewCanvas, setSourcePreviewCanvas] = useState<WorkflowTemplateCanvas | null>(null);
  const [sourcePreviewTarget, setSourcePreviewTarget] = useState<WorkflowTemplateSourceWorkflowItem | null>(null);

  const isEditing = editingId !== null;
  const statusOptions = useMemo(() => getStatusOptions(t), [t]);
  const selectedSourceWorkflowId = Form.useWatch('source_workflow_id', form);
  const sourcePreviewGraph = useMemo(
    () => (sourcePreviewCanvas ? toPreviewGraph(sourcePreviewCanvas, t) : { nodes: [] as PreviewNode[], edges: [] as PreviewEdge[] }),
    [sourcePreviewCanvas, t],
  );

  const getStatusMeta = (value: WorkflowTemplateStatus) =>
    statusOptions.find((item) => item.value === value) ?? statusOptions[0];

  async function loadSummary() {
    setSummaryLoading(true);
    try {
      const payload = await getWorkflowTemplateSummary();
      setSummary(payload);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }

  async function loadList() {
    setLoading(true);
    try {
      const payload = await listWorkflowTemplates({
        keyword: keyword || undefined,
        status: status === 'all' ? undefined : status,
        category: category || undefined,
        is_public: publicFilter === 'all' ? undefined : publicFilter === 'public',
        page,
        page_size: pageSize,
      });
      setItems(payload.list);
      setTotal(payload.total);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSourceWorkflowOptions(search = '') {
    setSourceSearching(true);
    try {
      const payload = await searchSourceWorkflows(search);
      setSourceOptions(payload.list);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSourceSearching(false);
    }
  }

  async function openSourcePreview(sourceWorkflowId?: number) {
    if (!sourceWorkflowId) {
      return;
    }

    setSourcePreviewOpen(true);
    setSourcePreviewLoading(true);
    setSourcePreviewTarget(sourceWorkflowOptionMap.get(sourceWorkflowId) || null);
    setSourcePreviewCanvas(null);

    try {
      const payload = await getSourceWorkflowCanvas(sourceWorkflowId);
      setSourcePreviewCanvas(payload);
    } catch (error) {
      message.error((error as Error).message);
      setSourcePreviewCanvas(null);
    } finally {
      setSourcePreviewLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    void loadList();
  }, [keyword, status, category, publicFilter, page, pageSize]);

  async function reloadAll(nextPage = page) {
    await Promise.all([
      loadSummary(),
      listWorkflowTemplates({
        keyword: keyword || undefined,
        status: status === 'all' ? undefined : status,
        category: category || undefined,
        is_public: publicFilter === 'all' ? undefined : publicFilter === 'public',
        page: nextPage,
        page_size: pageSize,
      }).then((payload) => {
        setItems(payload.list);
        setTotal(payload.total);
      }),
    ]);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditingId(null);
    setDetail(null);
    form.resetFields();
  }

  function openCreateDrawer() {
    setEditingId(null);
    setDetail(null);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    setDrawerOpen(true);
    void loadSourceWorkflowOptions();
  }

  async function openEditDrawer(record: WorkflowTemplateListItem) {
    setDrawerOpen(true);
    setEditingId(record.id);
    setDetail(null);
    try {
      const payload = await getWorkflowTemplate(record.id);
      setDetail(payload);
      form.setFieldsValue(toFormValues(payload));
    } catch (error) {
      message.error((error as Error).message);
      closeDrawer();
    }
  }

  async function handleSave() {
    try {
      const values = await form.validateFields();
      const payload = toPayload(values);
      setSaving(true);

      if (editingId) {
        const updated = await updateWorkflowTemplate(editingId, payload);
        setDetail(updated);
        message.success(t('workflowTemplates.updateSuccess'));
      } else {
        const created = await createWorkflowTemplate(payload);
        message.success(t('workflowTemplates.createSuccess'));
        closeDrawer();
        setPage(1);
        await reloadAll(1);
        navigate(`/workflow-templates/${created.id}/canvas`);
        return;
      }

      closeDrawer();
      setPage(1);
      await reloadAll(1);
    } catch (error) {
      if (typeof error === 'object' && error && 'errorFields' in error) {
        return;
      }
      message.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(record: WorkflowTemplateListItem) {
    try {
      await deleteWorkflowTemplate(record.id);
      message.success(t('workflowTemplates.deleteSuccess'));
      await reloadAll(page);
    } catch (error) {
      message.error((error as Error).message);
    }
  }

  async function handleSync(record: WorkflowTemplateListItem) {
    setSyncingId(record.id);
    try {
      const updated = await syncWorkflowTemplate(record.id);
      if (editingId === record.id) {
        setDetail(updated);
      }
      message.success(t('workflowTemplates.syncSuccess'));
      await reloadAll(page);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setSyncingId(null);
    }
  }

  async function handleCreateBlank() {
    try {
      const created = await createWorkflowTemplate({
        name: t('workflowTemplates.blankTemplateName'),
        tags: [],
        status: 'draft',
        is_public: false,
      });
      message.success(t('workflowTemplates.blankCreateSuccess'));
      await reloadAll(1);
      navigate(`/workflow-templates/${created.id}/canvas`);
    } catch (error) {
      message.error((error as Error).message);
    }
  }

  const sourceWorkflowOptionMap = useMemo(() => {
    const map = new Map<number, WorkflowTemplateSourceWorkflowItem>();
    sourceOptions.forEach((item) => map.set(item.id, item));
    return map;
  }, [sourceOptions]);

  const columns: ColumnsType<WorkflowTemplateListItem> = [
    {
      title: t('workflowTemplates.tableName'),
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button type="link" onClick={() => navigate(`/workflow-templates/${record.id}/canvas`)}>
          {value}
        </Button>
      ),
    },
    {
      title: t('workflowTemplates.tableCategory'),
      dataIndex: 'category',
      width: 140,
      render: (value?: string | null) => value || <Text type="secondary">{t('workflowTemplates.categoryEmpty')}</Text>,
    },
    {
      title: t('workflowTemplates.tableStatus'),
      dataIndex: 'status',
      width: 120,
      render: (value: WorkflowTemplateStatus) => {
        const meta = getStatusMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('workflowTemplates.tableVisibility'),
      dataIndex: 'is_public',
      width: 100,
      render: (value: boolean) => (
        <Tag color={value ? 'geekblue' : 'default'}>
          {value ? t('workflowTemplates.visibilityPublic') : t('workflowTemplates.visibilityPrivate')}
        </Tag>
      ),
    },
    {
      title: t('workflowTemplates.tableSourceWorkflow'),
      key: 'source',
      width: 220,
      render: (_value, record) =>
        record.source_workflow_id ? (
          <div className={styles.sourceMeta}>
            <Text strong>
              {record.source_workflow_name ||
                t('workflowTemplates.sourceWorkflowFallback', { id: record.source_workflow_id })}
            </Text>
            <Text type="secondary">
              {t('workflowTemplates.sourceWorkflowMeta', {
                id: record.source_workflow_id,
                username: record.source_username || t('common.none'),
              })}
            </Text>
          </div>
        ) : (
          <Text type="secondary">{t('workflowTemplates.unbound')}</Text>
        ),
    },
    {
      title: t('workflowTemplates.tableStructure'),
      key: 'structure',
      width: 160,
      render: (_value, record) => (
        <div className={styles.sourceMeta}>
          <Text>{t('workflowTemplates.structureNodes', { count: record.node_count })}</Text>
          <Text type="secondary">{t('workflowTemplates.structureComments', { count: record.comment_card_count })}</Text>
        </div>
      ),
    },
    {
      title: t('workflowTemplates.tableStats'),
      key: 'stats',
      width: 150,
      render: (_value, record) => (
        <div className={styles.sourceMeta}>
          <Text>{t('workflowTemplates.statsUsage', { count: record.usage_count })}</Text>
          <Text type="secondary">{t('workflowTemplates.statsExecution', { count: record.execution_count })}</Text>
        </div>
      ),
    },
    {
      title: t('workflowTemplates.tableUpdatedAt'),
      dataIndex: 'updated_at',
      width: 170,
      render: (value: string) => formatDateTime(value, locale, t('common.none')),
    },
    {
      title: t('workflowTemplates.tableActions'),
      key: 'actions',
      width: 220,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => navigate(`/workflow-templates/${record.id}/canvas`)}>
            {t('workflowTemplates.actionCanvas')}
          </Button>
          <Button type="link" onClick={() => void openEditDrawer(record)}>
            {t('workflowTemplates.actionEdit')}
          </Button>
          <Popconfirm
            title={locale === 'en-US' ? 'Sync from the source workflow?' : '确认从源工作流同步吗？'}
            description={locale === 'en-US' ? 'This will overwrite the current template nodes, edges, and comment cards.' : '这会覆盖当前模板的节点、连线和注释卡。'}
            onConfirm={() => void handleSync(record)}
            disabled={!record.source_workflow_id}
          >
            <Button
              type="link"
              loading={syncingId === record.id}
              disabled={!record.source_workflow_id}
            >
              {t('workflowTemplates.actionSync')}
            </Button>
          </Popconfirm>
          <Popconfirm
            title={t('workflowTemplates.deleteTitle')}
            description={t('workflowTemplates.deleteDescription')}
            onConfirm={() => void handleDelete(record)}
          >
            <Button type="link" danger>
              {t('workflowTemplates.actionDelete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('workflowTemplates.heroEyebrow')}
        title={t('workflowTemplates.heroTitle')}
        description={t('workflowTemplates.heroDescription')}
        tags={[
          t('workflowTemplates.tagClone'),
          t('workflowTemplates.tagPublish'),
          t('workflowTemplates.tagSync'),
          t('workflowTemplates.tagOperations'),
        ]}
        action={
          <Space>
            <Button onClick={() => void reloadAll(page)}>{t('workflowTemplates.actionRefresh')}</Button>
            <Button onClick={() => void handleCreateBlank()}>{t('workflowTemplates.actionCreateBlank')}</Button>
            <Button type="primary" onClick={openCreateDrawer}>
              {t('workflowTemplates.actionCreate')}
            </Button>
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.panel}>
          <Statistic title={t('workflowTemplates.metricTotal')} value={summary?.total ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.panel}>
          <Statistic
            title={t('workflowTemplates.metricPublished')}
            value={summary?.published ?? 0}
            loading={summaryLoading}
          />
        </Card>
        <Card bordered={false} className={styles.panel}>
          <Statistic title={t('workflowTemplates.metricPublic')} value={summary?.public ?? 0} loading={summaryLoading} />
        </Card>
        <Card bordered={false} className={styles.panel}>
          <Statistic
            title={t('workflowTemplates.metricDraftDisabled')}
            value={(summary?.draft ?? 0) + (summary?.disabled ?? 0)}
            loading={summaryLoading}
          />
        </Card>
      </div>

      <Card bordered={false} className={styles.panel}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>{t('workflowTemplates.listTitle')}</Paragraph>
            <Paragraph className={styles.muted}>{t('workflowTemplates.listDescription')}</Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder={t('workflowTemplates.searchPlaceholder')}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
              style={{ width: 260 }}
            />
            <Select
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              style={{ width: 140 }}
              options={[
                { value: 'all', label: t('workflowTemplates.statusAll') },
                ...statusOptions.map((item) => ({ value: item.value, label: item.label })),
              ]}
            />
            <Input
              allowClear
              placeholder={t('workflowTemplates.categoryFilterPlaceholder')}
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                setCategory(categoryInput.trim());
              }}
              style={{ width: 140 }}
            />
            <Select
              value={publicFilter}
              onChange={(value) => {
                setPage(1);
                setPublicFilter(value);
              }}
              style={{ width: 120 }}
              options={[
                { value: 'all', label: t('workflowTemplates.visibilityAll') },
                { value: 'public', label: t('workflowTemplates.visibilityPublic') },
                { value: 'private', label: t('workflowTemplates.visibilityPrivate') },
              ]}
            />
            <Button
              type="primary"
              onClick={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
                setCategory(categoryInput.trim());
              }}
            >
              {t('workflowTemplates.actionSearch')}
            </Button>
            <Button
              onClick={() => {
                setKeywordInput('');
                setKeyword('');
                setCategoryInput('');
                setCategory('');
                setStatus('all');
                setPublicFilter('all');
                setPage(1);
              }}
            >
              {t('workflowTemplates.actionReset')}
            </Button>
          </div>
        </div>

        <Table<WorkflowTemplateListItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{ x: 1480 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => t('workflowTemplates.tableTotal', { total: value }),
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 20);
            },
          }}
        />
      </Card>

      <Drawer
        title={
          isEditing
            ? t('workflowTemplates.drawerEditTitle', { id: editingId as number })
            : t('workflowTemplates.drawerCreateTitle')
        }
        width={960}
        open={drawerOpen}
        onClose={closeDrawer}
        extra={
          <Space>
            {isEditing && detail?.source_workflow_id ? (
              <Popconfirm
                title={locale === 'en-US' ? 'Sync from the source workflow?' : '确认从源工作流同步吗？'}
                description={locale === 'en-US' ? 'This will overwrite the current template nodes, edges, and comment cards.' : '这会覆盖当前模板的节点、连线和注释卡。'}
                onConfirm={() =>
                  void handleSync({
                    id: detail.id,
                    name: detail.name,
                    description: detail.description,
                    status: detail.status,
                    category: detail.category,
                    tags: detail.tags,
                    is_public: detail.is_public,
                    source_workflow_id: detail.source_workflow_id,
                    source_workflow_name: detail.source_workflow_name,
                    source_username: detail.source_username,
                    node_count: detail.node_count,
                    comment_card_count: detail.comment_card_count,
                    usage_count: detail.usage_count,
                    execution_count: detail.execution_count,
                    last_executed_at: detail.last_executed_at,
                    created_at: detail.created_at,
                    updated_at: detail.updated_at,
                  })
                }
              >
                <Button loading={syncingId === detail.id}>
                  {t('workflowTemplates.drawerSyncFromSource')}
                </Button>
              </Popconfirm>
            ) : null}
            <Button onClick={closeDrawer}>{t('workflowTemplates.actionCancel')}</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSave()}>
              {t('workflowTemplates.actionSave')}
            </Button>
          </Space>
        }
      >
        <div className={styles.drawerSection}>
          <Paragraph className={styles.drawerHint}>
            {isEditing ? t('workflowTemplates.drawerEditHint') : t('workflowTemplates.drawerCreateHint')}
          </Paragraph>

          <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES}>
            <div className={styles.formGrid}>
              {!isEditing ? (
                <Form.Item
                  label={t('workflowTemplates.formSourceWorkflow')}
                  className={styles.fullSpan}
                >
                  <div className={styles.sourcePickerRow}>
                    <Form.Item
                      name="source_workflow_id"
                      noStyle
                      rules={[{ required: true, message: t('workflowTemplates.formSourceWorkflowRequired') }]}
                    >
                      <Select
                        showSearch
                        filterOption={false}
                        placeholder={t('workflowTemplates.formSourceWorkflowPlaceholder')}
                        loading={sourceSearching}
                        onSearch={(value) => {
                          void loadSourceWorkflowOptions(value);
                        }}
                        onDropdownVisibleChange={(open) => {
                          if (open && sourceOptions.length === 0) {
                            void loadSourceWorkflowOptions();
                          }
                        }}
                        onChange={(value: number) => {
                          const selected = sourceWorkflowOptionMap.get(value);
                          if (selected) {
                            if (!form.getFieldValue('name')) {
                              form.setFieldValue(
                                'name',
                                t('workflowTemplates.sourceNameDefault', {
                                  name: selected.name,
                                }),
                              );
                            }
                            if (!form.getFieldValue('description') && selected.description) {
                              form.setFieldValue('description', selected.description);
                            }
                          }
                        }}
                        options={sourceOptions.map((item) => ({
                          value: item.id,
                          label: (
                            <div className={styles.sourceOption}>
                              <span>{item.name}</span>
                              <span className={styles.sourceOptionMeta}>
                                {t('workflowTemplates.sourceOptionMeta', {
                                  id: item.id,
                                  username: item.username,
                                  nodes: item.node_count,
                                  status: item.status,
                                })}
                              </span>
                            </div>
                          ),
                        }))}
                      />
                    </Form.Item>
                    <Button
                      icon={<EyeOutlined />}
                      onClick={() => void openSourcePreview(selectedSourceWorkflowId)}
                      disabled={!selectedSourceWorkflowId}
                      aria-label={locale === 'en-US' ? 'Preview source workflow' : '预览源工作流'}
                    />
                  </div>
                </Form.Item>
              ) : null}

              <Form.Item
                name="name"
                label={t('workflowTemplates.formName')}
                rules={[{ required: true, message: t('workflowTemplates.formNameRequired') }]}
              >
                <Input placeholder={t('workflowTemplates.formNamePlaceholder')} />
              </Form.Item>

              <Form.Item name="category" label={t('workflowTemplates.formCategory')}>
                <Input placeholder={t('workflowTemplates.formCategoryPlaceholder')} />
              </Form.Item>

              <Form.Item
                name="status"
                label={t('workflowTemplates.formStatus')}
                rules={[{ required: true, message: t('workflowTemplates.formStatusRequired') }]}
              >
                <Select options={statusOptions.map((item) => ({ value: item.value, label: item.label }))} />
              </Form.Item>

              <Form.Item name="is_public" label={t('workflowTemplates.formVisibility')} valuePropName="checked">
                <Switch
                  checkedChildren={t('workflowTemplates.visibilityPublic')}
                  unCheckedChildren={t('workflowTemplates.visibilityPrivate')}
                />
              </Form.Item>

              <Form.Item name="description" label={t('workflowTemplates.formDescription')} className={styles.fullSpan}>
                <Input.TextArea rows={3} placeholder={t('workflowTemplates.formDescriptionPlaceholder')} />
              </Form.Item>

              <Form.Item name="tags_text" label={t('workflowTemplates.formTags')} className={styles.fullSpan}>
                <Input.TextArea rows={2} placeholder={t('workflowTemplates.formTagsPlaceholder')} />
              </Form.Item>
            </div>
          </Form>

          {detail ? (
            <>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>{t('workflowTemplates.summaryNodes')}</span>
                  <div className={styles.summaryValue}>{detail.node_count}</div>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>{t('workflowTemplates.summaryEdges')}</span>
                  <div className={styles.summaryValue}>{detail.edge_count}</div>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>{t('workflowTemplates.summaryComments')}</span>
                  <div className={styles.summaryValue}>{detail.comment_card_count}</div>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryLabel}>{t('workflowTemplates.summaryUsage')}</span>
                  <div className={styles.summaryValue}>{detail.usage_count}</div>
                </div>
              </div>

              <Descriptions bordered size="small" column={2}>
                <Descriptions.Item label={t('workflowTemplates.detailSourceWorkflow')}>
                  {detail.source_workflow_id ? (
                    <span>
                      {detail.source_workflow_name ||
                        t('workflowTemplates.sourceWorkflowFallback', { id: detail.source_workflow_id })}{' '}
                      #{detail.source_workflow_id}
                      {detail.source_username ? ` / ${detail.source_username}` : ''}
                    </span>
                  ) : (
                    t('workflowTemplates.unbound')
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('workflowTemplates.detailVersion')}>
                  {detail.version || t('common.none')}
                </Descriptions.Item>
                <Descriptions.Item label={t('workflowTemplates.detailLastExecutedAt')}>
                  {formatDateTime(detail.last_executed_at, locale, t('common.none'))}
                </Descriptions.Item>
                <Descriptions.Item label={t('workflowTemplates.detailUpdatedAt')}>
                  {formatDateTime(detail.updated_at, locale, t('common.none'))}
                </Descriptions.Item>
              </Descriptions>

              <div>
                <Paragraph className={styles.toolbarTitle}>{t('workflowTemplates.detailNodeTypeSummary')}</Paragraph>
                <div className={styles.nodeTypeList}>
                  {detail.node_type_stats.length > 0 ? (
                    detail.node_type_stats.map((item) => (
                      <Tag key={item.node_type} color="blue">
                        {item.node_type} x {item.count}
                      </Tag>
                    ))
                  ) : (
                    <Text type="secondary">{t('workflowTemplates.emptyNodeStructure')}</Text>
                  )}
                </div>
              </div>

              <div>
                <Paragraph className={styles.toolbarTitle}>{t('workflowTemplates.detailTags')}</Paragraph>
                <div className={styles.tagRow}>
                  {detail.tags.length > 0 ? (
                    detail.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)
                  ) : (
                    <Text type="secondary">{t('workflowTemplates.emptyTags')}</Text>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Drawer>

      <Modal
        open={sourcePreviewOpen}
        title={
          sourcePreviewTarget
            ? `${locale === 'en-US' ? 'Workflow Preview' : '工作流预览'}: ${sourcePreviewTarget.name}`
            : locale === 'en-US'
              ? 'Workflow Preview'
              : '工作流预览'
        }
        width={980}
        footer={null}
        onCancel={() => setSourcePreviewOpen(false)}
      >
        <div className={styles.previewMeta}>
          <Text type="secondary">
            {sourcePreviewTarget
              ? t('workflowTemplates.sourceOptionMeta', {
                  id: sourcePreviewTarget.id,
                  username: sourcePreviewTarget.username,
                  nodes: sourcePreviewTarget.node_count,
                  status: sourcePreviewTarget.status,
                })
              : locale === 'en-US'
                ? 'Canvas snapshot'
                : '画布结构预览'}
          </Text>
        </div>
        <div className={styles.previewCanvas}>
          {sourcePreviewCanvas && sourcePreviewGraph.nodes.length > 0 ? (
            <ReactFlow
              nodes={sourcePreviewGraph.nodes}
              edges={sourcePreviewGraph.edges}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              zoomOnDoubleClick={false}
              proOptions={{ hideAttribution: true }}
            >
              <MiniMap />
              <Background variant={BackgroundVariant.Dots} gap={14} size={1} />
            </ReactFlow>
          ) : (
            <div className={styles.previewEmpty}>
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  sourcePreviewLoading
                    ? locale === 'en-US'
                      ? 'Loading workflow preview...'
                      : '正在加载工作流预览...'
                    : locale === 'en-US'
                      ? 'This workflow has no drawable canvas yet.'
                      : '这个工作流目前还没有可预览的画布。'
                }
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

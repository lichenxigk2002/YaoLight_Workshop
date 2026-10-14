import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  App,
  Button,
  Card,
  Descriptions,
  Dropdown,
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
import type { MenuProps } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, MoreOutlined } from '@ant-design/icons';
import ReactFlow, { Background, BackgroundVariant, Edge, MiniMap, Node } from 'reactflow';
import 'reactflow/dist/style.css';
import PageHero from '@/components/PageHero';
import { useAdminPermission } from '@/hooks/useAdminPermission';
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

function getConsentMeta(value: string, locale: string) {
  switch (value) {
    case 'agreed':
      return { color: 'green', label: locale === 'en-US' ? 'Author agreed' : '作者已同意' };
    case 'pending':
      return { color: 'gold', label: locale === 'en-US' ? 'Waiting' : '待确认' };
    case 'rejected':
      return { color: 'red', label: locale === 'en-US' ? 'Rejected' : '已拒绝' };
    case 'not_requested':
      return { color: 'default', label: locale === 'en-US' ? 'Not requested' : '未发起' };
    default:
      return { color: 'default', label: locale === 'en-US' ? 'Not needed' : '无需确认' };
  }
}

function buildListItemPayload(record: WorkflowTemplateListItem, status: WorkflowTemplateStatus): WorkflowTemplatePayload {
  return {
    source_workflow_id: record.source_workflow_id || undefined,
    name: record.name,
    description: record.description || undefined,
    category: record.category || undefined,
    tags: record.tags,
    status,
    is_public: record.is_public,
  };
}

function getPublishActionMeta(
  record: Pick<WorkflowTemplateListItem, 'status' | 'source_workflow_id' | 'consent_status'>,
  locale: string,
) {
  const isEnglish = locale === 'en-US';

  if (record.status === 'published') {
    return {
      disabled: true,
      label: isEnglish ? 'Published' : '已发布',
      title: isEnglish ? 'This template is already published.' : '该模板已发布。',
      description: isEnglish ? 'No additional publish action is needed.' : '当前不需要重复发布。',
    };
  }

  if (record.source_workflow_id) {
    if (record.consent_status === 'pending') {
      return {
        disabled: true,
        label: isEnglish ? 'Waiting' : '等待作者确认',
        title: isEnglish ? 'The consent request is still pending.' : '作者确认仍在等待中。',
        description: isEnglish
          ? 'Publish stays blocked until the source author responds.'
          : '在源作者响应之前，模板不会发布。',
      };
    }

    if (record.consent_status === 'agreed') {
      return {
        disabled: false,
        label: isEnglish ? 'Publish' : '发布模板',
        title: isEnglish ? 'Publish this template now?' : '确认立即发布该模板？',
        description: isEnglish
          ? 'The source author has agreed. This action will publish the template.'
          : '源作者已同意，此操作会直接发布模板。',
      };
    }

    return {
      disabled: false,
      label: record.consent_status === 'rejected'
        ? (isEnglish ? 'Request again' : '重新发起确认')
        : (isEnglish ? 'Request consent' : '发起作者确认'),
      title: record.consent_status === 'rejected'
        ? (isEnglish ? 'Send another consent request to the source author?' : '确认重新向源作者发起确认？')
        : (isEnglish ? 'Send a consent request to the source author?' : '确认向源作者发起确认？'),
      description: isEnglish
        ? 'The template will remain unpublished until the source author agrees.'
        : '模板会保持未发布状态，直到源作者同意。',
    };
  }

  return {
    disabled: false,
    label: isEnglish ? 'Publish' : '发布模板',
    title: isEnglish ? 'Publish this template now?' : '确认立即发布该模板？',
    description: isEnglish
      ? 'The template will become visible to the template library after publishing.'
      : '发布后模板才会进入模板库可见范围。',
  };
}

function showPublishConsentFeedback(
  detail: WorkflowTemplateDetail,
  requestedStatus: WorkflowTemplateStatus,
  locale: string,
  message: ReturnType<typeof App.useApp>['message'],
) {
  if (requestedStatus !== 'published' || detail.status === 'published') {
    return;
  }
  if (detail.consent_status === 'pending') {
    message.info(
      locale === 'en-US'
        ? 'Consent request sent. The template stays unpublished until approval.'
        : '已向源作者发起确认，模板会保持未发布状态，直到对方同意。',
    );
  }
}

export default function WorkflowTemplatesPage() {
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  const { locale, t } = useI18n();
  const { canEdit: canEditTemplate } = useAdminPermission('workflow_templates');
  const { canEdit: canEditCanvas } = useAdminPermission('workflow_templates.canvas');
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
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [sourceOptions, setSourceOptions] = useState<WorkflowTemplateSourceWorkflowItem[]>([]);
  const [sourceSearching, setSourceSearching] = useState(false);
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [sourcePreviewLoading, setSourcePreviewLoading] = useState(false);
  const [sourcePreviewCanvas, setSourcePreviewCanvas] = useState<WorkflowTemplateCanvas | null>(null);
  const [sourcePreviewTarget, setSourcePreviewTarget] = useState<WorkflowTemplateSourceWorkflowItem | null>(null);

  const isEditing = editingId !== null;
  const statusOptions = useMemo(() => getStatusOptions(t), [t]);
  const selectedSourceWorkflowId = Form.useWatch('source_workflow_id', form);
  const selectedStatus = Form.useWatch('status', form);
  const watchedFormValues = Form.useWatch([], form);
  const sourcePreviewGraph = useMemo(
    () => (sourcePreviewCanvas ? toPreviewGraph(sourcePreviewCanvas, t) : { nodes: [] as PreviewNode[], edges: [] as PreviewEdge[] }),
    [sourcePreviewCanvas, t],
  );
  const drawerHasUnsavedChanges = detail
    ? JSON.stringify(toPayload({ ...toFormValues(detail), ...(watchedFormValues || {}) })) !==
      JSON.stringify(buildListItemPayload(detail, detail.status))
    : false;

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
      setItems(Array.isArray(payload.list) ? payload.list : []);
      setTotal(payload.total ?? 0);
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
      setSourceOptions(Array.isArray(payload.list) ? payload.list : []);
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
    if (!canEditTemplate) {
      return;
    }
    setEditingId(null);
    setDetail(null);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    setDrawerOpen(true);
    void loadSourceWorkflowOptions();
  }

  async function openEditDrawer(record: WorkflowTemplateListItem) {
    if (!canEditTemplate) {
      return;
    }
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
    if (!canEditTemplate) {
      return;
    }
    try {
      const values = await form.validateFields();
      const payload = toPayload(values);
      setSaving(true);

      if (editingId) {
        const updated = await updateWorkflowTemplate(editingId, payload);
        setDetail(updated);
        message.success(t('workflowTemplates.updateSuccess'));
        showPublishConsentFeedback(updated, payload.status, locale, message);
      } else {
        const created = await createWorkflowTemplate(payload);
        message.success(t('workflowTemplates.createSuccess'));
        showPublishConsentFeedback(created, payload.status, locale, message);
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
    if (!canEditTemplate) {
      return;
    }
    try {
      await deleteWorkflowTemplate(record.id);
      message.success(t('workflowTemplates.deleteSuccess'));
      await reloadAll(page);
    } catch (error) {
      message.error((error as Error).message);
    }
  }

  async function handleSync(record: WorkflowTemplateListItem) {
    if (!canEditCanvas) {
      return;
    }
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

  async function handlePublish(record: WorkflowTemplateListItem) {
    if (!canEditTemplate) {
      return;
    }
    setPublishingId(record.id);
    try {
      const updated = await updateWorkflowTemplate(record.id, buildListItemPayload(record, 'published'));
      if (editingId === record.id) {
        setDetail(updated);
        form.setFieldsValue(toFormValues(updated));
      }
      if (updated.status === 'published') {
        message.success(locale === 'en-US' ? 'Template published.' : '模板已发布。');
      } else {
        showPublishConsentFeedback(updated, 'published', locale, message);
      }
      await reloadAll(page);
    } catch (error) {
      message.error((error as Error).message);
    } finally {
      setPublishingId(null);
    }
  }

  async function handleCreateBlank() {
    if (!canEditTemplate) {
      return;
    }
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
      width: 260,
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
      title: locale === 'en-US' ? 'Consent' : '作者确认',
      key: 'consent',
      width: 120,
      render: (_value, record) => {
        const consentMeta = getConsentMeta(record.consent_status, locale);
        return <Tag color={consentMeta.color}>{consentMeta.label}</Tag>;
      },
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
      width: 260,
      render: (_value, record) => {
        const publishMeta = getPublishActionMeta(record, locale);
        const moreItems: MenuProps['items'] = [
          ...(canEditTemplate ? [{ key: 'edit', label: t('workflowTemplates.actionEdit') }] : []),
          ...(canEditCanvas
            ? [{ key: 'sync', label: t('workflowTemplates.actionSync'), disabled: !record.source_workflow_id }]
            : []),
          ...(canEditTemplate ? [{ key: 'delete', label: <Text type="danger">{t('workflowTemplates.actionDelete')}</Text> }] : []),
        ];

        return (
          <Space size="small" wrap>
            <Button type="link" onClick={() => navigate(`/workflow-templates/${record.id}/canvas`)}>
              {t('workflowTemplates.actionCanvas')}
            </Button>
            {canEditTemplate ? (
              <Popconfirm
                title={publishMeta.title}
                description={publishMeta.description}
                onConfirm={() => void handlePublish(record)}
                disabled={publishMeta.disabled}
              >
                <Button type="link" loading={publishingId === record.id} disabled={publishMeta.disabled}>
                  {publishMeta.label}
                </Button>
              </Popconfirm>
            ) : null}
            {moreItems.length > 0 ? (
              <Dropdown
                trigger={['click']}
                menu={{
                  items: moreItems,
                  onClick: ({ key }) => {
                    if (key === 'edit') {
                      void openEditDrawer(record);
                      return;
                    }
                    if (key === 'sync') {
                      modal.confirm({
                        title: locale === 'en-US' ? 'Sync from the source workflow?' : '确认从源工作流同步吗？',
                        content:
                          locale === 'en-US'
                            ? 'This will overwrite the current template nodes, edges, and comment cards.'
                            : '这会覆盖当前模板的节点、连线和注释卡。',
                        onOk: async () => {
                          await handleSync(record);
                        },
                      });
                      return;
                    }
                    if (key === 'delete') {
                      modal.confirm({
                        title: t('workflowTemplates.deleteTitle'),
                        content: t('workflowTemplates.deleteDescription'),
                        okButtonProps: { danger: true },
                        onOk: async () => {
                          await handleDelete(record);
                        },
                      });
                    }
                  },
                }}
              >
                <Button type="text" icon={<MoreOutlined />} />
              </Dropdown>
            ) : null}
          </Space>
        );
      },
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
            {canEditTemplate ? (
              <Button onClick={() => void handleCreateBlank()}>{t('workflowTemplates.actionCreateBlank')}</Button>
            ) : null}
            {canEditTemplate ? (
              <Button type="primary" onClick={openCreateDrawer}>
                {t('workflowTemplates.actionCreate')}
              </Button>
            ) : null}
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
        rootClassName={styles.templateDrawer}
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
                    consent_status: detail.consent_status,
                    created_at: detail.created_at,
                    updated_at: detail.updated_at,
                  })
                }
              >
                <Button loading={syncingId === detail.id} disabled={!canEditCanvas}>
                  {t('workflowTemplates.drawerSyncFromSource')}
                </Button>
              </Popconfirm>
            ) : null}
            {isEditing && detail && canEditTemplate ? (
              <Popconfirm
                title={getPublishActionMeta(detail, locale).title}
                description={
                  drawerHasUnsavedChanges
                    ? (locale === 'en-US'
                        ? 'Save the current form changes before requesting publish.'
                        : '请先保存当前表单修改，再执行发起确认或发布。')
                    : getPublishActionMeta(detail, locale).description
                }
                onConfirm={() =>
                  void handlePublish({
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
                    consent_status: detail.consent_status,
                    created_at: detail.created_at,
                    updated_at: detail.updated_at,
                  })
                }
                disabled={drawerHasUnsavedChanges || getPublishActionMeta(detail, locale).disabled}
              >
                <Button
                  loading={publishingId === detail.id}
                  disabled={drawerHasUnsavedChanges || getPublishActionMeta(detail, locale).disabled}
                >
                  {getPublishActionMeta(detail, locale).label}
                </Button>
              </Popconfirm>
            ) : null}
            <Button onClick={closeDrawer}>{t('workflowTemplates.actionCancel')}</Button>
            <Button type="primary" loading={saving} onClick={() => void handleSave()} disabled={!canEditTemplate}>
              {t('workflowTemplates.actionSave')}
            </Button>
          </Space>
        }
      >
        <div className={styles.drawerSection}>
          <Paragraph className={styles.drawerHint}>
            {isEditing ? t('workflowTemplates.drawerEditHint') : t('workflowTemplates.drawerCreateHint')}
          </Paragraph>

          <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES} disabled={!canEditTemplate}>
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
                <Select
                  options={statusOptions
                    .filter((item) => item.value !== 'published' || selectedStatus === 'published')
                    .map((item) => ({
                      value: item.value,
                      label: item.label,
                      disabled: item.value === 'published',
                    }))}
                />
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
                <Descriptions.Item label={locale === 'en-US' ? 'Consent' : '作者确认'}>
                  <Tag color={getConsentMeta(detail.consent_status, locale).color}>
                    {getConsentMeta(detail.consent_status, locale).label}
                  </Tag>
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
            ? `${locale === 'en-US' ? 'Template preview' : '模板预览'}: ${sourcePreviewTarget.name}`
            : locale === 'en-US'
              ? 'Template preview'
              : '模板预览'
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
                      ? 'Preparing preview...'
                      : '正在准备预览...'
                    : locale === 'en-US'
                      ? 'Nothing to preview yet.'
                      : '暂时没有可预览内容。'
                }
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

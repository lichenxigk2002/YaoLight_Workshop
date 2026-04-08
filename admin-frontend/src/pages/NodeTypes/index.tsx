import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
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
import {
  createNodeType,
  deleteNodeType,
  getNodeType,
  getNodeTypeSummary,
  listNodeTypes,
  setNodeTypeStatus,
  updateNodeType,
} from '@/api/nodeTypes';
import { useI18n } from '@/i18n';
import type {
  NodeTypeDetail,
  NodeTypeListItem,
  NodeTypePayload,
  NodeTypeSummary,
} from '@/types/nodeTypes';
import styles from './NodeTypes.module.scss';

const { Paragraph, Text } = Typography;

type FilterStatus = 'all' | 'active' | 'inactive';
type FilterSystem = 'all' | 'system' | 'custom';

interface NodeTypeFormValues {
  name: string;
  category: string;
  icon: string;
  color: string;
  description: string;
  documentation: string;
  version: string;
  config_schema_json: string;
  default_config_json: string;
  examples_json: string;
  is_active: boolean;
}

const categoryOptions = [
  { value: 'start', label: 'start', color: 'green' },
  { value: 'crawler', label: 'crawler', color: 'blue' },
  { value: 'dataclean', label: 'dataclean', color: 'cyan' },
  { value: 'ai', label: 'ai', color: 'purple' },
  { value: 'condition', label: 'condition', color: 'orange' },
  { value: 'transform', label: 'transform', color: 'gold' },
  { value: 'loop', label: 'loop', color: 'magenta' },
  { value: 'merge', label: 'merge', color: 'geekblue' },
  { value: 'delay', label: 'delay', color: 'volcano' },
  { value: 'output', label: 'output', color: 'lime' },
  { value: 'end', label: 'end', color: 'red' },
  { value: 'custom', label: 'custom', color: 'default' },
] as const;

const DEFAULT_FORM_VALUES: NodeTypeFormValues = {
  name: '',
  category: 'custom',
  icon: '',
  color: '',
  description: '',
  documentation: '',
  version: '1.0.0',
  config_schema_json: '{}',
  default_config_json: '{}',
  examples_json: '[]',
  is_active: true,
};

function prettyJson(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return fallback;
  }
}

function parseJsonField(raw: string, fallback: unknown) {
  const text = raw.trim();
  if (!text) {
    return fallback;
  }
  return JSON.parse(text) as unknown;
}

function detailToFormValues(detail: NodeTypeDetail): NodeTypeFormValues {
  return {
    name: detail.name,
    category: detail.category,
    icon: detail.icon ?? '',
    color: detail.color ?? '',
    description: detail.description ?? '',
    documentation: detail.documentation ?? '',
    version: detail.version || '1.0.0',
    config_schema_json: prettyJson(detail.config_schema, '{}'),
    default_config_json: prettyJson(detail.default_config, '{}'),
    examples_json: prettyJson(detail.examples, '[]'),
    is_active: detail.is_active,
  };
}

function toPayload(values: NodeTypeFormValues): NodeTypePayload {
  return {
    name: values.name.trim(),
    category: values.category,
    icon: values.icon.trim() || null,
    color: values.color.trim() || null,
    description: values.description.trim() || null,
    documentation: values.documentation.trim() || null,
    version: values.version.trim() || '1.0.0',
    config_schema: parseJsonField(values.config_schema_json, {}),
    default_config: parseJsonField(values.default_config_json, {}),
    examples: parseJsonField(values.examples_json, []),
    is_active: values.is_active,
  };
}

function getCategoryMeta(category: string) {
  return categoryOptions.find((item) => item.value === category) ?? { value: category, label: category, color: 'default' };
}

function getStatusMeta(active: boolean) {
  return active ? { color: 'green', key: 'nodeTypes.statusActive' } : { color: 'default', key: 'nodeTypes.statusInactive' };
}

function getScopeMeta(isSystem: boolean) {
  return isSystem ? { color: 'geekblue', key: 'nodeTypes.systemNode' } : { color: 'gold', key: 'nodeTypes.customNode' };
}

export default function NodeTypesPage() {
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('node_types');
  const { message } = App.useApp();
  const [form] = Form.useForm<NodeTypeFormValues>();
  const [summary, setSummary] = useState<NodeTypeSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [items, setItems] = useState<NodeTypeListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [status, setStatus] = useState<FilterStatus>('all');
  const [systemFilter, setSystemFilter] = useState<FilterSystem>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDetail, setEditingDetail] = useState<NodeTypeDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedCategory = Form.useWatch('category', form) || DEFAULT_FORM_VALUES.category;
  const selectedCategoryMeta = getCategoryMeta(selectedCategory);

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const payload = await getNodeTypeSummary();
      setSummary(payload);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('nodeTypes.loadSummaryFailed'));
    } finally {
      setSummaryLoading(false);
    }
  };

  const loadList = async () => {
    setLoading(true);
    try {
      const payload = await listNodeTypes({
        keyword: keyword || undefined,
        category: category === 'all' ? undefined : category,
        is_active: status === 'all' ? undefined : status === 'active',
        is_system: systemFilter === 'all' ? undefined : systemFilter === 'system',
        page,
        page_size: pageSize,
      });
      setItems(payload.list);
      setTotal(payload.total);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('nodeTypes.loadListFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  useEffect(() => {
    void loadList();
  }, [keyword, category, status, systemFilter, page, pageSize]);

  const reloadAll = async (nextPage = page) => {
    await Promise.all([
      loadSummary(),
      listNodeTypes({
        keyword: keyword || undefined,
        category: category === 'all' ? undefined : category,
        is_active: status === 'all' ? undefined : status === 'active',
        is_system: systemFilter === 'all' ? undefined : systemFilter === 'system',
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
    setEditingDetail(null);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    setDrawerOpen(true);
  };

  const openEditDrawer = async (record: NodeTypeListItem) => {
    setDrawerOpen(true);
    setEditingId(record.id);
    setEditingDetail(null);
    form.setFieldsValue(DEFAULT_FORM_VALUES);
    try {
      const detail = await getNodeType(record.id);
      setEditingDetail(detail);
      form.setFieldsValue(detailToFormValues(detail));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('nodeTypes.loadDetailFailed'));
      setDrawerOpen(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = toPayload(values);
      setSaving(true);
      if (editingId) {
        await updateNodeType(editingId, payload);
        message.success(t('nodeTypes.updateSuccess'));
      } else {
        await createNodeType(payload);
        message.success(t('nodeTypes.createSuccess'));
      }
      setDrawerOpen(false);
      setPage(1);
      await reloadAll(1);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error(t('nodeTypes.saveFailed'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (record: NodeTypeListItem, checked: boolean) => {
    try {
      await setNodeTypeStatus(record.id, checked);
      message.success(t(checked ? 'nodeTypes.statusUpdateSuccessEnabled' : 'nodeTypes.statusUpdateSuccessDisabled'));
      setItems((current) => current.map((item) => (item.id === record.id ? { ...item, is_active: checked } : item)));
      void loadSummary();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('nodeTypes.statusUpdateFailed'));
    }
  };

  const handleDelete = async (record: NodeTypeListItem) => {
    try {
      await deleteNodeType(record.id);
      message.success(t('nodeTypes.deleteSuccess'));
      await reloadAll(page);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('nodeTypes.deleteFailed'));
    }
  };

  const columns: ColumnsType<NodeTypeListItem> = [
    {
      title: t('nodeTypes.tableNode'),
      dataIndex: 'name',
      render: (value: string, record) => (
        <Button type="link" onClick={() => void openEditDrawer(record)}>
          {value}
        </Button>
      ),
    },
    {
      title: t('nodeTypes.tableCategory'),
      dataIndex: 'category',
      width: 140,
      render: (value: string) => {
        const meta = getCategoryMeta(value);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('nodeTypes.tableType'),
      key: 'scope',
      width: 120,
      render: (_value, record) => {
        const meta = getScopeMeta(record.is_system);
        return <Tag color={meta.color}>{t(meta.key)}</Tag>;
      },
    },
    {
      title: t('nodeTypes.tableStatus'),
      key: 'status',
      width: 160,
      render: (_value, record) => {
        const meta = getStatusMeta(record.is_active);
        return (
          <Space direction="vertical" size={4}>
            <Tag color={meta.color}>{t(meta.key)}</Tag>
            <Switch size="small" checked={record.is_active} disabled={!canEdit} onChange={(checked) => void handleToggleStatus(record, checked)} />
          </Space>
        );
      },
    },
    { title: t('nodeTypes.tableVersion'), dataIndex: 'version', width: 120 },
    { title: t('nodeTypes.tableUsageCount'), dataIndex: 'usage_count', width: 120 },
    { title: t('nodeTypes.tableWorkflowCount'), dataIndex: 'workflow_count', width: 120 },
    { title: t('nodeTypes.tableUpdatedAt'), dataIndex: 'updated_at', width: 180 },
    {
      title: t('nodeTypes.tableActions'),
      key: 'actions',
      width: 220,
      render: (_value, record) => (
        <Space wrap>
          <Button type="link" onClick={() => void openEditDrawer(record)}>
            {t('nodeTypes.actionEdit')}
          </Button>
          {canEdit ? (
            <Popconfirm
              title={t('nodeTypes.deleteConfirmTitle')}
              description={t('nodeTypes.deleteConfirmDescription')}
              disabled={record.is_system}
              onConfirm={() => void handleDelete(record)}
            >
              <Button type="link" danger disabled={record.is_system}>
                {t('nodeTypes.actionDelete')}
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
        eyebrow={t('nodeTypes.eyebrow')}
        title={t('nodeTypes.title')}
        description={t('nodeTypes.description')}
        tags={[
          t('nodeTypes.tagDefinition'),
          t('nodeTypes.tagDefaultConfig'),
          t('nodeTypes.tagSchema'),
          t('nodeTypes.tagSystemProtection'),
        ]}
        action={
          <Space>
            <Button onClick={() => void reloadAll(page)}>{t('nodeTypes.actionRefresh')}</Button>
            {canEdit ? (
              <Button type="primary" onClick={openCreateDrawer}>
                {t('nodeTypes.actionCreate')}
              </Button>
            ) : null}
          </Space>
        }
      />

      <div className={styles.metrics}>
        <Card bordered={false} className={styles.metricCard} loading={summaryLoading}>
          <Statistic title={t('nodeTypes.metricTotal')} value={summary?.total ?? 0} />
        </Card>
        <Card bordered={false} className={styles.metricCard} loading={summaryLoading}>
          <Statistic title={t('nodeTypes.metricActive')} value={summary?.active ?? 0} />
        </Card>
        <Card bordered={false} className={styles.metricCard} loading={summaryLoading}>
          <Statistic title={t('nodeTypes.metricSystem')} value={summary?.system ?? 0} />
        </Card>
        <Card bordered={false} className={styles.metricCard} loading={summaryLoading}>
          <Statistic title={t('nodeTypes.metricWorkflowUsages')} value={summary?.workflow_usages ?? 0} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.toolbar}>
          <div>
            <Paragraph className={styles.toolbarTitle}>{t('nodeTypes.tableTitle')}</Paragraph>
            <Paragraph className={styles.muted}>
              {t('nodeTypes.tableDescription')}
            </Paragraph>
          </div>
          <div className={styles.filterBar}>
            <Input
              allowClear
              placeholder={t('nodeTypes.searchPlaceholder')}
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onPressEnter={() => {
                setPage(1);
                setKeyword(keywordInput.trim());
              }}
              style={{ width: 240 }}
            />
            <Select
              value={category}
              onChange={(value) => {
                setPage(1);
                setCategory(value);
              }}
              options={[{ value: 'all', label: t('nodeTypes.filterAllCategories') }, ...categoryOptions.map((item) => ({ value: item.value, label: item.label }))]}
              style={{ width: 150 }}
            />
            <Select<FilterSystem>
              value={systemFilter}
              onChange={(value) => {
                setPage(1);
                setSystemFilter(value);
              }}
              options={[
                { value: 'all', label: t('nodeTypes.filterAllTypes') },
                { value: 'system', label: t('nodeTypes.filterSystemType') },
                { value: 'custom', label: t('nodeTypes.filterCustomType') },
              ]}
              style={{ width: 140 }}
            />
            <Select<FilterStatus>
              value={status}
              onChange={(value) => {
                setPage(1);
                setStatus(value);
              }}
              options={[
                { value: 'all', label: t('nodeTypes.filterAllStatus') },
                { value: 'active', label: t('nodeTypes.filterOnlyActive') },
                { value: 'inactive', label: t('nodeTypes.filterOnlyInactive') },
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
              {t('nodeTypes.actionSearch')}
            </Button>
            <Button
              onClick={() => {
                setKeywordInput('');
                setKeyword('');
                setCategory('all');
                setStatus('all');
                setSystemFilter('all');
                setPage(1);
              }}
            >
              {t('nodeTypes.actionReset')}
            </Button>
          </div>
        </div>

        <Table<NodeTypeListItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => t('nodeTypes.paginationTotal', { total: value }),
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPage);
              setPageSize(nextPageSize || 20);
            },
          }}
        />
      </Card>

      <Drawer
        title={editingId ? `${t('nodeTypes.drawerEditTitle')} #${editingId}` : t('nodeTypes.drawerCreateTitle')}
        width={920}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>{t('nodeTypes.actionCancel')}</Button>
            {canEdit ? (
              <Button type="primary" loading={saving} onClick={() => void handleSave()}>
                {t('nodeTypes.actionSave')}
              </Button>
            ) : null}
          </Space>
        }
      >
        <Form form={form} layout="vertical" initialValues={DEFAULT_FORM_VALUES} className={styles.form} disabled={!canEdit}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label={t('nodeTypes.formNameLabel')} rules={[{ required: true, message: t('nodeTypes.formNameRequired') }]}>
                <Input placeholder={t('nodeTypes.formNamePlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="category" label={t('nodeTypes.formCategoryLabel')} rules={[{ required: true, message: t('nodeTypes.formCategoryRequired') }]}>
                <Select
                  disabled={Boolean(editingDetail?.is_system)}
                  options={categoryOptions.map((item) => ({ value: item.value, label: item.label }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className={styles.metaHint}>
            <Tag color={selectedCategoryMeta.color}>{selectedCategoryMeta.label}</Tag>
            {editingDetail?.is_system ? (
              <Text type="secondary">{t('nodeTypes.metaSystemHint')}</Text>
            ) : (
              <Text type="secondary">{t('nodeTypes.metaCustomHint')}</Text>
            )}
          </div>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="icon" label={t('nodeTypes.formIconLabel')}>
                <Input placeholder={t('nodeTypes.formIconPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="color" label={t('nodeTypes.formColorLabel')}>
                <Input placeholder={t('nodeTypes.formColorPlaceholder')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="version" label={t('nodeTypes.formVersionLabel')}>
                <Input placeholder={t('nodeTypes.formVersionPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label={t('nodeTypes.formDescriptionLabel')}>
            <Input.TextArea rows={3} placeholder={t('nodeTypes.formDescriptionPlaceholder')} />
          </Form.Item>

          <Form.Item name="documentation" label={t('nodeTypes.formDocumentationLabel')}>
            <Input.TextArea rows={5} placeholder={t('nodeTypes.formDocumentationPlaceholder')} />
          </Form.Item>

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Form.Item name="config_schema_json" label={t('nodeTypes.formConfigSchemaLabel')}>
                <Input.TextArea rows={12} className={styles.codeArea} />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item name="default_config_json" label={t('nodeTypes.formDefaultConfigLabel')}>
                <Input.TextArea rows={12} className={styles.codeArea} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="examples_json" label={t('nodeTypes.formExamplesLabel')}>
            <Input.TextArea rows={10} className={styles.codeArea} />
          </Form.Item>

          <Form.Item name="is_active" label={t('nodeTypes.formIsActiveLabel')} valuePropName="checked">
            <Switch checkedChildren={t('nodeTypes.switchEnabled')} unCheckedChildren={t('nodeTypes.switchDisabled')} />
          </Form.Item>

          {editingDetail ? (
            <Card bordered={false} className={styles.infoCard}>
              <Space wrap size={[12, 12]}>
                <Tag color={getScopeMeta(editingDetail.is_system).color}>{t(getScopeMeta(editingDetail.is_system).key)}</Tag>
                <Tag color={getStatusMeta(editingDetail.is_active).color}>{t(getStatusMeta(editingDetail.is_active).key)}</Tag>
                <Text type="secondary">{t('nodeTypes.detailUsageCount', { total: editingDetail.usage_count })}</Text>
                <Text type="secondary">{t('nodeTypes.detailWorkflowCount', { total: editingDetail.workflow_count })}</Text>
                <Text type="secondary">{t('nodeTypes.detailUpdatedAt', { time: editingDetail.updated_at })}</Text>
              </Space>
            </Card>
          ) : null}
        </Form>
      </Drawer>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { App, Button, Card, Input, InputNumber, Modal, Popconfirm, Select, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useNavigate } from 'react-router-dom';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import { deleteAIModel, exportAIModelsConfig, getAIModels, importAIModelsConfig } from '@/api/aiModels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import type { AIAdminModel, AIModelConfigExportItem, AIModelConfigExportPayload } from '@/types/aiModels';
import { getAIModelStatusLabel, getAIProviderLabel, getAIPricingTypeLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Text, Title } = Typography;

type ImportMode = 'create' | 'overwrite' | 'skip';

interface ImportDraftItem {
  key: string;
  exists: boolean;
  mode: ImportMode;
  provider: string;
  model_name: string;
  display_name: string;
  description?: string;
  status: 'active' | 'disabled' | 'testing';
  is_active: boolean;
  sort_order: number;
  capabilityText: string;
  pricingText: string;
}

function buildImportKey(provider: string, modelName: string) {
  return `${provider}::${modelName}`.toLowerCase();
}

function stringifyJson(value: unknown) {
  if (!value) return '';
  return JSON.stringify(value, null, 2);
}

function modeLabel(mode: ImportMode) {
  if (mode === 'create') return '新增';
  if (mode === 'overwrite') return '覆盖';
  return '跳过';
}

function modeColor(mode: ImportMode) {
  if (mode === 'create') return 'green';
  if (mode === 'overwrite') return 'blue';
  return 'default';
}

function buildDraftItems(
  payload: AIModelConfigExportPayload,
  models: AIAdminModel[],
): ImportDraftItem[] {
  const existingKeys = new Set(models.map((item) => buildImportKey(item.provider, item.model_name)));
  return payload.items.map((item) => {
    const exists = existingKeys.has(buildImportKey(item.provider, item.model_name));
    return {
      key: buildImportKey(item.provider, item.model_name),
      exists,
      mode: exists ? 'overwrite' : 'create',
      provider: item.provider,
      model_name: item.model_name,
      display_name: item.display_name,
      description: item.description,
      status: item.status,
      is_active: item.is_active,
      sort_order: item.sort_order,
      capabilityText: stringifyJson(item.capability),
      pricingText: stringifyJson(item.pricing),
    };
  });
}

function toImportItem(draft: ImportDraftItem): AIModelConfigExportItem {
  let capability: AIModelConfigExportItem['capability'] = null;
  let pricing: AIModelConfigExportItem['pricing'] = null;

  if (draft.capabilityText.trim()) {
    capability = JSON.parse(draft.capabilityText) as NonNullable<AIModelConfigExportItem['capability']>;
  }
  if (draft.pricingText.trim()) {
    pricing = JSON.parse(draft.pricingText) as NonNullable<AIModelConfigExportItem['pricing']>;
  }

  return {
    provider: draft.provider,
    model_name: draft.model_name,
    display_name: draft.display_name.trim() || draft.model_name,
    description: draft.description?.trim() || undefined,
    status: draft.status,
    is_active: draft.is_active,
    sort_order: draft.sort_order,
    capability,
    pricing,
  };
}

export default function ModelsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { locale, t } = useI18n();
  const { canEdit } = useAdminPermission('ai_models.models');
  const [models, setModels] = useState<AIAdminModel[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [pendingImportMeta, setPendingImportMeta] = useState<Pick<AIModelConfigExportPayload, 'version' | 'exported_at'> | null>(null);
  const [importDraftItems, setImportDraftItems] = useState<ImportDraftItem[]>([]);
  const [selectedImportKey, setSelectedImportKey] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadModels = async () => {
    const list = await getAIModels();
    setModels(list);
  };

  useEffect(() => {
    void loadModels();
  }, []);

  const selectedDraft = useMemo(
    () => importDraftItems.find((item) => item.key === selectedImportKey) ?? null,
    [importDraftItems, selectedImportKey],
  );

  const importSummary = useMemo(() => {
    return importDraftItems.reduce(
      (acc, item) => {
        acc.total += 1;
        acc[item.mode] += 1;
        return acc;
      },
      { total: 0, create: 0, overwrite: 0, skip: 0 },
    );
  }, [importDraftItems]);

  const handleDelete = async (record: AIAdminModel) => {
    try {
      setDeletingId(record.id);
      await deleteAIModel(record.id);
      setModels((current) => current.filter((item) => item.id !== record.id));
      message.success(t('aiModels.deleteSuccess'));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('aiModels.deleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const payload = await exportAIModelsConfig();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-models-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success(`已导出 ${payload.items.length} 个模型配置`);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '导出模型配置失败');
    } finally {
      setExporting(false);
    }
  };

  const openImportPicker = () => {
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text) as AIModelConfigExportPayload;
      if (!payload || !Array.isArray(payload.items)) {
        throw new Error('导入文件格式不正确');
      }
      const drafts = buildDraftItems(payload, models);
      setPendingImportMeta({ version: payload.version, exported_at: payload.exported_at });
      setImportDraftItems(drafts);
      setSelectedImportKey(drafts[0]?.key ?? null);
      setImportDialogOpen(true);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '读取导入文件失败');
    }
  };

  const updateDraft = (key: string, patch: Partial<ImportDraftItem>) => {
    setImportDraftItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  };

  const handleConfirmImport = async () => {
    if (!pendingImportMeta) return;
    try {
      setImporting(true);
      const createItems = importDraftItems.filter((item) => item.mode === 'create').map(toImportItem);
      const overwriteItems = importDraftItems.filter((item) => item.mode === 'overwrite').map(toImportItem);

      if (createItems.length === 0 && overwriteItems.length === 0) {
        message.info('没有需要导入的模型');
        setImportDialogOpen(false);
        setPendingImportMeta(null);
        setImportDraftItems([]);
        setSelectedImportKey(null);
        return;
      }

      const totals = { created: 0, updated: 0, skipped: 0 };

      if (createItems.length > 0) {
        const result = await importAIModelsConfig({
          ...pendingImportMeta,
          strategy: 'skip',
          items: createItems,
        });
        totals.created += result.created;
        totals.updated += result.updated;
        totals.skipped += result.skipped;
      }

      if (overwriteItems.length > 0) {
        const result = await importAIModelsConfig({
          ...pendingImportMeta,
          strategy: 'overwrite',
          items: overwriteItems,
        });
        totals.created += result.created;
        totals.updated += result.updated;
        totals.skipped += result.skipped;
      }

      await loadModels();
      setImportDialogOpen(false);
      setPendingImportMeta(null);
      setImportDraftItems([]);
      setSelectedImportKey(null);
      message.success(`导入完成：新增 ${totals.created}，更新 ${totals.updated}，跳过 ${totals.skipped}`);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '导入模型配置失败');
    } finally {
      setImporting(false);
    }
  };

  const importColumns: ColumnsType<ImportDraftItem> = [
    {
      title: '模型',
      render: (_value, record) => (
        <div>
          <div>{record.display_name}</div>
          <div className={styles.providerKey}>{record.model_name}</div>
        </div>
      ),
    },
    {
      title: '模型服务商',
      dataIndex: 'provider',
      render: (provider: string) => getAIProviderLabel(provider, t),
    },
    {
      title: '检查结果',
      render: (_value, record) => (
        <Tag color={record.exists ? 'gold' : 'green'}>{record.exists ? '已存在' : '新增'}</Tag>
      ),
    },
    {
      title: '导入动作',
      render: (_value, record) => <Tag color={modeColor(record.mode)}>{modeLabel(record.mode)}</Tag>,
    },
  ];

  return (
    <div className={styles.page}>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void handleImportFileChange(event)}
      />
      <div className={styles.toolbar}>
        <div>
          <Title level={3} className={styles.sectionTitle}>
            {t('aiModels.modelsTitle')}
          </Title>
          <Paragraph className={styles.muted}>{t('aiModels.modelsDescription')}</Paragraph>
        </div>
        <Space wrap>
          <Button onClick={() => void handleExport()} loading={exporting}>
            导出配置
          </Button>
          {canEdit ? (
            <>
              <Button onClick={openImportPicker}>导入配置</Button>
              <Button type="primary" onClick={() => navigate('/ai-models/models/new')}>
                {t('aiModels.createModel')}
              </Button>
            </>
          ) : null}
        </Space>
      </div>

      <Card bordered={false} className={styles.card}>
        <Table
          rowKey="id"
          dataSource={models}
          columns={[
            {
              title: t('aiModels.tableDisplayName'),
              dataIndex: 'display_name',
              render: (value: string, record: AIAdminModel) => (
                <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                  {value}
                </Button>
              ),
            },
            {
              title: t('aiModels.tableProvider'),
              dataIndex: 'provider',
              render: (provider: string) => (
                <div className={styles.providerCell}>
                  <ProviderIcon provider={provider} size={18} />
                  <div className={styles.providerCellText}>
                    <div>{getAIProviderLabel(provider, t)}</div>
                    <div className={styles.providerKey}>{provider}</div>
                  </div>
                </div>
              ),
            },
            { title: t('aiModels.tableModelName'), dataIndex: 'model_name' },
            {
              title: t('aiModels.tableStatus'),
              dataIndex: 'status',
              render: (status: string) => (
                <Tag color={status === 'active' ? 'green' : status === 'testing' ? 'blue' : 'default'}>
                  {getAIModelStatusLabel(status, t)}
                </Tag>
              ),
            },
            {
              title: t('aiModels.tablePricing'),
              key: 'pricing_type',
              render: (_: unknown, record: AIAdminModel) =>
                record.current_pricing?.pricing_type
                  ? getAIPricingTypeLabel(record.current_pricing.pricing_type, t)
                  : t('aiModels.pricingUnconfigured'),
            },
            {
              title: t('aiModels.tableRequests'),
              key: 'requests',
              render: (_: unknown, record: AIAdminModel) => new Intl.NumberFormat(locale).format(record.usage.requests),
            },
            {
              title: t('aiModels.tableActions'),
              key: 'actions',
              render: (_: unknown, record: AIAdminModel) => (
                <Space>
                  <Button type="link" onClick={() => navigate(`/ai-models/models/${record.id}`)}>
                    {t('aiModels.actionOpenDetail')}
                  </Button>
                  {canEdit ? (
                    <Popconfirm
                      title={t('aiModels.deleteConfirmTitle')}
                      description={t('aiModels.deleteConfirmDescription')}
                      okText={t('aiModels.actionDelete')}
                      cancelText={t('aiModels.actionCancel')}
                      okButtonProps={{ danger: true, loading: deletingId === record.id }}
                      onConfirm={() => void handleDelete(record)}
                    >
                      <Button type="link" danger loading={deletingId === record.id}>
                        {t('aiModels.actionDelete')}
                      </Button>
                    </Popconfirm>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="导入模型配置预检查"
        open={importDialogOpen}
        onOk={() => void handleConfirmImport()}
        onCancel={() => {
          if (importing) return;
          setImportDialogOpen(false);
          setPendingImportMeta(null);
          setImportDraftItems([]);
          setSelectedImportKey(null);
        }}
        okText="开始导入"
        cancelText={t('aiModels.actionCancel')}
        confirmLoading={importing}
        width={1120}
        bodyStyle={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto', paddingRight: 20 }}
      >
        <div className={styles.importPreviewSummary}>
          <Tag color="blue">总计 {importSummary.total}</Tag>
          <Tag color="green">新增 {importSummary.create}</Tag>
          <Tag color="geekblue">覆盖 {importSummary.overwrite}</Tag>
          <Tag>跳过 {importSummary.skip}</Tag>
        </div>

        <div className={styles.importPreviewLayout}>
          <div className={styles.importPreviewTable}>
            <Table
              size="small"
              rowKey="key"
              dataSource={importDraftItems}
              columns={importColumns}
              pagination={{ pageSize: 5 }}
              rowClassName={(record) => (record.key === selectedImportKey ? styles.importPreviewRowActive : '')}
              onRow={(record) => ({
                onClick: () => setSelectedImportKey(record.key),
              })}
            />
          </div>

          <div className={styles.importPreviewEditor}>
            {selectedDraft ? (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div>
                  <Title level={5} style={{ marginBottom: 4 }}>
                    {selectedDraft.provider} / {selectedDraft.model_name}
                  </Title>
                  <Text type="secondary">
                    {selectedDraft.exists ? '该模型已存在，可选择覆盖或跳过。' : '该模型为新增项，可修改后导入。'}
                  </Text>
                </div>

                <Space wrap>
                  <Tag color={selectedDraft.exists ? 'gold' : 'green'}>
                    {selectedDraft.exists ? '已存在' : '新增'}
                  </Tag>
                  <Select<ImportMode>
                    value={selectedDraft.mode}
                    style={{ width: 160 }}
                    onChange={(value) => updateDraft(selectedDraft.key, { mode: value })}
                    options={
                      selectedDraft.exists
                        ? [
                            { label: '覆盖导入', value: 'overwrite' },
                            { label: '跳过', value: 'skip' },
                          ]
                        : [
                            { label: '新增导入', value: 'create' },
                            { label: '跳过', value: 'skip' },
                          ]
                    }
                  />
                </Space>

                <Input
                  value={selectedDraft.display_name}
                  addonBefore="显示名称"
                  onChange={(event) => updateDraft(selectedDraft.key, { display_name: event.target.value })}
                />

                <Input.TextArea
                  rows={2}
                  value={selectedDraft.description}
                  placeholder="模型描述"
                  onChange={(event) => updateDraft(selectedDraft.key, { description: event.target.value })}
                />

                <div className={styles.importPreviewMetaGrid}>
                  <div>
                    <Text type="secondary">状态</Text>
                    <Select
                      value={selectedDraft.status}
                      style={{ width: '100%', marginTop: 6 }}
                      onChange={(value) => updateDraft(selectedDraft.key, { status: value })}
                      options={[
                        { label: 'Active', value: 'active' },
                        { label: 'Testing', value: 'testing' },
                        { label: 'Disabled', value: 'disabled' },
                      ]}
                    />
                  </div>
                  <div>
                    <Text type="secondary">排序</Text>
                    <InputNumber
                      value={selectedDraft.sort_order}
                      style={{ width: '100%', marginTop: 6 }}
                      onChange={(value) => updateDraft(selectedDraft.key, { sort_order: Number(value ?? 0) })}
                    />
                  </div>
                  <div>
                    <Text type="secondary">是否启用</Text>
                    <div className={styles.importPreviewSwitch}>
                      <Switch
                        checked={selectedDraft.is_active}
                        onChange={(checked) => updateDraft(selectedDraft.key, { is_active: checked })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Text strong>能力配置</Text>
                  <Input.TextArea
                    rows={7}
                    className={styles.importPreviewJson}
                    value={selectedDraft.capabilityText}
                    placeholder="留空则使用默认能力配置"
                    onChange={(event) => updateDraft(selectedDraft.key, { capabilityText: event.target.value })}
                  />
                </div>

                <div>
                  <Text strong>价格配置</Text>
                  <Input.TextArea
                    rows={7}
                    className={styles.importPreviewJson}
                    value={selectedDraft.pricingText}
                    placeholder="留空则不导入价格配置"
                    onChange={(event) => updateDraft(selectedDraft.key, { pricingText: event.target.value })}
                  />
                </div>
              </Space>
            ) : (
              <Paragraph className={styles.muted}>请选择一个导入项查看详情。</Paragraph>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

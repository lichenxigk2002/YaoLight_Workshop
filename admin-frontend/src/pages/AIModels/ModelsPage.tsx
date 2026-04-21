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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportKeyword, setExportKeyword] = useState('');
  const [exportProvider, setExportProvider] = useState<string | undefined>();
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
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

  const exportProviderOptions = useMemo(
    () =>
      Array.from(new Set(models.map((item) => item.provider)))
        .sort()
        .map((provider) => ({
          label: models.find((item) => item.provider === provider)?.provider_name || getAIProviderLabel(provider, t),
          value: provider,
        })),
    [models, t],
  );

  const filteredExportModels = useMemo(() => {
    const keyword = exportKeyword.trim().toLowerCase();
    return models.filter((item) => {
      if (exportProvider && item.provider !== exportProvider) return false;
      if (!keyword) return true;
      return [
        item.display_name,
        item.model_name,
        item.provider,
        item.provider_name || getAIProviderLabel(item.provider, t),
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword));
    });
  }, [exportKeyword, exportProvider, models, t]);

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

  const openExportDialog = () => {
    if (models.length === 0) {
      message.info('当前没有可导出的模型');
      return;
    }
    setExportKeyword('');
    setExportProvider(undefined);
    setSelectedExportIds(models.map((item) => item.id));
    setExportDialogOpen(true);
  };

  const handleExport = async () => {
    try {
      if (selectedExportIds.length === 0) {
        message.info('请先选择需要导出的模型');
        return;
      }
      setExporting(true);
      const payload = await exportAIModelsConfig();
      const selectedKeys = new Set(
        models
          .filter((item) => selectedExportIds.includes(item.id))
          .map((item) => buildImportKey(item.provider, item.model_name)),
      );
      const filteredPayload = {
        ...payload,
        items: payload.items.filter((item) => selectedKeys.has(buildImportKey(item.provider, item.model_name))),
      };
      if (filteredPayload.items.length === 0) {
        message.info('未匹配到可导出的模型配置');
        return;
      }
      const blob = new Blob([JSON.stringify(filteredPayload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai-models-export-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setExportDialogOpen(false);
      message.success(`已导出 ${filteredPayload.items.length} 个模型配置`);
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
      render: (provider: string, record) => record.provider_name || getAIProviderLabel(provider, t),
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

  const exportColumns: ColumnsType<AIAdminModel> = [
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
      render: (provider: string, record) => record.provider_name || getAIProviderLabel(provider, t),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => (
        <Tag color={status === 'active' ? 'green' : status === 'testing' ? 'blue' : 'default'}>
          {getAIModelStatusLabel(status, t)}
        </Tag>
      ),
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
          <Button onClick={openExportDialog}>
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
                    <div>{models.find((item) => item.provider === provider)?.provider_name || getAIProviderLabel(provider, t)}</div>
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
        title="选择导出模型"
        open={exportDialogOpen}
        onOk={() => void handleExport()}
        onCancel={() => {
          if (exporting) return;
          setExportDialogOpen(false);
        }}
        okText="开始导出"
        cancelText={t('aiModels.actionCancel')}
        confirmLoading={exporting}
        width={900}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space wrap>
              <Input
                placeholder="搜索模型名称、标识或服务商"
                value={exportKeyword}
                onChange={(event) => setExportKeyword(event.target.value)}
                style={{ width: 280 }}
              />
              <Select
                allowClear
                placeholder="全部服务商"
                value={exportProvider}
                onChange={(value) => setExportProvider(value)}
                options={exportProviderOptions}
                style={{ width: 180 }}
              />
            </Space>
            <Space>
              <Button onClick={() => setSelectedExportIds(filteredExportModels.map((item) => item.id))}>全选当前筛选结果</Button>
              <Button onClick={() => setSelectedExportIds([])}>清空选择</Button>
            </Space>
          </Space>

          <div className={styles.importPreviewSummary}>
            <Tag color="blue">当前筛选 {filteredExportModels.length}</Tag>
            <Tag color="green">已选择 {selectedExportIds.length}</Tag>
          </div>

          <Table
            size="small"
            rowKey="id"
            dataSource={filteredExportModels}
            columns={exportColumns}
            pagination={{ pageSize: 8 }}
            rowSelection={{
              selectedRowKeys: selectedExportIds,
              onChange: (keys) => setSelectedExportIds(keys as string[]),
              preserveSelectedRowKeys: true,
            }}
          />
        </Space>
      </Modal>

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

import { CloseOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Select, Space, Switch, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/i18n';
import {
  createAdminNotificationTemplate,
  getAdminNotificationTemplates,
  updateAdminNotificationTemplate,
  type AdminNotificationTemplate,
  type AdminNotificationTemplatePayload,
} from '../api';
import TemplateTokenEditor, { type TemplateTokenEditorRef } from './TemplateTokenEditor';
import styles from '../index.module.scss';

type TemplateFieldName = 'title_template' | 'content_template' | 'action_url_template';

interface TemplateVariablePreset {
  key: string;
  labelKey: string;
}

const templateVariablePresets: TemplateVariablePreset[] = [
  { key: 'user.username', labelKey: 'notifications.templates.variableUserName' },
  { key: 'notice_title', labelKey: 'notifications.templates.variableNoticeTitle' },
  { key: 'notice_content', labelKey: 'notifications.templates.variableNoticeContent' },
  { key: 'effective_time', labelKey: 'notifications.templates.variableEffectiveTime' },
  { key: 'action_url', labelKey: 'notifications.templates.variableActionUrl' },
  { key: 'campaign', labelKey: 'notifications.templates.variableCampaign' },
];

interface TemplatesPanelProps {
  refreshToken?: number;
  onChanged?: () => void;
}

interface TemplateFormValues {
  name: string;
  description?: string;
  type?: string;
  category?: string;
  title_template: string;
  content_template?: string;
  action_url_template?: string;
  is_active: boolean;
}

function formatDateTime(value: string) {
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

export default function TemplatesPanel({ refreshToken = 0, onChanged }: TemplatesPanelProps) {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<TemplateFormValues>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<AdminNotificationTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AdminNotificationTemplate | null>(null);
  const [activeTemplateField, setActiveTemplateField] = useState<TemplateFieldName>('title_template');
  const [query, setQuery] = useState({
    page: 1,
    page_size: 10,
    keyword: '',
    activeFilter: 'all',
  });
  const titleEditorRef = useRef<TemplateTokenEditorRef | null>(null);
  const contentEditorRef = useRef<TemplateTokenEditorRef | null>(null);
  const actionUrlEditorRef = useRef<TemplateTokenEditorRef | null>(null);
  const typeOptions = [
    { label: t('notifications.options.type.adminMessage'), value: 'admin_message' },
    { label: t('notifications.options.type.operationsUpdate'), value: 'operations_update' },
    { label: t('notifications.options.type.platformAnnouncement'), value: 'platform_announcement' },
  ];
  const categoryOptions = [
    { label: t('notifications.options.category.platform'), value: 'platform' },
    { label: t('notifications.options.category.operations'), value: 'operations' },
    { label: t('notifications.options.category.system'), value: 'system' },
  ];
  const activeFilterOptions = [
    { label: t('notifications.templates.filterAll'), value: 'all' },
    { label: t('notifications.templates.filterActive'), value: 'active' },
    { label: t('notifications.templates.filterInactive'), value: 'inactive' },
  ];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const isActive = query.activeFilter === 'all' ? undefined : query.activeFilter === 'active';

    getAdminNotificationTemplates({
      page: query.page,
      page_size: query.page_size,
      keyword: query.keyword || undefined,
      is_active: isActive,
    })
      .then((data) => {
        if (!cancelled) {
          setItems(data.list);
          setTotal(data.total);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
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
  }, [messageApi, query, refreshToken]);

  function openCreatePanel() {
    setEditingTemplate(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'admin_message',
      category: 'platform',
      is_active: true,
    });
    setActiveTemplateField('title_template');
    setEditorOpen(true);
  }

  function openEditPanel(template: AdminNotificationTemplate) {
    setEditingTemplate(template);
    form.setFieldsValue({
      name: template.name,
      description: template.description || undefined,
      type: template.type,
      category: template.category || undefined,
      title_template: template.title_template,
      content_template: template.content_template || undefined,
      action_url_template: template.action_url_template || undefined,
      is_active: template.is_active,
    });
    setActiveTemplateField('title_template');
    setEditorOpen(true);
  }

  function closeEditorPanel() {
    setEditorOpen(false);
    setEditingTemplate(null);
    form.resetFields();
    setActiveTemplateField('title_template');
  }

  async function handleSave(values: TemplateFormValues) {
    setSaving(true);
    const payload: AdminNotificationTemplatePayload = {
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      type: values.type,
      category: values.category?.trim() || undefined,
      title_template: values.title_template.trim(),
      content_template: values.content_template?.trim() || undefined,
      action_url_template: values.action_url_template?.trim() || undefined,
      is_active: values.is_active,
    };

    try {
      if (editingTemplate) {
        await updateAdminNotificationTemplate(editingTemplate.id, payload);
        messageApi.success(t('notifications.templates.updated'));
      } else {
        await createAdminNotificationTemplate(payload);
        messageApi.success(t('notifications.templates.created'));
      }

      closeEditorPanel();
      onChanged?.();
      setQuery((current) => ({ ...current }));
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function getFieldEditor(field: TemplateFieldName) {
    if (field === 'title_template') {
      return titleEditorRef.current;
    }
    if (field === 'content_template') {
      return contentEditorRef.current;
    }
    return actionUrlEditorRef.current;
  }

  function insertTemplateVariable(variableKey: string) {
    getFieldEditor(activeTemplateField)?.insertToken(variableKey);
  }

  const columns: ColumnsType<AdminNotificationTemplate> = [
    {
      title: t('notifications.templates.columnTemplate'),
      key: 'template',
      render: (_, record) => (
        <div className={styles.titleCell}>
          <span className={styles.titleText}>{record.name}</span>
          <span className={styles.contentText}>{record.description || t('common.none')}</span>
        </div>
      ),
    },
    {
      title: t('notifications.templates.columnType'),
      dataIndex: 'type',
      width: 150,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: t('notifications.templates.columnCategory'),
      dataIndex: 'category',
      width: 130,
      render: (value?: string | null) => value || t('common.none'),
    },
    {
      title: t('notifications.templates.columnStatus'),
      dataIndex: 'is_active',
      width: 110,
      render: (value: boolean) => (
        <Tag bordered={false} className={`${styles.softStatusTag} ${value ? styles.softStatusTagSuccess : styles.softStatusTagNeutral}`}>
          {value ? t('notifications.templates.statusActive') : t('notifications.templates.statusInactive')}
        </Tag>
      ),
    },
    {
      title: t('notifications.templates.columnUpdatedAt'),
      dataIndex: 'updated_at',
      width: 180,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t('notifications.templates.columnAction'),
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Button type="link" icon={<EditOutlined />} onClick={() => openEditPanel(record)}>
          {t('notifications.templates.edit')}
        </Button>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      <div className={styles.templateToolbar}>
        <Space wrap>
          <Input.Search
            allowClear
            placeholder={t('notifications.templates.searchPlaceholder')}
            style={{ width: 260 }}
            onSearch={(value) => setQuery((current) => ({ ...current, page: 1, keyword: value.trim() }))}
          />
          <Select
            value={query.activeFilter}
            style={{ width: 170 }}
            options={activeFilterOptions}
            onChange={(value) => setQuery((current) => ({ ...current, page: 1, activeFilter: value }))}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreatePanel}>
          {t('notifications.templates.newTemplate')}
        </Button>
      </div>

      {editorOpen ? (
        <section className={styles.templateEditorPanel}>
          <div className={styles.templateEditorHeader}>
            <div className={styles.templateEditorHeading}>
              <div className={styles.templateEditorTitle}>
                {editingTemplate ? t('notifications.templates.editModalTitle') : t('notifications.templates.createModalTitle')}
              </div>
              <div className={styles.templateEditorSubtitle}>{t('notifications.templates.panelHint')}</div>
            </div>
            <Button icon={<CloseOutlined />} onClick={closeEditorPanel}>
              {t('notifications.templates.cancelEdit')}
            </Button>
          </div>

          <Form<TemplateFormValues> layout="vertical" form={form} onFinish={(values) => void handleSave(values)}>
            <div className={styles.templateBuilder}>
              <div className={styles.templateBuilderTitle}>{t('notifications.templates.variableBuilderTitle')}</div>
              <div className={styles.templateBuilderDesc}>{t('notifications.templates.variableBuilderDesc')}</div>
              <div className={styles.templateVariablePresetList}>
                {templateVariablePresets.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={styles.templateVariablePreset}
                    draggable
                    onClick={() => insertTemplateVariable(preset.key)}
                    onDragStart={(event) => {
                      event.dataTransfer.setData('text/x-template-token', preset.key);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <span className={styles.templateVariablePresetKey}>{`{{${preset.key}}}`}</span>
                    <span className={styles.templateVariablePresetLabel}>{t(preset.labelKey)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.templateEditorGrid}>
              <Form.Item
                name="name"
                label={t('notifications.templates.name')}
                rules={[{ required: true, message: t('notifications.templates.nameRequired') }]}
              >
                <Input placeholder={t('notifications.templates.namePlaceholder')} />
              </Form.Item>

              <Form.Item name="description" label={t('notifications.templates.description')}>
                <Input placeholder={t('notifications.templates.descriptionPlaceholder')} />
              </Form.Item>

              <Form.Item name="type" label={t('notifications.templates.type')}>
                <Select options={typeOptions} />
              </Form.Item>

              <Form.Item name="category" label={t('notifications.templates.category')}>
                <Select allowClear options={categoryOptions} />
              </Form.Item>

              <Form.Item
                name="title_template"
                label={t('notifications.templates.titleTemplate')}
                rules={[{ required: true, message: t('notifications.templates.titleTemplateRequired') }]}
                className={styles.templateEditorWide}
              >
                <TemplateTokenEditor
                  ref={titleEditorRef}
                  placeholder={t('notifications.templates.titleTemplatePlaceholder')}
                  onFocus={() => setActiveTemplateField('title_template')}
                />
              </Form.Item>

              <Form.Item
                name="content_template"
                label={t('notifications.templates.contentTemplate')}
                className={styles.templateEditorWide}
              >
                <TemplateTokenEditor
                  ref={contentEditorRef}
                  rows={4}
                  placeholder={t('notifications.templates.contentTemplatePlaceholder')}
                  onFocus={() => setActiveTemplateField('content_template')}
                />
              </Form.Item>

              <Form.Item
                name="action_url_template"
                label={t('notifications.templates.actionUrlTemplate')}
                className={styles.templateEditorWide}
              >
                <TemplateTokenEditor
                  ref={actionUrlEditorRef}
                  placeholder={t('notifications.templates.actionUrlTemplatePlaceholder')}
                  onFocus={() => setActiveTemplateField('action_url_template')}
                />
              </Form.Item>
            </div>

            <div className={styles.templateEditorFooter}>
              <Form.Item name="is_active" label={t('notifications.templates.active')} valuePropName="checked" className={styles.templateEditorSwitch}>
                <Switch />
              </Form.Item>
              <div className={styles.templateEditorActions}>
                <Button onClick={closeEditorPanel}>{t('notifications.templates.cancelEdit')}</Button>
                <Button type="primary" loading={saving} onClick={() => form.submit()}>
                  {editingTemplate ? t('notifications.templates.saveEdit') : t('notifications.templates.saveCreate')}
                </Button>
              </div>
            </div>
          </Form>
        </section>
      ) : null}

      <Table<AdminNotificationTemplate>
        rowKey="id"
        loading={loading}
        dataSource={items}
        columns={columns}
        scroll={{ x: 1000 }}
        pagination={{
          current: query.page,
          pageSize: query.page_size,
          total,
          showSizeChanger: true,
          onChange: (page, pageSize) => {
            setQuery((current) => ({ ...current, page, page_size: pageSize || current.page_size }));
          },
        }}
      />
    </>
  );
}

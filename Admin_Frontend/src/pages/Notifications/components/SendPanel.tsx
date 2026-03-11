import { CloseOutlined, SendOutlined } from '@ant-design/icons';
import { Avatar, Button, Card, DatePicker, Form, Input, Select, Space, Tooltip, message } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { getAdminUsers } from '@/features/users/api';
import type { AdminUserListItem } from '@/features/users/types';
import { useI18n } from '@/i18n';
import {
  getAdminNotificationTemplates,
  sendAdminNotification,
  type AdminNotificationTemplate,
} from '../api';
import styles from '../index.module.scss';

const { TextArea } = Input;

interface SendPanelProps {
  onSent?: () => void;
}

interface SendFormValues {
  name?: string;
  recipient_ids: number[];
  template_id?: number;
  template_variables_json?: string;
  template_variable_values?: Record<string, string | Dayjs | null>;
  title?: string;
  content?: string;
  type?: string;
  category?: string;
  action_url?: string;
  expires_at?: Dayjs;
}

interface RecipientTagRenderProps {
  label: React.ReactNode;
  value: string | number;
  closable: boolean;
  onClose: (event?: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}

function mergeUsers(current: AdminUserListItem[], incoming: AdminUserListItem[]) {
  const map = new Map<number, AdminUserListItem>();
  current.forEach((item) => map.set(item.id, item));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function getUserStatusLabel(user: AdminUserListItem, t: (key: string, params?: Record<string, string | number>) => string) {
  switch (user.status) {
    case 'active':
      return t('users.statusActive');
    case 'inactive':
      return t('users.statusInactive');
    case 'suspended':
      return t('users.statusSuspended');
    default:
      return user.status;
  }
}

function getUserStatusTone(status: AdminUserListItem['status']) {
  switch (status) {
    case 'active':
      return 'success';
    case 'inactive':
      return 'neutral';
    case 'suspended':
      return 'danger';
    default:
      return 'neutral';
  }
}

function getUserStatusDotClass(status: AdminUserListItem['status']) {
  const tone = getUserStatusTone(status);
  return `statusDot${tone[0].toUpperCase()}${tone.slice(1)}`;
}

function extractTemplateVariables(template?: AdminNotificationTemplate | null) {
  if (!template) {
    return [];
  }

  const source = [template.title_template, template.content_template, template.action_url_template]
    .filter(Boolean)
    .join('\n');
  const matches = source.matchAll(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g);
  const values = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      values.add(match[1]);
    }
  }

  return Array.from(values);
}

function isSystemTemplateVariable(variable: string) {
  return variable.startsWith('user.');
}

function formatTemplateVariableLabel(variable: string) {
  return variable
    .split('.')
    .pop()
    ?.replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || variable;
}

function getTemplateVariableMeta(
  variable: string,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  switch (variable) {
    case 'notice_title':
      return {
        label: t('notifications.send.variableNoticeTitleLabel'),
        description: t('notifications.send.variableNoticeTitleDesc'),
      };
    case 'notice_content':
      return {
        label: t('notifications.send.variableNoticeContentLabel'),
        description: t('notifications.send.variableNoticeContentDesc'),
      };
    case 'effective_time':
      return {
        label: t('notifications.send.variableEffectiveTimeLabel'),
        description: t('notifications.send.variableEffectiveTimeDesc'),
      };
    case 'action_url':
      return {
        label: t('notifications.send.variableActionUrlLabel'),
        description: t('notifications.send.variableActionUrlDesc'),
      };
    case 'campaign':
      return {
        label: t('notifications.send.variableCampaignLabel'),
        description: t('notifications.send.variableCampaignDesc'),
      };
    case 'user.username':
      return {
        label: t('notifications.send.variableUserNameLabel'),
        description: t('notifications.send.variableUserNameDesc'),
      };
    default:
      return {
        label: formatTemplateVariableLabel(variable),
        description: t('notifications.send.variableFallbackDesc', {
          token: `{{${variable}}}`,
        }),
      };
  }
}

function getTemplateVariableInputType(variable: string) {
  if (variable === 'notice_content') {
    return 'textarea';
  }
  if (variable === 'effective_time') {
    return 'datetime';
  }
  if (variable === 'action_url') {
    return 'url';
  }

  if (/(^|[._-])(time|date|datetime)([._-]|$)/i.test(variable) || /(_at)$/i.test(variable)) {
    return 'datetime';
  }

  return 'text';
}

function normalizeTemplateVariableValue(variable: string, value: string | Dayjs | null | undefined) {
  if (value == null) {
    return '';
  }
  if (dayjs.isDayjs(value)) {
    if (getTemplateVariableInputType(variable) === 'datetime') {
      return value.format('YYYY-MM-DD HH:mm:ss');
    }
    return value.format('YYYY-MM-DD');
  }
  return String(value).trim();
}

function renderUserOption(
  user: AdminUserListItem,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return (
    <div className={styles.recipientOption}>
      <Avatar size={36} src={user.avatar_url ?? undefined} className={styles.recipientOptionAvatar}>
        {user.username.slice(0, 1).toUpperCase()}
      </Avatar>
      <div className={styles.recipientOptionBody}>
        <div className={styles.recipientOptionTopRow}>
          <span className={styles.recipientOptionName}>{user.username}</span>
          <span className={`${styles.recipientRoleBadge} ${styles[user.role === 'admin' ? 'roleAdmin' : 'roleUser']}`}>
            {user.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
          </span>
        </div>
        <span className={styles.recipientOptionMeta}>
          #{user.user_no} | {user.email || t('common.noEmail')}
        </span>
      </div>
    </div>
  );
}

function renderTemplateVariableLabel(label: string, variableKey: string) {
  return (
    <span className={styles.templateVariableLabelRow}>
      <span>{label}</span>
      <span className={styles.templateVariableLabelToken}>{`{{${variableKey}}}`}</span>
    </span>
  );
}

export default function SendPanel({ onSent }: SendPanelProps) {
  const { t } = useI18n();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<SendFormValues>();
  const templateId = Form.useWatch('template_id', form);
  const [submitting, setSubmitting] = useState(false);
  const [recipientLoading, setRecipientLoading] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [recipientOptions, setRecipientOptions] = useState<AdminUserListItem[]>([]);
  const [templates, setTemplates] = useState<AdminNotificationTemplate[]>([]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === templateId) ?? null,
    [templateId, templates],
  );
  const recipientMap = useMemo(
    () => new Map(recipientOptions.map((user) => [user.id, user])),
    [recipientOptions],
  );
  const notificationTypeOptions = useMemo(
    () => [
      { label: t('notifications.options.type.adminMessage'), value: 'admin_message' },
      { label: t('notifications.options.type.operationsUpdate'), value: 'operations_update' },
      { label: t('notifications.options.type.platformAnnouncement'), value: 'platform_announcement' },
    ],
    [t],
  );
  const notificationCategoryOptions = useMemo(
    () => [
      { label: t('notifications.options.category.platform'), value: 'platform' },
      { label: t('notifications.options.category.operations'), value: 'operations' },
      { label: t('notifications.options.category.system'), value: 'system' },
    ],
    [t],
  );
  const templateVariables = useMemo(
    () => extractTemplateVariables(selectedTemplate),
    [selectedTemplate],
  );
  const editableTemplateVariables = useMemo(
    () => templateVariables.filter((item) => !isSystemTemplateVariable(item)),
    [templateVariables],
  );
  const systemTemplateVariables = useMemo(
    () => templateVariables.filter((item) => isSystemTemplateVariable(item)),
    [templateVariables],
  );

  async function loadRecipients(keyword?: string) {
    setRecipientLoading(true);
    try {
      const data = await getAdminUsers({
        page: 1,
        page_size: 20,
        keyword: keyword?.trim() || undefined,
      });
      setRecipientOptions((current) => mergeUsers(current, data.list));
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setRecipientLoading(false);
    }
  }

  async function loadTemplates() {
    setTemplateLoading(true);
    try {
      const data = await getAdminNotificationTemplates({
        page: 1,
        page_size: 100,
        is_active: true,
      });
      setTemplates(data.list);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setTemplateLoading(false);
    }
  }

  useEffect(() => {
    form.setFieldsValue({
      type: 'admin_message',
      category: 'platform',
      template_variables_json: t('notifications.send.defaultTemplateVariables'),
    });
    void loadRecipients();
    void loadTemplates();
  }, [form, t]);

  useEffect(() => {
    if (!selectedTemplate) {
      form.setFieldValue('template_variable_values', undefined);
      return;
    }

    const currentValues = form.getFieldValue('template_variable_values') as
      | Record<string, string | Dayjs | null>
      | undefined;
    const nextValues = editableTemplateVariables.reduce<Record<string, string | Dayjs | null>>((result, key) => {
      result[key] = currentValues?.[key] || '';
      return result;
    }, {});

    form.setFieldValue('template_variable_values', nextValues);
  }, [editableTemplateVariables, form, selectedTemplate]);

  async function handleSubmit(values: SendFormValues) {
    setSubmitting(true);
    try {
      const templateVariablesPayload = values.template_id
        ? editableTemplateVariables.reduce<Record<string, string>>((result, key) => {
            result[key] = normalizeTemplateVariableValue(key, values.template_variable_values?.[key]);
            return result;
          }, {})
        : undefined;

      const result = await sendAdminNotification({
        name: values.name?.trim() || undefined,
        recipient_ids: values.recipient_ids,
        template_id: values.template_id,
        template_variables: values.template_id ? templateVariablesPayload : undefined,
        title: values.template_id ? undefined : values.title?.trim() || undefined,
        content: values.template_id ? undefined : values.content?.trim() || undefined,
        type: values.type,
        category: values.category,
        action_url: values.template_id ? undefined : values.action_url?.trim() || undefined,
        expires_at: values.expires_at?.toISOString(),
      });

      if (result.failed_count > 0) {
        messageApi.warning(
          t('notifications.send.submitWarning', {
            sent: result.sent_count,
            failed: result.failed_count,
          }),
        );
      } else {
        messageApi.success(t('notifications.send.submitSuccess', { sent: result.sent_count }));
      }

      form.resetFields();
      form.setFieldsValue({
        type: 'admin_message',
        category: 'platform',
        template_variables_json: t('notifications.send.defaultTemplateVariables'),
        template_variable_values: undefined,
      });
      onSent?.();
    } catch (error) {
      const messageText = (error as Error).message;
      messageApi.error(
        messageText === 'notifications.send.templateVariablesInvalid'
          ? t('notifications.send.templateVariablesInvalid')
          : messageText,
      );
    } finally {
      setSubmitting(false);
    }
  }

  function renderRecipientTooltip(user: AdminUserListItem) {
    return (
      <div className={styles.recipientTooltip}>
        <div className={styles.recipientTooltipHeader}>
          <Avatar size={40} src={user.avatar_url ?? undefined} className={styles.recipientTooltipAvatar}>
            {user.username.slice(0, 1).toUpperCase()}
          </Avatar>
          <div className={styles.recipientTooltipIdentity}>
            <strong>{user.username}</strong>
            <span>{user.email || t('common.noEmail')}</span>
          </div>
        </div>
        <div className={styles.recipientTooltipMeta}>
          <span>{t('notifications.send.recipientUserNo')}: #{user.user_no}</span>
          <span>{t('notifications.send.recipientRole')}: {user.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}</span>
          <span>{t('users.filterStatus')}: {getUserStatusLabel(user, t)}</span>
          <span>{t('notifications.send.recipientLoginCount')}: {user.login_count}</span>
          <span>
            {t('users.fieldLastLogin')}: {user.last_login_at ? dayjs(user.last_login_at).format('YYYY-MM-DD HH:mm') : t('common.empty')}
          </span>
        </div>
      </div>
    );
  }

  function renderRecipientTag({ label, value, closable, onClose }: RecipientTagRenderProps) {
    const user = recipientMap.get(Number(value));

    return (
      <Tooltip
        title={user ? renderRecipientTooltip(user) : label}
        placement="top"
        overlayClassName={styles.recipientTooltipOverlay}
        color="#ffffff"
      >
        <span
          className={styles.recipientChip}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
        >
          {user ? (
            <>
              <span className={`${styles.recipientChipStatus} ${styles[getUserStatusDotClass(user.status)]}`} />
              <Avatar size={22} src={user.avatar_url ?? undefined} className={styles.recipientChipAvatar}>
                {user.username.slice(0, 1).toUpperCase()}
              </Avatar>
              <span className={styles.recipientChipName}>{user.username}</span>
            </>
          ) : (
            <span className={styles.recipientChipName}>{label}</span>
          )}
          {closable ? (
            <button
              type="button"
              className={styles.recipientChipClose}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onClose(event);
              }}
            >
              <CloseOutlined />
            </button>
          ) : null}
        </span>
      </Tooltip>
    );
  }

  return (
    <>
      {contextHolder}
      <Form<SendFormValues> layout="vertical" form={form} onFinish={(values) => void handleSubmit(values)}>
        <div className={styles.sendFormGrid}>
          <Form.Item name="name" label={t('notifications.send.jobName')}>
            <Input placeholder={t('notifications.send.jobNamePlaceholder')} />
          </Form.Item>

          <Form.Item name="template_id" label={t('notifications.send.template')}>
            <Select
              allowClear
              loading={templateLoading}
              placeholder={t('notifications.send.templatePlaceholder')}
              options={templates.map((item) => ({ label: item.name, value: item.id }))}
            />
          </Form.Item>

          <Form.Item
            name="recipient_ids"
            label={t('notifications.send.recipients')}
            className={styles.fullSpan}
            rules={[{ required: true, message: t('notifications.send.recipientsRequired') }]}
          >
            <Select
              mode="multiple"
              showSearch
              allowClear
              filterOption={false}
              loading={recipientLoading}
              className={styles.recipientSelect}
              popupClassName={styles.recipientSelectDropdown}
              popupMatchSelectWidth={560}
              placeholder={t('notifications.send.recipientsPlaceholder')}
              tagRender={renderRecipientTag}
              maxTagCount="responsive"
              maxTagPlaceholder={(omittedValues) => (
                <span className={styles.recipientOverflowChip}>+{omittedValues.length}</span>
              )}
              listHeight={360}
              onFocus={() => void loadRecipients()}
              onSearch={(keyword) => {
                void loadRecipients(keyword);
              }}
              options={recipientOptions.map((user) => ({
                label: renderUserOption(user, t),
                value: user.id,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="title"
            label={t('notifications.send.title')}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (getFieldValue('template_id')) {
                    return Promise.resolve();
                  }
                  if (String(value || '').trim()) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error(t('notifications.send.titleRequired')));
                },
              }),
            ]}
          >
            <Input disabled={Boolean(selectedTemplate)} placeholder={t('notifications.send.titlePlaceholder')} />
          </Form.Item>

          <Form.Item name="type" label={t('notifications.send.type')}>
            <Select disabled={Boolean(selectedTemplate)} options={notificationTypeOptions} />
          </Form.Item>

          <Form.Item name="category" label={t('notifications.send.category')}>
            <Select disabled={Boolean(selectedTemplate)} allowClear options={notificationCategoryOptions} />
          </Form.Item>

          <Form.Item name="expires_at" label={t('notifications.send.expiresAt')}>
            <DatePicker
              showTime
              style={{ width: '100%' }}
              disabledDate={(current) => Boolean(current && current < dayjs().startOf('day'))}
            />
          </Form.Item>

          <Form.Item name="action_url" label={t('notifications.send.actionUrl')} className={styles.fullSpan}>
            <Input disabled={Boolean(selectedTemplate)} placeholder={t('notifications.send.actionUrlPlaceholder')} />
          </Form.Item>

          <Form.Item name="content" label={t('notifications.send.content')} className={styles.fullSpan}>
            <TextArea rows={5} disabled={Boolean(selectedTemplate)} placeholder={t('notifications.send.contentPlaceholder')} />
          </Form.Item>

          {selectedTemplate ? (
            <Form.Item
              label={t('notifications.send.templateVariables')}
              className={styles.fullSpan}
            >
              <div className={styles.templateVariableSection}>
                {editableTemplateVariables.length > 0 ? (
                  <div className={styles.templateVariableGrid}>
                    {editableTemplateVariables.map((variableKey) => (
                      (() => {
                        const variableMeta = getTemplateVariableMeta(variableKey, t);
                        const inputType = getTemplateVariableInputType(variableKey);

                        return (
                          <Form.Item
                            key={variableKey}
                            name={['template_variable_values', variableKey]}
                            label={renderTemplateVariableLabel(variableMeta.label, variableKey)}
                            extra={
                              <span className={styles.templateVariableFieldDesc}>{variableMeta.description}</span>
                            }
                            rules={[
                              {
                                required: true,
                                message: t('notifications.send.templateVariableRequired', {
                                  name: variableMeta.label,
                                }),
                              },
                            ]}
                          >
                            {inputType === 'textarea' ? (
                              <TextArea
                                rows={3}
                                placeholder={t('notifications.send.templateVariablePlaceholder', {
                                  name: variableMeta.label,
                                })}
                              />
                            ) : inputType === 'datetime' ? (
                              <DatePicker
                                showTime
                                format="YYYY-MM-DD HH:mm:ss"
                                style={{ width: '100%' }}
                                placeholder={t('notifications.send.templateVariablePlaceholder', {
                                  name: variableMeta.label,
                                })}
                              />
                            ) : (
                              <Input
                                placeholder={t('notifications.send.templateVariablePlaceholder', {
                                  name: variableMeta.label,
                                })}
                              />
                            )}
                          </Form.Item>
                        );
                      })()
                    ))}
                  </div>
                ) : (
                  <div className={styles.templateVariableHint}>
                    {t('notifications.send.noCustomTemplateVariables')}
                  </div>
                )}

                {systemTemplateVariables.length > 0 ? (
                  <div className={styles.templateVariableReadonly}>
                    <div className={styles.templateVariableReadonlyTitle}>
                      {t('notifications.send.systemTemplateVariables')}
                    </div>
                    <div className={styles.templateVariableTokenList}>
                      {systemTemplateVariables.map((variableKey) => (
                        <div key={variableKey} className={styles.templateVariableReadonlyItem}>
                          <span className={styles.templateVariableToken}>{`{{${variableKey}}}`}</span>
                          <span className={styles.templateVariableFieldDesc}>
                            {getTemplateVariableMeta(variableKey, t).description}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className={styles.templateVariableHint}>
                      {t('notifications.send.systemTemplateVariablesHint')}
                    </div>
                  </div>
                ) : null}
              </div>
            </Form.Item>
          ) : null}
        </div>

        {selectedTemplate ? (
          <Card size="small" className={styles.templatePreview}>
            <div className={styles.templatePreviewTitle}>{selectedTemplate.name}</div>
            <div className={styles.templatePreviewText}>
              {t('notifications.send.previewTitle')}: {selectedTemplate.title_template}
            </div>
            <div className={styles.templatePreviewText}>
              {t('notifications.send.previewContent')}: {selectedTemplate.content_template || t('common.none')}
            </div>
            <div className={styles.templatePreviewText}>
              {t('notifications.send.previewActionUrl')}: {selectedTemplate.action_url_template || t('common.none')}
            </div>
          </Card>
        ) : null}

        <Space>
          <Button type="primary" htmlType="submit" icon={<SendOutlined />} loading={submitting}>
            {t('notifications.send.submit')}
          </Button>
          <Button
            onClick={() =>
              form.setFieldsValue({
                type: 'admin_message',
                category: 'platform',
                template_variables_json: t('notifications.send.defaultTemplateVariables'),
                template_variable_values: undefined,
              })
            }
          >
            {t('notifications.send.reset')}
          </Button>
        </Space>
      </Form>
    </>
  );
}

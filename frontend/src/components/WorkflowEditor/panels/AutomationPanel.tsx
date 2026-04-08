import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Radio,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from 'antd';
import {
  ClockCircleOutlined,
  CloseOutlined,
  CopyOutlined,
  EditOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { taskScheduleApi } from '@/api/taskSchedule';
import type { TaskSchedule, TaskScheduleRun } from '@/types/taskSchedule';
import styles from './AutomationPanel.module.scss';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface AutomationPanelProps {
  visible: boolean;
  workflowId: number;
  onClose: () => void;
}

interface AutomationFormValues {
  name: string;
  description?: string;
  triggerType: 'cron' | 'webhook';
  cronExpression?: string;
  timezone: string;
  isActive: boolean;
  inputTemplateText?: string;
  ipWhitelistText?: string;
  retryMode: 'none' | 'fixed' | 'exponential';
  maxRetries: number;
  delaySeconds: number;
  maxDelaySeconds: number;
  maxRuns?: number | null;
}

const defaultFormValues: AutomationFormValues = {
  name: '',
  description: '',
  triggerType: 'cron',
  cronExpression: '0 8 * * *',
  timezone: 'Asia/Shanghai',
  isActive: true,
  inputTemplateText: '',
  ipWhitelistText: '',
  retryMode: 'none',
  maxRetries: 0,
  delaySeconds: 15,
  maxDelaySeconds: 300,
  maxRuns: null,
};

const timezoneOptions = [
  { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
  { label: 'UTC', value: 'UTC' },
  { label: 'Asia/Tokyo', value: 'Asia/Tokyo' },
  { label: 'America/Los_Angeles', value: 'America/Los_Angeles' },
];

const AutomationPanel: React.FC<AutomationPanelProps> = ({ visible, workflowId, onClose }) => {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm<AutomationFormValues>();
  const [loading, setLoading] = useState(false);
  const [runsLoading, setRunsLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [schedules, setSchedules] = useState<TaskSchedule[]>([]);
  const [runs, setRuns] = useState<TaskScheduleRun[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<number | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<TaskSchedule | null>(null);
  const [latestWebhookSecret, setLatestWebhookSecret] = useState<string | null>(null);
  const watchedTriggerType = Form.useWatch('triggerType', form) ?? defaultFormValues.triggerType;
  const watchedRetryMode = Form.useWatch('retryMode', form) ?? defaultFormValues.retryMode;

  const a = (key: string, defaultValue: string, options?: Record<string, any>) =>
    t(`workflowEditor.automation.${key}`, { defaultValue, ...options });
  const c = (key: string, defaultValue: string, options?: Record<string, any>) =>
    t(`common.${key}`, { defaultValue, ...options });

  const locale = i18n.resolvedLanguage === 'zh-CN' ? 'zh-CN' : 'en-US';

  const retryModeOptions = useMemo(
    () => [
      { label: a('retryNone', 'No retry'), value: 'none' },
      { label: a('retryFixed', 'Fixed retry'), value: 'fixed' },
      { label: a('retryExponential', 'Exponential backoff'), value: 'exponential' },
    ],
    [i18n.resolvedLanguage],
  );

  const statusTextMap = useMemo(
    () => ({
      completed: a('statusCompleted', 'Completed'),
      failed: a('statusFailed', 'Failed'),
      cancelled: a('statusCancelled', 'Cancelled'),
      running: a('statusRunning', 'Running'),
      queued: a('statusQueued', 'Queued'),
      idle: a('statusIdle', 'Not run yet'),
    }),
    [i18n.resolvedLanguage],
  );

  const statusClassMap: Record<string, string> = {
    completed: styles.statusSuccess,
    failed: styles.statusDanger,
    cancelled: styles.statusMuted,
    running: styles.statusInfo,
    queued: styles.statusInfo,
    idle: styles.statusMuted,
  };

  const selectedSchedule = useMemo(
    () => schedules.find((item) => item.id === selectedScheduleId) || null,
    [schedules, selectedScheduleId],
  );

  const overview = useMemo(() => {
    const active = schedules.filter((item) => item.isActive).length;
    const cron = schedules.filter((item) => item.triggerType === 'cron').length;
    return { total: schedules.length, active, cron, webhook: schedules.length - cron };
  }, [schedules]);

  const formatDateTime = (value?: string) =>
    value ? new Date(value).toLocaleString(locale) : a('notScheduled', 'Not scheduled');

  const formatTriggerText = (schedule: TaskSchedule) =>
    schedule.triggerType === 'cron'
      ? `${schedule.cronExpression || a('cronUnset', 'Cron not set')} · ${schedule.timezone}`
      : a('triggerWebhookSummary', 'Triggered by external systems through webhook');

  const formatRetryText = (schedule: TaskSchedule) => {
    const policy = schedule.retryPolicy;
    if (!policy || policy.mode === 'none') return a('retryClosed', 'Off');
    const mode =
      policy.mode === 'fixed'
        ? a('retryFixedSummary', 'Fixed interval')
        : a('retryExponentialSummary', 'Exponential backoff');
    return a('retrySummary', '{{mode}} · up to {{count}} times', {
      mode,
      count: policy.maxRetries,
    });
  };

  const getStatusMeta = (status?: string) => ({
    label: status ? statusTextMap[status as keyof typeof statusTextMap] || status : statusTextMap.idle,
    className: status ? statusClassMap[status] || statusClassMap.idle : statusClassMap.idle,
  });

  const getRunDurationText = (run: TaskScheduleRun) => {
    if (!run.finishedAt) return a('running', 'Running');
    const duration = new Date(run.finishedAt).getTime() - new Date(run.triggeredAt).getTime();
    if (duration < 1000) return a('durationLtSecond', '< 1 sec');
    if (duration < 60000) return a('durationSeconds', '{{count}} sec', { count: Math.round(duration / 1000) });
    return a('durationMinutes', '{{count}} min', { count: Math.round(duration / 60000) });
  };

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const response = await taskScheduleApi.list({ workflowId, page: 1, pageSize: 20 });
      const nextList = response.list || [];
      setSchedules(nextList);
      if (nextList.length === 0) {
        setSelectedScheduleId(null);
        setRuns([]);
        return;
      }
      setSelectedScheduleId((current) =>
        current && nextList.some((item) => item.id === current) ? current : nextList[0].id,
      );
    } catch (error: any) {
      message.error(error.message || a('loadSchedulesFailed', 'Failed to load automation plans'));
    } finally {
      setLoading(false);
    }
  };

  const fetchRuns = async (scheduleId: number) => {
    try {
      setRunsLoading(true);
      const response = await taskScheduleApi.listRuns(scheduleId, { page: 1, pageSize: 10 });
      setRuns(response.list || []);
    } catch (error: any) {
      message.error(error.message || a('loadRunsFailed', 'Failed to load run history'));
    } finally {
      setRunsLoading(false);
    }
  };

  useEffect(() => {
    if (visible && workflowId) void fetchSchedules();
  }, [visible, workflowId]);

  useEffect(() => {
    if (visible && selectedScheduleId) void fetchRuns(selectedScheduleId);
  }, [visible, selectedScheduleId]);

  const openCreateModal = () => {
    setEditingSchedule(null);
    setLatestWebhookSecret(null);
    form.setFieldsValue(defaultFormValues);
    setModalOpen(true);
  };

  const openEditModal = (schedule: TaskSchedule) => {
    setEditingSchedule(schedule);
    setLatestWebhookSecret(null);
    form.setFieldsValue({
      name: schedule.name,
      description: schedule.description || '',
      triggerType: schedule.triggerType,
      cronExpression: schedule.cronExpression || defaultFormValues.cronExpression,
      timezone: schedule.timezone || defaultFormValues.timezone,
      isActive: schedule.isActive,
      inputTemplateText: schedule.inputTemplate ? JSON.stringify(schedule.inputTemplate, null, 2) : '',
      ipWhitelistText: Array.isArray(schedule.config?.ipWhitelist)
        ? schedule.config.ipWhitelist.join('\n')
        : '',
      retryMode: schedule.retryPolicy?.mode || 'none',
      maxRetries: schedule.retryPolicy?.maxRetries ?? 0,
      delaySeconds: schedule.retryPolicy?.delaySeconds ?? 15,
      maxDelaySeconds: schedule.retryPolicy?.maxDelaySeconds ?? 300,
      maxRuns: schedule.maxRuns ?? null,
    });
    setModalOpen(true);
  };

  const parseInputTemplate = (text?: string) => {
    const trimmed = (text || '').trim();
    return trimmed ? JSON.parse(trimmed) : undefined;
  };

  const buildPayload = (values: AutomationFormValues) => {
    const ipWhitelist = (values.ipWhitelistText || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    return {
      workflowId,
      name: values.name.trim(),
      description: values.description?.trim() || undefined,
      triggerType: values.triggerType,
      cronExpression: values.triggerType === 'cron' ? values.cronExpression?.trim() || '' : '',
      timezone: values.timezone.trim() || 'UTC',
      isActive: values.isActive,
      maxRuns: values.maxRuns || undefined,
      config: ipWhitelist.length > 0 ? { ipWhitelist } : undefined,
      retryPolicy: {
        mode: values.retryMode,
        maxRetries: values.maxRetries || 0,
        delaySeconds: values.delaySeconds || 15,
        maxDelaySeconds: values.maxDelaySeconds || 300,
      },
      inputTemplate: parseInputTemplate(values.inputTemplateText),
    };
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const payload = buildPayload(values);
      const response = editingSchedule
        ? await taskScheduleApi.update(editingSchedule.id, payload)
        : await taskScheduleApi.create(payload);
      setLatestWebhookSecret(response.webhookSecret || null);
      setModalOpen(false);
      await fetchSchedules();
      setSelectedScheduleId(response.schedule.id);
      await fetchRuns(response.schedule.id);
      message.success(
        editingSchedule
          ? a('updatedSuccess', 'Automation plan updated')
          : a('createdSuccess', 'Automation plan created'),
      );
    } catch (error: any) {
      if (error?.errorFields) return;
      message.error(error.message || a('saveFailed', 'Failed to save automation plan'));
    }
  };

  const handleCancelSchedule = async (scheduleId: number) => {
    try {
      await taskScheduleApi.cancel(scheduleId);
      await fetchSchedules();
      if (selectedScheduleId === scheduleId) setRuns([]);
      message.success(a('disabledSuccess', 'Plan disabled'));
    } catch (error: any) {
      message.error(error.message || a('disableFailed', 'Failed to disable plan'));
    }
  };

  const handleTriggerNow = async (scheduleId: number) => {
    try {
      await taskScheduleApi.triggerNow(scheduleId, {});
      await fetchRuns(scheduleId);
      message.success(a('triggeredSuccess', 'Run submitted'));
    } catch (error: any) {
      message.error(error.message || a('triggerFailed', 'Failed to trigger run'));
    }
  };

  const copyText = async (value?: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      message.success(a('copySuccess', 'Copied'));
    } catch {
      message.error(a('copyFailed', 'Copy failed'));
    }
  };

  if (!visible) return null;

  return (
    <div className={styles.panelContainer}>
      <div className={styles.panelHeader}>
        <div className={styles.headerCopy}>
          <div className={styles.headerEyebrow}>{a('eyebrow', 'Automation')}</div>
          <div className={styles.headerTitleRow}>
            <ClockCircleOutlined className={styles.headerIcon} />
            <Text strong className={styles.headerTitle}>{a('title', 'Automation')}</Text>
          </div>
          <Text className={styles.headerDescription}>
            {a('description', 'Run this workflow on a schedule or wait for external systems to trigger it.')}
          </Text>
        </div>
        <Space size={8} className={styles.headerActions}>
          <Button icon={<ReloadOutlined />} onClick={() => void fetchSchedules()}>{a('refresh', 'Refresh')}</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>{a('create', 'New plan')}</Button>
          <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
        </Space>
      </div>

      <div className={styles.panelContent}>
        <Spin spinning={loading}>
          {schedules.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyCard}>
                <div className={styles.emptyEyebrow}>{a('emptyEyebrow', 'Automation is not enabled yet')}</div>
                <div className={styles.emptyTitle}>{a('emptyTitle', 'Give this workflow an always-on entry point')}</div>
                <Paragraph className={styles.emptyDescription}>
                  {a('emptyDescription', 'Create a cron plan or a dedicated webhook endpoint so this workflow can run without manual clicks.')}
                </Paragraph>
                <Button type="primary" size="large" icon={<PlusOutlined />} onClick={openCreateModal}>
                  {a('createFirst', 'Create first plan')}
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.layout}>
              <aside className={styles.sidebar}>
                <div className={styles.overviewCard}>
                  <div className={styles.overviewEyebrow}>{a('overviewEyebrow', 'Workflow overview')}</div>
                  <div className={styles.overviewTitle}>{a('overviewTitle', '{{count}} automation plans', { count: overview.total })}</div>
                  <div className={styles.metricRow}>
                    <div className={styles.metricChip}><span className={styles.metricValue}>{overview.active}</span><span className={styles.metricLabel}>{a('activeCount', 'Active')}</span></div>
                    <div className={styles.metricChip}><span className={styles.metricValue}>{overview.cron}</span><span className={styles.metricLabel}>Cron</span></div>
                    <div className={styles.metricChip}><span className={styles.metricValue}>{overview.webhook}</span><span className={styles.metricLabel}>Webhook</span></div>
                  </div>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>{a('addPlan', 'Add plan')}</Button>
                </div>

                <div className={styles.listHeader}>
                  <Text className={styles.listTitle}>{a('existingPlans', 'Existing plans')}</Text>
                  <Text className={styles.listSubtitle}>{a('existingPlansHint', 'Select a plan to inspect its behavior and recent runs.')}</Text>
                </div>

                <div className={styles.scheduleList}>
                  {schedules.map((schedule) => {
                    const runStatus = getStatusMeta(schedule.lastRunStatus);
                    return (
                      <button
                        key={schedule.id}
                        type="button"
                        className={`${styles.scheduleCard} ${selectedScheduleId === schedule.id ? styles.scheduleCardActive : ''}`}
                        onClick={() => setSelectedScheduleId(schedule.id)}
                      >
                        <div className={styles.scheduleCardTop}>
                          <div className={styles.scheduleName}>{schedule.name}</div>
                          <span className={`${styles.statusBadge} ${schedule.isActive ? styles.statusSuccess : styles.statusMuted}`}>
                            {schedule.isActive ? a('enabledStatus', 'Active') : a('disabledStatus', 'Disabled')}
                          </span>
                        </div>
                        <div className={styles.scheduleMeta}>{formatTriggerText(schedule)}</div>
                        <div className={styles.scheduleFoot}>
                          <span className={styles.scheduleHint}>
                            {schedule.triggerType === 'cron'
                              ? a('nextRunLabel', 'Next run {{time}}', { time: formatDateTime(schedule.nextRunAt) })
                              : a('waitingTrigger', 'Waiting for external trigger')}
                          </span>
                          <span className={`${styles.statusBadge} ${runStatus.className}`}>{runStatus.label}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </aside>

              <section className={styles.detailPane}>
                {selectedSchedule ? (
                  <>
                    <div className={styles.detailHero}>
                      <div className={styles.heroTop}>
                        <div className={styles.heroCopy}>
                          <div className={styles.heroEyebrow}>{selectedSchedule.triggerType === 'cron' ? a('timeDriven', 'Time-driven') : a('eventDriven', 'Event-driven')}</div>
                          <div className={styles.heroTitleRow}>
                            <Text strong className={styles.heroTitle}>{selectedSchedule.name}</Text>
                            <span className={`${styles.statusBadge} ${selectedSchedule.isActive ? styles.statusSuccess : styles.statusMuted}`}>
                              {selectedSchedule.isActive ? a('enabledStatus', 'Active') : a('disabledStatus', 'Disabled')}
                            </span>
                          </div>
                          <Paragraph className={styles.heroDescription}>
                            {selectedSchedule.description || a('noDescription', 'Add a short description so others can understand what this plan is responsible for.')}
                          </Paragraph>
                        </div>
                        <div className={styles.heroActions}>
                          <Button icon={<PlayCircleOutlined />} onClick={() => void handleTriggerNow(selectedSchedule.id)}>{a('runNow', 'Run now')}</Button>
                          <Button icon={<EditOutlined />} onClick={() => openEditModal(selectedSchedule)}>{c('edit', 'Edit')}</Button>
                          <Popconfirm
                            title={a('disableConfirmTitle', 'Disable this plan?')}
                            description={a('disableConfirmDescription', 'It will stop triggering automatically, while keeping its history intact.')}
                            onConfirm={() => void handleCancelSchedule(selectedSchedule.id)}
                          >
                            <Button icon={<StopOutlined />} danger>{a('disable', 'Disable')}</Button>
                          </Popconfirm>
                        </div>
                      </div>

                      <div className={styles.heroMetrics}>
                        <div className={styles.heroMetricCard}>
                          <div className={styles.heroMetricLabel}>{a('triggerType', 'Trigger type')}</div>
                          <div className={styles.heroMetricValue}>{selectedSchedule.triggerType === 'cron' ? 'Cron' : 'Webhook'}</div>
                          <div className={styles.heroMetricHint}>{formatTriggerText(selectedSchedule)}</div>
                        </div>
                        <div className={styles.heroMetricCard}>
                          <div className={styles.heroMetricLabel}>{a('nextExecution', 'Next execution')}</div>
                          <div className={styles.heroMetricValue}>{selectedSchedule.triggerType === 'cron' ? formatDateTime(selectedSchedule.nextRunAt) : a('waiting', 'Waiting')}</div>
                          <div className={styles.heroMetricHint}>{a('lastExecution', 'Last run {{time}}', { time: formatDateTime(selectedSchedule.lastRunAt) })}</div>
                        </div>
                        <div className={styles.heroMetricCard}>
                          <div className={styles.heroMetricLabel}>{a('runSummary', 'Run summary')}</div>
                          <div className={styles.heroMetricValue}>{a('runCountValue', '{{count}} runs', { count: selectedSchedule.runCount })}</div>
                          <div className={styles.heroMetricHint}>{a('recentStatus', 'Recent status {{status}}', { status: getStatusMeta(selectedSchedule.lastRunStatus).label })}</div>
                        </div>
                      </div>
                    </div>

                    <div className={styles.detailStack}>
                      {selectedSchedule.triggerType === 'webhook' ? (
                        <div className={styles.infoCard}>
                          <div className={styles.sectionHeader}>
                            <div>
                              <div className={styles.sectionEyebrow}>{a('securityEyebrow', 'Secure entry')}</div>
                              <div className={styles.sectionTitle}>{a('webhookCredentials', 'Webhook URL and secret')}</div>
                            </div>
                            <Text className={styles.sectionHint}>{a('webhookHint', 'External systems can trigger this workflow by sending a request here.')}</Text>
                          </div>
                          <div className={styles.webhookGrid}>
                            <div className={styles.webhookCard}>
                              <div className={styles.fieldLabel}>{a('webhookUrl', 'Webhook URL')}</div>
                              <div className={styles.codeBlock}>{selectedSchedule.webhookUrl || '-'}</div>
                              <Button icon={<CopyOutlined />} onClick={() => void copyText(selectedSchedule.webhookUrl)}>{a('copyUrl', 'Copy URL')}</Button>
                            </div>
                            <div className={styles.webhookCard}>
                              <div className={styles.fieldLabel}>{a('latestSecret', 'Latest secret')}</div>
                              <div className={styles.codeBlock}>{latestWebhookSecret || a('secretPlaceholder', 'It will be shown once after creation or regeneration.')}</div>
                              <Button icon={<CopyOutlined />} onClick={() => void copyText(latestWebhookSecret || undefined)} disabled={!latestWebhookSecret}>{a('copySecret', 'Copy secret')}</Button>
                            </div>
                          </div>
                          <Alert type="info" showIcon className={styles.inlineAlert} message={a('webhookSecurityTip', 'Store the secret safely and combine it with Request ID and IP allowlist for better protection.')} />
                        </div>
                      ) : null}

                      <div className={styles.configGrid}>
                        <div className={styles.configCard}>
                          <div className={styles.fieldLabel}>{a('timezone', 'Timezone')}</div>
                          <div className={styles.configValue}>{selectedSchedule.timezone}</div>
                          <div className={styles.configHint}>{a('timezoneHint', 'Cron parsing and next-run calculation follow this timezone.')}</div>
                        </div>
                        <div className={styles.configCard}>
                          <div className={styles.fieldLabel}>{a('retryPolicy', 'Retry policy')}</div>
                          <div className={styles.configValue}>{formatRetryText(selectedSchedule)}</div>
                          <div className={styles.configHint}>{a('retryDelayHint', 'Base delay {{delay}} sec, max delay {{max}} sec', { delay: selectedSchedule.retryPolicy?.delaySeconds ?? 15, max: selectedSchedule.retryPolicy?.maxDelaySeconds ?? 300 })}</div>
                        </div>
                        <div className={styles.configCard}>
                          <div className={styles.fieldLabel}>{a('runLimit', 'Run limit')}</div>
                          <div className={styles.configValue}>{selectedSchedule.maxRuns ? a('runLimitValue', '{{count}} times', { count: selectedSchedule.maxRuns }) : a('unlimited', 'Unlimited')}</div>
                          <div className={styles.configHint}>{a('runLimitHint', 'Already executed {{count}} times', { count: selectedSchedule.runCount })}</div>
                        </div>
                      </div>

                      <div className={styles.infoCard}>
                        <div className={styles.sectionHeader}>
                          <div>
                            <div className={styles.sectionEyebrow}>{a('recentRunsEyebrow', 'Recent activity')}</div>
                            <div className={styles.sectionTitle}>{a('recentRunsTitle', 'Last 10 runs')}</div>
                          </div>
                          <Text className={styles.sectionHint}>{a('recentRunsHint', 'Use this list to quickly judge whether the plan is healthy.')}</Text>
                        </div>
                        <Spin spinning={runsLoading}>
                          {runs.length === 0 ? (
                            <div className={styles.inlineEmpty}>
                              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={a('noRuns', 'No run records yet')} />
                            </div>
                          ) : (
                            <div className={styles.runList}>
                              {runs.map((run) => {
                                const statusMeta = getStatusMeta(run.status);
                                return (
                                  <div key={run.id} className={styles.runCard}>
                                    <div className={styles.runCardTop}>
                                      <div className={styles.runTopLeft}>
                                        <span className={`${styles.statusBadge} ${statusMeta.className}`}>{statusMeta.label}</span>
                                        <span className={styles.runTime}>{formatDateTime(run.triggeredAt)}</span>
                                      </div>
                                      <span className={styles.runDuration}>{getRunDurationText(run)}</span>
                                    </div>
                                    <div className={styles.runMetaGrid}>
                                      <div><div className={styles.fieldLabel}>{a('task', 'Task')}</div><div className={styles.runMetaValue}>{run.taskId ? `#${run.taskId}` : a('taskCreating', 'Creating')}</div></div>
                                      <div><div className={styles.fieldLabel}>{a('requestId', 'Request ID')}</div><div className={styles.runMetaValue}>{run.requestId || a('requestIdMissing', 'Not provided')}</div></div>
                                      <div><div className={styles.fieldLabel}>{a('attemptCount', 'Attempts')}</div><div className={styles.runMetaValue}>{run.attemptCount}</div></div>
                                    </div>
                                    {run.errorMessage ? <div className={styles.runError}>{run.errorMessage}</div> : null}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </Spin>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.inlineEmpty}>
                    <Empty description={a('selectPlan', 'Select a plan from the left to inspect details')} />
                  </div>
                )}
              </section>
            </div>
          )}
        </Spin>
      </div>

      <Modal
        open={modalOpen}
        title={editingSchedule ? a('modalEditTitle', 'Edit automation plan') : a('modalCreateTitle', 'New automation plan')}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        width={1080}
        rootClassName={styles.automationModal}
        okText={editingSchedule ? a('modalEditOk', 'Save changes') : a('modalCreateOk', 'Create plan')}
        cancelText={c('cancel', 'Cancel')}
      >
        <Form layout="vertical" form={form} initialValues={defaultFormValues}>
          <div className={styles.modalBody}>
            <div className={styles.formHero}>
              <div>
                <div className={styles.formHeroEyebrow}>{a('composerEyebrow', 'Automation composer')}</div>
                <div className={styles.formHeroTitle}>{watchedTriggerType === 'cron' ? a('composerTitleCron', 'Design a time-based plan') : a('composerTitleWebhook', 'Design an event-driven entry')}</div>
                <Paragraph className={styles.formHeroDescription}>
                  {watchedTriggerType === 'cron'
                    ? a('composerDescCron', 'Great for reports, inspections, and periodic crawling jobs.')
                    : a('composerDescWebhook', 'Great for publish events, third-party callbacks, and approval completions.')}
                </Paragraph>
              </div>
              <div className={styles.formHeroPills}>
                <span className={styles.formHeroPill}>{a('workflowTag', 'Workflow #{{id}}', { id: workflowId })}</span>
                <span className={styles.formHeroPill}>{editingSchedule ? a('editExisting', 'Editing existing plan') : a('createNew', 'Creating new plan')}</span>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}>
                <div className={styles.formSectionTitle}>{a('basicInfo', 'Basic information')}</div>
                <div className={styles.formSectionHint}>{a('basicInfoHint', 'Define the name, summary, and trigger mode first.')}</div>
              </div>
              <div className={styles.formGridTwo}>
                <Form.Item name="name" label={a('name', 'Name')} rules={[{ required: true, message: a('nameRequired', 'Please enter a plan name') }]}>
                  <Input placeholder={a('namePlaceholder', 'Daily digest at 8 AM')} />
                </Form.Item>
                <Form.Item name="triggerType" label={a('triggerMode', 'Trigger mode')}>
                  <Radio.Group optionType="button" buttonStyle="solid" className={styles.modeGroup}>
                    <Radio.Button value="cron">Cron</Radio.Button>
                    <Radio.Button value="webhook">Webhook</Radio.Button>
                  </Radio.Group>
                </Form.Item>
                <Form.Item name="description" label={a('descriptionField', 'Description')} className={styles.fieldSpanFull}>
                  <TextArea rows={2} placeholder={a('descriptionPlaceholder', 'Explain briefly what this plan is responsible for.')}/>
                </Form.Item>
              </div>
              {watchedTriggerType === 'cron' ? (
                <div className={styles.formGridTwo}>
                  <Form.Item name="cronExpression" label={a('cronExpression', 'Cron expression')} rules={[{ required: true, message: a('cronRequired', 'Please enter a cron expression') }]} className={styles.fieldSpanFull}>
                    <Input placeholder="0 8 * * *" />
                  </Form.Item>
                  <div className={`${styles.fieldHint} ${styles.fieldSpanFull}`}>{a('cronHint', 'Example: 0 8 * * * means the task runs every day at 8:00 AM.')}</div>
                </div>
              ) : (
                <Alert type="info" showIcon className={styles.inlineAlert} message={a('webhookGeneratedHint', 'Webhook mode generates a unique URL and secret after saving. The secret is shown only once when created or reset.')} />
              )}
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}>
                <div className={styles.formSectionTitle}>{a('runControl', 'Run control')}</div>
                <div className={styles.formSectionHint}>{a('runControlHint', 'Choose timezone, enabled state, and execution cap.')}</div>
              </div>
              <div className={styles.formGridCompact}>
                <Form.Item name="timezone" label={a('timezone', 'Timezone')}><Select options={timezoneOptions} showSearch /></Form.Item>
                <Form.Item name="maxRuns" label={a('maxRuns', 'Maximum runs')}><InputNumber min={1} style={{ width: '100%' }} placeholder={a('unlimited', 'Unlimited')} /></Form.Item>
                <Form.Item name="isActive" label={a('enabled', 'Enabled')} valuePropName="checked"><Switch /></Form.Item>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}>
                <div className={styles.formSectionTitle}>{a('inputAndSecurity', 'Input and security')}</div>
                <div className={styles.formSectionHint}>{a('inputAndSecurityHint', 'Prepare default input for the start node and optionally restrict who can call it.')}</div>
              </div>
              <div className={styles.formGridTwo}>
                <Form.Item name="inputTemplateText" label={a('inputTemplate', 'Input template JSON')}><TextArea rows={4} className={styles.jsonEditor} placeholder='{"source":"schedule"}' /></Form.Item>
                <Form.Item name="ipWhitelistText" label={a('ipWhitelist', 'IP allowlist')}><TextArea rows={4} placeholder={a('ipWhitelistPlaceholder', 'One IP or CIDR per line, for example:\n127.0.0.1\n10.0.0.0/24')} /></Form.Item>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.formSectionHeader}>
                <div className={styles.formSectionTitle}>{a('retrySection', 'Failure retries')}</div>
                <div className={styles.formSectionHint}>{a('retryModeHint', 'Current strategy: {{mode}}', { mode: retryModeOptions.find((item) => item.value === watchedRetryMode)?.label || retryModeOptions[0].label })}</div>
              </div>
              <div className={styles.formGridRetry}>
                <Form.Item name="retryMode" label={a('retryPolicy', 'Retry policy')}><Select options={retryModeOptions} /></Form.Item>
                <Form.Item name="maxRetries" label={a('maxRetries', 'Max retries')}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="delaySeconds" label={a('delaySeconds', 'Base delay (sec)')}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="maxDelaySeconds" label={a('maxDelaySeconds', 'Max delay (sec)')}><InputNumber min={1} style={{ width: '100%' }} /></Form.Item>
              </div>
            </div>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default AutomationPanel;

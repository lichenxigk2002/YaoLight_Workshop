import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Empty,
  Input,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { taskScheduleApi } from '@/api/taskSchedule';
import type { Project } from '@/types/project';
import type { TaskSchedule } from '@/types/taskSchedule';
import styles from './index.module.scss';

const { Paragraph, Text } = Typography;

type ProjectAutomationContentProps = {
  embedded?: boolean;
  projectId?: number;
  project?: Project | null;
};

type StatusFilter = 'all' | 'active' | 'disabled';

function getStatusTone(status?: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'running':
    case 'queued':
      return 'processing';
    case 'cancelled':
      return 'default';
    default:
      return 'default';
  }
}

export function ProjectAutomationContent({
  embedded = false,
  projectId: providedProjectId,
}: ProjectAutomationContentProps) {
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const projectIdNumber = providedProjectId ?? (projectId ? Number(projectId) : 0);
  const locale = i18n.language === 'en-US' ? 'en-US' : 'zh-CN';
  const isZh = locale === 'zh-CN';

  const [loading, setLoading] = useState(false);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<TaskSchedule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [keyword, setKeyword] = useState('');
  const [triggerType, setTriggerType] = useState<string | undefined>();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const pa = (key: string, defaultValue: string, options?: Record<string, unknown>) =>
    t(`projectAutomation.${key}`, { defaultValue, ...options });

  const formatDateTime = (value?: string) => {
    if (!value) return pa('notScheduled', isZh ? '未安排' : 'Not scheduled');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(locale, {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const loadSchedules = useCallback(async (
    nextPage = page,
    nextPageSize = pageSize,
    nextTriggerType = triggerType,
  ) => {
    if (!projectIdNumber) return;
    try {
      setLoading(true);
      const response = await taskScheduleApi.list({
        projectId: projectIdNumber,
        triggerType: nextTriggerType,
        page: nextPage,
        pageSize: nextPageSize,
      });
      setSchedules(response.list || []);
      setTotal(response.total || 0);
      setPage(response.page || nextPage);
      setPageSize(response.pageSize || nextPageSize);
    } catch (error: any) {
      message.error(
        error.message ||
          t('projectAutomation.loadFailed', {
            defaultValue: isZh ? '加载项目自动化失败' : 'Failed to load project automation',
          }),
      );
    } finally {
      setLoading(false);
    }
  }, [message, page, pageSize, projectIdNumber, triggerType, t, isZh]);

  useEffect(() => {
    void loadSchedules(1, pageSize, triggerType);
  }, [loadSchedules, pageSize, triggerType]);

  const filteredSchedules = useMemo(() => {
    const loweredKeyword = keyword.trim().toLowerCase();
    return schedules.filter((schedule) => {
      const matchesKeyword =
        !loweredKeyword ||
        schedule.name.toLowerCase().includes(loweredKeyword) ||
        (schedule.description || '').toLowerCase().includes(loweredKeyword) ||
        (schedule.workflowName || '').toLowerCase().includes(loweredKeyword);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && schedule.isActive) ||
        (statusFilter === 'disabled' && !schedule.isActive);
      return matchesKeyword && matchesStatus;
    });
  }, [keyword, schedules, statusFilter]);

  const metrics = useMemo(() => {
    const activeCount = schedules.filter((item) => item.isActive).length;
    const cronCount = schedules.filter((item) => item.triggerType === 'cron').length;
    const webhookCount = schedules.length - cronCount;
    return { activeCount, cronCount, webhookCount };
  }, [schedules]);

  const openWorkflowAutomation = (schedule: TaskSchedule) => {
    navigate(`/projects/${projectIdNumber}/workflows/${schedule.workflowId}/edit?panel=automation`);
  };

  const handleTriggerNow = async (scheduleId: number) => {
    try {
      setSubmittingId(scheduleId);
      await taskScheduleApi.triggerNow(scheduleId, {});
      message.success(pa('runNowSuccess', isZh ? '已提交立即执行' : 'Run submitted'));
      await loadSchedules();
    } catch (error: any) {
      message.error(error.message || pa('runNowFailed', isZh ? '触发执行失败' : 'Failed to trigger run'));
    } finally {
      setSubmittingId(null);
    }
  };

  const handleDisable = async (scheduleId: number) => {
    try {
      setSubmittingId(scheduleId);
      await taskScheduleApi.cancel(scheduleId);
      message.success(pa('disableSuccess', isZh ? '任务已停用' : 'Automation disabled'));
      await loadSchedules();
    } catch (error: any) {
      message.error(error.message || pa('disableFailed', isZh ? '停用失败' : 'Failed to disable automation'));
    } finally {
      setSubmittingId(null);
    }
  };

  const renderCard = (schedule: TaskSchedule) => {
    const lastStatus = schedule.lastRunStatus || 'idle';
    const workflowName = schedule.workflowName || pa('workflowFallback', isZh ? `工作流 #${schedule.workflowId}` : `Workflow #${schedule.workflowId}`);
    return (
      <article key={schedule.id} className={styles.card}>
        <div className={styles.cardTop}>
          <div className={styles.cardHeading}>
            <Text className={styles.workflowName}>{workflowName}</Text>
            <div className={styles.scheduleName}>{schedule.name}</div>
          </div>
          <Space size={8} wrap>
            <Tag color={schedule.triggerType === 'cron' ? 'gold' : 'blue'}>
              {schedule.triggerType === 'cron'
                ? pa('scheduledTrigger', isZh ? '定时计划' : 'Scheduled')
                : 'Webhook'}
            </Tag>
            <Tag color={schedule.isActive ? 'green' : 'default'}>
              {schedule.isActive
                ? pa('active', isZh ? '启用中' : 'Active')
                : pa('disabled', isZh ? '已停用' : 'Disabled')}
            </Tag>
          </Space>
        </div>

        <Paragraph className={styles.description} ellipsis={{ rows: 2 }}>
          {schedule.description || pa('descriptionFallback', isZh ? '这个自动化还没有补充说明。' : 'This automation plan has no description yet.')}
        </Paragraph>

        <div className={styles.metaGrid}>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>{pa('nextRun', isZh ? '下次执行' : 'Next run')}</div>
            <div className={styles.metaValue}>
              {schedule.triggerType === 'cron'
                ? formatDateTime(schedule.nextRunAt)
                : pa('waitExternal', isZh ? '等待外部触发' : 'Waiting for external trigger')}
            </div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>{pa('lastRun', isZh ? '最近执行' : 'Last run')}</div>
            <div className={styles.metaValue}>{formatDateTime(schedule.lastRunAt)}</div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>{pa('lastStatus', isZh ? '最近状态' : 'Recent status')}</div>
            <div className={styles.metaValue}>
              <Tag color={getStatusTone(lastStatus)}>
                {lastStatus === 'idle' ? pa('notRunYet', isZh ? '未运行' : 'Not run yet') : lastStatus}
              </Tag>
            </div>
          </div>
          <div className={styles.metaCard}>
            <div className={styles.metaLabel}>{pa('runCount', isZh ? '累计执行' : 'Run count')}</div>
            <div className={styles.metaValue}>{pa('runCountValue', isZh ? '{{count}} 次' : '{{count}} runs', { count: schedule.runCount })}</div>
          </div>
        </div>

        <div className={styles.cardFooter}>
          <Button
            icon={<ArrowRightOutlined />}
            onClick={() => openWorkflowAutomation(schedule)}
          >
            {pa('configure', isZh ? '配置自动化' : 'Configure')}
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            loading={submittingId === schedule.id}
            onClick={() => void handleTriggerNow(schedule.id)}
          >
            {pa('runNow', isZh ? '立即执行' : 'Run now')}
          </Button>
          <Popconfirm
            title={pa('disableConfirmTitle', isZh ? '停用这个自动化？' : 'Disable this automation?')}
            description={pa(
              'disableConfirmDescription',
              isZh ? '它会停止自动触发，但历史记录会保留。' : 'It will stop triggering automatically while keeping its history.',
            )}
            onConfirm={() => void handleDisable(schedule.id)}
          >
            <Button danger icon={<StopOutlined />} loading={submittingId === schedule.id} disabled={!schedule.isActive}>
              {pa('disableAction', isZh ? '停用' : 'Disable')}
            </Button>
          </Popconfirm>
        </div>
      </article>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <div>
          <div className={styles.eyebrow}>{pa('eyebrow', isZh ? '项目自动化' : 'Project automation')}</div>
          <div className={styles.title}>{pa('title', isZh ? '在一个视图里查看整个项目的自动化任务' : 'View the whole project automation landscape in one place')}</div>
          <div className={styles.subtitle}>
            {pa(
              'subtitle',
              isZh
                ? '这里汇总项目下所有工作流的定时任务和 Webhook 触发器，方便统一排查、执行和停用。'
                : 'This view keeps every schedule and webhook trigger in one place so the team can inspect, run, and disable them faster.',
            )}
          </div>
        </div>

        <div className={styles.heroActions}>
          <Button icon={<ReloadOutlined />} onClick={() => void loadSchedules()}>
            {pa('refresh', isZh ? '刷新' : 'Refresh')}
          </Button>
          {!embedded ? (
            <Button type="primary" onClick={() => navigate(`/projects/${projectIdNumber}/workflows`)}>
              {pa('backToWorkflows', isZh ? '返回工作流' : 'Back to workflows')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{pa('totalPlans', isZh ? '当前页任务' : 'Plans on page')}</div>
          <div className={styles.metricValue}>{schedules.length}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{pa('activePlans', isZh ? '启用中' : 'Active')}</div>
          <div className={styles.metricValue}>{metrics.activeCount}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{pa('cronPlans', isZh ? '定时任务' : 'Scheduled')}</div>
          <div className={styles.metricValue}>{metrics.cronCount}</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{pa('webhookPlans', isZh ? 'Webhook 任务' : 'Webhook')}</div>
          <div className={styles.metricValue}>{metrics.webhookCount}</div>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarPrimary}>
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={pa('searchPlaceholder', isZh ? '搜索任务名、说明或工作流名' : 'Search by plan, description, or workflow')}
            className={styles.searchInput}
          />
          <Select
            allowClear
            value={triggerType}
            onChange={setTriggerType}
            className={styles.filterSelect}
            placeholder={pa('triggerFilter', isZh ? '触发类型' : 'Trigger type')}
            options={[
              { label: pa('scheduledTrigger', isZh ? '定时计划' : 'Scheduled'), value: 'cron' },
              { label: 'Webhook', value: 'webhook' },
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            className={styles.filterSelect}
            options={[
              { label: pa('allStatus', isZh ? '全部状态' : 'All status'), value: 'all' },
              { label: pa('active', isZh ? '启用中' : 'Active'), value: 'active' },
              { label: pa('disabled', isZh ? '已停用' : 'Disabled'), value: 'disabled' },
            ]}
          />
        </div>
        <div className={styles.toolbarMeta}>
          <ClockCircleOutlined />
          {pa('projectTotal', isZh ? '项目共 {{count}} 条自动化' : '{{count}} automation plans in this project', { count: total })}
        </div>
      </div>

      <Spin spinning={loading}>
        {filteredSchedules.length === 0 ? (
          <div className={styles.emptyWrap}>
            <Empty
              description={
                total === 0
                  ? pa('empty', isZh ? '这个项目还没有自动化任务' : 'This project has no automation plans yet')
                  : pa('emptyFiltered', isZh ? '当前筛选条件下没有匹配结果' : 'No automation plans match the current filters')
              }
            />
          </div>
        ) : (
          <div className={styles.cardGrid}>{filteredSchedules.map(renderCard)}</div>
        )}
      </Spin>

      <div className={styles.paginationWrap}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showTotal={(value) => pa('paginationTotal', isZh ? '共 {{count}} 条' : '{{count}} total', { count: value })}
          onChange={(nextPage, nextPageSize) => {
            void loadSchedules(nextPage, nextPageSize, triggerType);
          }}
        />
      </div>
    </div>
  );
}

export default function ProjectAutomationPage() {
  return <ProjectAutomationContent />;
}

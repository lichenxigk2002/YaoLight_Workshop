import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, App, Button, Card, Col, Empty, Progress, Row, Table, Tag, Typography } from 'antd';
import type { TableProps } from 'antd';
import {
  AlertOutlined,
  ArrowUpOutlined,
  BellOutlined,
  CheckCircleOutlined,
  DeploymentUnitOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { graphic, type EChartsCoreOption } from 'echarts/core';
import { getAdminTasksSummary, getAdminTaskFailureStats } from '@/api/tasks';
import { listAdminOperationLogs } from '@/api/operationLogs';
import { getWorkflowTemplateSummary, listWorkflowTemplates } from '@/api/workflowTemplates';
import EChart from '@/components/EChart';
import PageHero from '@/components/PageHero';
import { getAdminUserSummary } from '@/features/users/api';
import { useI18n } from '@/i18n';
import { getAdminNotificationAnalytics } from '@/pages/Notifications/api';
import type { AdminOperationLogListItem } from '@/types/operationLogs';
import { canViewResource } from '@/utils/permissions';
import { getAdminSession } from '@/utils/storage';
import { useAdminTheme } from '@/theme';
import styles from './index.module.scss';

const { Paragraph, Text, Title } = Typography;

const emptyOption = (text: string): EChartsCoreOption => ({
  animation: false,
  xAxis: { show: false },
  yAxis: { show: false },
  series: [],
  graphic: [{ type: 'text', left: 'center', top: 'middle', style: { text, fill: '#98A2B3', fontSize: 14 } }],
});

const fmtNum = (n?: number | null) => (n === undefined || n === null ? '--' : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`);
const fmtPct = (n?: number | null, d = 1) => (n === undefined || n === null ? '--' : `${n.toFixed(d)}%`);
const clamp = (n?: number | null) => Math.max(0, Math.min(100, n ?? 0));
const fmtMs = (n?: number | null) => (!n ? '--' : n < 1000 ? `${n}ms` : `${Math.floor(n / 60000)}m ${Math.round((n % 60000) / 1000)}s`);
const jobLabel = (v: string, t: (key: string) => string) => ({
  completed: t('dashboard.jobCompleted'),
  partial_failed: t('dashboard.jobPartialFailed'),
  failed: t('dashboard.jobFailed'),
}[v] ?? v);

export default function DashboardPage() {
  const { message } = App.useApp();
  const { t } = useI18n();
  const { resolvedTheme } = useAdminTheme();
  const mountedRef = useRef(true);
  const permissions = getAdminSession()?.user.permissions ?? [];
  const access = useMemo(() => ({
    users: canViewResource(permissions, 'users'),
    tasks: canViewResource(permissions, 'tasks.overview'),
    failures: canViewResource(permissions, 'tasks.failures'),
    templates: canViewResource(permissions, 'workflow_templates'),
    notifications: canViewResource(permissions, 'notifications.analytics'),
    logs: canViewResource(permissions, 'operation_logs'),
  }), [permissions]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string>('');
  const [data, setData] = useState({
    userSummary: null as Awaited<ReturnType<typeof getAdminUserSummary>> | null,
    taskSummary: null as Awaited<ReturnType<typeof getAdminTasksSummary>> | null,
    failureStats: null as Awaited<ReturnType<typeof getAdminTaskFailureStats>> | null,
    templateSummary: null as Awaited<ReturnType<typeof getWorkflowTemplateSummary>> | null,
    topTemplates: [] as Awaited<ReturnType<typeof listWorkflowTemplates>>['list'],
    notificationAnalytics: null as Awaited<ReturnType<typeof getAdminNotificationAnalytics>> | null,
    operationLogs: [] as AdminOperationLogListItem[],
  });

  async function loadDashboard(showToast = false) {
    const jobs: Array<{ key: keyof typeof data; label: string; run: () => Promise<unknown> }> = [];
    if (access.users) jobs.push({ key: 'userSummary', label: t('dashboard.jobUserSummary'), run: getAdminUserSummary });
    if (access.tasks) jobs.push({ key: 'taskSummary', label: t('dashboard.jobTaskSummary'), run: getAdminTasksSummary });
    if (access.failures) jobs.push({ key: 'failureStats', label: t('dashboard.jobFailureStats'), run: getAdminTaskFailureStats });
    if (access.templates) {
      jobs.push({ key: 'templateSummary', label: t('dashboard.jobTemplateSummary'), run: getWorkflowTemplateSummary });
      jobs.push({
        key: 'topTemplates',
        label: t('dashboard.jobTemplateRank'),
        run: async () => (await listWorkflowTemplates({ page: 1, page_size: 50 })).list.sort((a, b) => b.usage_count - a.usage_count).slice(0, 6),
      });
    }
    if (access.notifications) jobs.push({ key: 'notificationAnalytics', label: t('dashboard.jobNotificationAnalytics'), run: getAdminNotificationAnalytics });
    if (access.logs) jobs.push({ key: 'operationLogs', label: t('dashboard.jobOperationLogs'), run: async () => (await listAdminOperationLogs({ page: 1, page_size: 8 })).list });

    if (!lastUpdatedAt) setLoading(true); else setRefreshing(true);
    const results = await Promise.allSettled(jobs.map(async (job) => ({ key: job.key, value: await job.run() })));
    if (!mountedRef.current) return;

    const next = { userSummary: null, taskSummary: null, failureStats: null, templateSummary: null, topTemplates: [], notificationAnalytics: null, operationLogs: [] } as typeof data;
    const nextErrors: string[] = [];
    let ok = 0;
    results.forEach((result, index) => {
      const job = jobs[index];
      if (result.status === 'fulfilled') {
        ok += 1;
        (next[job.key] as unknown) = result.value.value;
      } else {
        nextErrors.push(`${job.label}: ${result.reason instanceof Error ? result.reason.message : t('dashboard.requestFailed')}`);
      }
    });

    setData(next);
    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
    setLastUpdatedAt(new Date().toISOString());
    if (showToast) message[ok === jobs.length ? 'success' : ok > 0 ? 'warning' : 'error'](ok === jobs.length ? t('dashboard.refreshSuccess') : ok > 0 ? t('dashboard.refreshPartialFailed') : t('dashboard.refreshFailed'));
  }

  useEffect(() => {
    mountedRef.current = true;
    void loadDashboard();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const cards: Array<{ key: string; eyebrow: string; title: string; value: string; note: string; progress: number; color: string; icon: ReactNode; bg: string; trend: string; tone: string }> = [];
    if (data.userSummary) cards.push({ key: 'users', eyebrow: t('dashboard.metricUsersEyebrow'), title: t('dashboard.metricUsersTitle'), value: fmtNum(data.userSummary.total), note: t('dashboard.metricUsersNote', { value: fmtPct(data.userSummary.total ? (data.userSummary.active / data.userSummary.total) * 100 : 0) }), progress: data.userSummary.total ? (data.userSummary.active / data.userSummary.total) * 100 : 0, color: '#12b76a', icon: <TeamOutlined />, bg: 'linear-gradient(135deg, #14b8a6, #22c55e)', trend: t('dashboard.metricUsersTrend', { count: data.userSummary.new_last_7_days }), tone: styles.trendPositive });
    if (data.taskSummary) cards.push({ key: 'tasks', eyebrow: t('dashboard.metricTasksEyebrow'), title: t('dashboard.metricTasksTitle'), value: fmtNum(data.taskSummary.running), note: t('dashboard.metricTasksNote', { value: fmtMs(data.taskSummary.avg_duration_ms) }), progress: data.taskSummary.total ? ((data.taskSummary.total - data.taskSummary.failed) / data.taskSummary.total) * 100 : 0, color: '#175cd3', icon: <AlertOutlined />, bg: 'linear-gradient(135deg, #175cd3, #36bffa)', trend: t('dashboard.metricTasksTrend', { value: fmtPct(data.taskSummary.failure_rate_24h, 2) }), tone: (data.taskSummary.failure_rate_24h ?? 0) > 10 ? styles.trendWarning : styles.trendNeutral });
    if (data.templateSummary) cards.push({ key: 'templates', eyebrow: t('dashboard.metricTemplatesEyebrow'), title: t('dashboard.metricTemplatesTitle'), value: fmtNum(data.templateSummary.published), note: t('dashboard.metricTemplatesNote', { count: data.templateSummary.draft + data.templateSummary.disabled }), progress: data.templateSummary.total ? (data.templateSummary.published / data.templateSummary.total) * 100 : 0, color: '#7a5af8', icon: <DeploymentUnitOutlined />, bg: 'linear-gradient(135deg, #7a5af8, #2e90fa)', trend: t('dashboard.metricTemplatesTrend', { count: data.templateSummary.public }), tone: styles.trendNeutral });
    if (data.notificationAnalytics) cards.push({ key: 'notifications', eyebrow: t('dashboard.metricNotificationsEyebrow'), title: t('dashboard.metricNotificationsTitle'), value: fmtPct(data.notificationAnalytics.overview.read_rate), note: t('dashboard.metricNotificationsNote', { count: data.notificationAnalytics.overview.active_templates }), progress: clamp(data.notificationAnalytics.overview.read_rate), color: '#f79009', icon: <BellOutlined />, bg: 'linear-gradient(135deg, #f59e0b, #f97316)', trend: t('dashboard.metricNotificationsTrend', { count: data.notificationAnalytics.overview.failed_deliveries }), tone: data.notificationAnalytics.overview.failed_deliveries > 0 ? styles.trendWarning : styles.trendPositive });
    return cards;
  }, [data, t]);

  const attentionItems = useMemo(() => {
    const items: Array<{ key: string; title: string; desc: string; value: string; tone: string; path?: string }> = [];
    if (data.taskSummary?.failed) items.push({ key: 'tasks', title: t('dashboard.attentionFailedTasksTitle'), desc: t('dashboard.attentionFailedTasksDesc', { count: data.taskSummary.failed }), value: t('dashboard.countTasks', { count: data.taskSummary.failed }), tone: styles.attentionDanger, path: '/tasks/failures' });
    if (data.notificationAnalytics?.overview.failed_deliveries) items.push({ key: 'notify', title: t('dashboard.attentionFailedDeliveriesTitle'), desc: t('dashboard.attentionFailedDeliveriesDesc', { count: data.notificationAnalytics.overview.failed_deliveries }), value: t('dashboard.countRows', { count: data.notificationAnalytics.overview.failed_deliveries }), tone: styles.attentionWarning, path: '/notifications/analytics' });
    if (data.templateSummary && (data.templateSummary.draft || data.templateSummary.disabled)) items.push({ key: 'templates', title: t('dashboard.attentionTemplatesTitle'), desc: t('dashboard.attentionTemplatesDesc', { draft: data.templateSummary.draft, disabled: data.templateSummary.disabled }), value: t('dashboard.countItems', { count: data.templateSummary.draft + data.templateSummary.disabled }), tone: '', path: '/workflow-templates' });
    if (data.userSummary?.new_last_7_days) items.push({ key: 'users', title: t('dashboard.attentionUsersTitle'), desc: t('dashboard.attentionUsersDesc', { count: data.userSummary.new_last_7_days }), value: t('dashboard.countUsers', { count: data.userSummary.new_last_7_days }), tone: styles.attentionSuccess, path: '/users' });
    return items.length ? items.slice(0, 4) : [{ key: 'ok', title: t('dashboard.attentionOkTitle'), desc: t('dashboard.attentionOkDesc'), value: t('dashboard.attentionOkValue'), tone: styles.attentionSuccess }];
  }, [data, t]);

  const trendOption = useMemo<EChartsCoreOption>(() => {
    const list = data.failureStats?.daily_trend ?? [];
    if (!list.length) return emptyOption(t('dashboard.emptyFailureTrend'));
    return {
      grid: { left: 18, right: 18, top: 20, bottom: 18, containLabel: true },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 0, textStyle: { color: '#F8FAFC' } },
      xAxis: { type: 'category', boundaryGap: false, axisTick: { show: false }, axisLabel: { color: resolvedTheme.inkSoft }, data: list.map((v) => dayjs(v.day).format('MM-DD')) },
      yAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: resolvedTheme.line } }, axisLabel: { color: resolvedTheme.inkSoft } },
      series: [{ type: 'line', smooth: true, symbolSize: 8, data: list.map((v) => v.count), lineStyle: { width: 3, color: resolvedTheme.brand }, itemStyle: { color: resolvedTheme.panel, borderColor: resolvedTheme.brand, borderWidth: 3 }, areaStyle: { color: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(22, 119, 255, 0.32)' }, { offset: 1, color: 'rgba(22, 119, 255, 0.02)' }]) } }],
    };
  }, [data.failureStats, resolvedTheme.brand, resolvedTheme.inkSoft, resolvedTheme.line, resolvedTheme.panel, t]);

  const notifyOption = useMemo<EChartsCoreOption>(() => {
    const list = data.notificationAnalytics?.job_status_breakdown ?? [];
    if (!list.length) return emptyOption(t('dashboard.emptyNotificationStats'));
    return {
      color: ['#12b76a', '#f79009', '#f04438', '#2e90fa'],
      legend: { bottom: 0, icon: 'circle', textStyle: { color: resolvedTheme.inkSoft } },
      tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 0, textStyle: { color: '#F8FAFC' } },
      series: [{ type: 'pie', radius: ['54%', '78%'], center: ['50%', '44%'], label: { show: false }, itemStyle: { borderColor: resolvedTheme.panel, borderWidth: 4 }, data: list.map((v) => ({ name: jobLabel(v.status, t), value: v.count })) }],
      graphic: [{ type: 'text', left: 'center', top: '34%', style: { text: fmtNum(data.notificationAnalytics?.overview.total_jobs), fill: resolvedTheme.ink, fontSize: 28, fontWeight: 800 } }, { type: 'text', left: 'center', top: '47%', style: { text: t('dashboard.notificationJobsLabel'), fill: resolvedTheme.inkSoft, fontSize: 13 } }],
    };
  }, [data.notificationAnalytics, resolvedTheme.ink, resolvedTheme.inkSoft, resolvedTheme.panel, t]);

  const templateOption = useMemo<EChartsCoreOption>(() => {
    const list = [...data.topTemplates].reverse();
    if (!list.length) return emptyOption(t('dashboard.emptyTemplateRank'));
    return {
      grid: { left: 12, right: 18, top: 10, bottom: 12, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 0, textStyle: { color: '#F8FAFC' } },
      xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: resolvedTheme.line } }, axisLabel: { color: resolvedTheme.inkSoft } },
      yAxis: { type: 'category', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: resolvedTheme.inkSoft, width: 120, overflow: 'truncate' }, data: list.map((v) => v.name) },
      series: [{ type: 'bar', data: list.map((v) => v.usage_count), barWidth: 14, itemStyle: { borderRadius: [0, 10, 10, 0], color: new graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: resolvedTheme.brand }, { offset: 1, color: resolvedTheme.accent }]) }, label: { show: true, position: 'right', color: resolvedTheme.ink, fontWeight: 700 } }],
    };
  }, [data.topTemplates, resolvedTheme.accent, resolvedTheme.brand, resolvedTheme.ink, resolvedTheme.inkSoft, resolvedTheme.line, t]);

  const logColumns = useMemo<TableProps<AdminOperationLogListItem>['columns']>(() => [
    { title: t('dashboard.columnAction'), dataIndex: 'action', key: 'action', width: 170, render: (value: string, r) => <div><div style={{ fontWeight: 700 }}>{value}</div><div className={styles.tableNote}>{r.resource_type}{r.resource_id ? ` #${r.resource_id}` : ''}</div></div> },
    { title: t('dashboard.columnOperator'), dataIndex: 'username', key: 'username', width: 160, render: (_, r) => <div><div style={{ fontWeight: 600 }}>{r.username || t('dashboard.systemOperator')}</div><div className={styles.tableNote}>{r.email || t('dashboard.noEmail')}</div></div> },
    { title: t('dashboard.columnResult'), dataIndex: 'status_code', key: 'status_code', width: 110, render: (v: number | null | undefined) => <Tag className={`${styles.statusTag} ${(v ?? 500) >= 400 ? styles.statusError : styles.statusSuccess}`}>{(v ?? 500) >= 400 ? t('dashboard.resultFailed') : t('dashboard.resultSuccess')}</Tag> },
    { title: t('dashboard.columnTime'), dataIndex: 'created_at', key: 'created_at', width: 160, render: (v: string) => <div><div>{dayjs(v).format('MM-DD HH:mm')}</div><div className={styles.tableNote}>{dayjs(v).format('YYYY')}</div></div> },
  ], [t]);

  const quickLinks = [
    { key: 'tasks', title: t('dashboard.quickTasksTitle'), desc: t('dashboard.quickTasksDesc'), path: '/tasks/failures', permission: 'tasks.failures' },
    { key: 'templates', title: t('dashboard.quickTemplatesTitle'), desc: t('dashboard.quickTemplatesDesc'), path: '/workflow-templates', permission: 'workflow_templates' },
    { key: 'notifications', title: t('dashboard.quickNotificationsTitle'), desc: t('dashboard.quickNotificationsDesc'), path: '/notifications/analytics', permission: 'notifications.analytics' },
    { key: 'logs', title: t('dashboard.quickLogsTitle'), desc: t('dashboard.quickLogsDesc'), path: '/logs/operation', permission: 'operation_logs' },
  ].filter((v) => canViewResource(permissions, v.permission)).slice(0, 4);

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('dashboard.heroEyebrow')}
        title={t('dashboard.heroTitle')}
        description={t('dashboard.heroDescription')}
        tags={[t('dashboard.heroTagOverview'), t('dashboard.heroTagTasks'), t('dashboard.heroTagNotifications'), t('dashboard.heroTagTemplates'), t('dashboard.heroTagLogs')]}
        action={(
          <div className={styles.heroAction}>
            <div className={styles.heroActionCard}>
              <div className={styles.heroActionLabel}>{t('dashboard.currentStatus')}</div>
              <div className={styles.heroActionValue}>{errors.length ? t('dashboard.statusPartialError') : t('dashboard.statusNormal')}</div>
              <div className={styles.heroActionMeta}>
                <span>{t('dashboard.connectedModules', { count: Object.values(access).filter(Boolean).length })}</span>
                <span>{t('dashboard.lastRefresh', { time: lastUpdatedAt ? dayjs(lastUpdatedAt).format('YYYY-MM-DD HH:mm:ss') : t('dashboard.firstLoading') })}</span>
              </div>
            </div>
            <Button type="primary" icon={<ReloadOutlined />} className={styles.refreshButton} loading={refreshing} onClick={() => { void loadDashboard(true); }}>{t('dashboard.refreshButton')}</Button>
          </div>
        )}
      />

      {errors.length > 0 ? <Alert className={styles.errorBanner} type="warning" showIcon message={t('dashboard.partialLoadFailed')} description={errors.join('; ')} /> : null}

      <Row gutter={[16, 16]}>
        {metrics.map((item) => (
          <Col xs={24} md={12} xl={6} key={item.key}>
            <Card bordered={false} className={styles.metricCard} loading={loading}>
              <div className={styles.metricHeader}>
                <div><div className={styles.metricEyebrow}>{item.eyebrow}</div><div className={styles.metricTitle}>{item.title}</div></div>
                <div className={styles.metricIcon} style={{ background: item.bg }}>{item.icon}</div>
              </div>
              <div className={styles.metricValue}>{item.value}</div>
              <div className={styles.metricSuffix}>{item.note}</div>
              <div className={styles.metricProgress}><Progress percent={Number(item.progress.toFixed(1))} showInfo={false} strokeColor={item.color} trailColor="rgba(148, 163, 184, 0.16)" /></div>
              <div className={styles.metricFooter}><span className={item.tone}><ArrowUpOutlined />{item.trend}</span></div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>{t('dashboard.failureTrendTitle')}</Title><Paragraph className={styles.panelDescription}>{t('dashboard.failureTrendDesc')}</Paragraph></div><Text type="secondary">{data.failureStats ? t('dashboard.failureWorkflowCount', { count: data.failureStats.unique_workflows }) : ''}</Text></div>
            <EChart option={trendOption} loading={loading && !data.failureStats} className={styles.chart} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>{t('dashboard.notificationStatusTitle')}</Title><Paragraph className={styles.panelDescription}>{t('dashboard.notificationStatusDesc')}</Paragraph></div><Text type="secondary">{data.notificationAnalytics ? t('dashboard.readRate', { value: fmtPct(data.notificationAnalytics.overview.read_rate) }) : ''}</Text></div>
            <EChart option={notifyOption} loading={loading && !data.notificationAnalytics} className={styles.compactChart} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>{t('dashboard.templateRankTitle')}</Title><Paragraph className={styles.panelDescription}>{t('dashboard.templateRankDesc')}</Paragraph></div><Text type="secondary">{data.templateSummary ? t('dashboard.publicTemplateCount', { count: data.templateSummary.public }) : ''}</Text></div>
            <EChart option={templateOption} loading={loading && !data.topTemplates.length} className={styles.compactChart} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>{t('dashboard.riskTitle')}</Title><Paragraph className={styles.panelDescription}>{t('dashboard.riskDesc')}</Paragraph></div></div>
            <div className={styles.attentionList}>
              {attentionItems.map((item) => (
                <div key={item.key} className={`${styles.attentionItem} ${item.tone}`}>
                  <div className={styles.attentionTitleRow}><div className={styles.attentionTitle}>{item.title}</div><div className={styles.attentionValue}>{item.value}</div></div>
                  <div className={styles.attentionDescription}>{item.desc}</div>
                  {item.path ? <Link to={item.path} className={styles.attentionAction}>{t('dashboard.goHandle')}</Link> : null}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>{t('dashboard.recentLogsTitle')}</Title><Paragraph className={styles.panelDescription}>{t('dashboard.recentLogsDesc')}</Paragraph></div>{access.logs ? <Link to="/logs/operation">{t('dashboard.viewAll')}</Link> : null}</div>
            {access.logs ? (
              <Table<AdminOperationLogListItem> className={styles.logTable} rowKey="id" dataSource={data.operationLogs} columns={logColumns} loading={loading && !data.operationLogs.length} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('dashboard.emptyRecentLogs')} /> }} />
            ) : (
              <div className={styles.emptyState}>{t('dashboard.noLogPermission')}</div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>{t('dashboard.quickLinksTitle')}</Title><Paragraph className={styles.panelDescription}>{t('dashboard.quickLinksDesc')}</Paragraph></div><CheckCircleOutlined style={{ color: '#1677ff' }} /></div>
            {quickLinks.length ? (
              <div className={styles.quickLinks}>
                {quickLinks.map((item) => <Link key={item.key} to={item.path} className={styles.quickLink}><div className={styles.quickLinkTitle}>{item.title}</div><div className={styles.quickLinkDescription}>{item.desc}</div><div className={styles.quickLinkMeta}>{t('dashboard.enterNow')}</div></Link>)}
              </div>
            ) : (
              <div className={styles.emptyState}>{t('dashboard.noQuickLinks')}</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

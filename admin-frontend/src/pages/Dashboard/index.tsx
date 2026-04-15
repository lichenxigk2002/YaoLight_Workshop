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
const jobLabel = (v: string) => ({ completed: '已完成', partial_failed: '部分失败', failed: '失败' }[v] ?? v);

export default function DashboardPage() {
  const { message } = App.useApp();
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
    if (access.users) jobs.push({ key: 'userSummary', label: '用户概览', run: getAdminUserSummary });
    if (access.tasks) jobs.push({ key: 'taskSummary', label: '任务概览', run: getAdminTasksSummary });
    if (access.failures) jobs.push({ key: 'failureStats', label: '异常分析', run: getAdminTaskFailureStats });
    if (access.templates) {
      jobs.push({ key: 'templateSummary', label: '模板概览', run: getWorkflowTemplateSummary });
      jobs.push({
        key: 'topTemplates',
        label: '模板排行',
        run: async () => (await listWorkflowTemplates({ page: 1, page_size: 50 })).list.sort((a, b) => b.usage_count - a.usage_count).slice(0, 6),
      });
    }
    if (access.notifications) jobs.push({ key: 'notificationAnalytics', label: '通知分析', run: getAdminNotificationAnalytics });
    if (access.logs) jobs.push({ key: 'operationLogs', label: '操作日志', run: async () => (await listAdminOperationLogs({ page: 1, page_size: 8 })).list });

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
        nextErrors.push(`${job.label}：${result.reason instanceof Error ? result.reason.message : '请求失败'}`);
      }
    });

    setData(next);
    setErrors(nextErrors);
    setLoading(false);
    setRefreshing(false);
    setLastUpdatedAt(new Date().toISOString());
    if (showToast) message[ok === jobs.length ? 'success' : ok > 0 ? 'warning' : 'error'](ok === jobs.length ? '仪表盘已刷新' : ok > 0 ? '部分模块刷新失败' : '仪表盘刷新失败');
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
    if (data.userSummary) cards.push({ key: 'users', eyebrow: '用户运营', title: '总用户数', value: fmtNum(data.userSummary.total), note: `活跃率 ${fmtPct(data.userSummary.total ? (data.userSummary.active / data.userSummary.total) * 100 : 0)}`, progress: data.userSummary.total ? (data.userSummary.active / data.userSummary.total) * 100 : 0, color: '#12b76a', icon: <TeamOutlined />, bg: 'linear-gradient(135deg, #14b8a6, #22c55e)', trend: `近 7 日新增 ${data.userSummary.new_last_7_days}`, tone: styles.trendPositive });
    if (data.taskSummary) cards.push({ key: 'tasks', eyebrow: '任务健康', title: '运行中任务', value: fmtNum(data.taskSummary.running), note: `平均耗时 ${fmtMs(data.taskSummary.avg_duration_ms)}`, progress: data.taskSummary.total ? ((data.taskSummary.total - data.taskSummary.failed) / data.taskSummary.total) * 100 : 0, color: '#175cd3', icon: <AlertOutlined />, bg: 'linear-gradient(135deg, #175cd3, #36bffa)', trend: `24h 失败率 ${fmtPct(data.taskSummary.failure_rate_24h, 2)}`, tone: (data.taskSummary.failure_rate_24h ?? 0) > 10 ? styles.trendWarning : styles.trendNeutral });
    if (data.templateSummary) cards.push({ key: 'templates', eyebrow: '模板资产', title: '已发布模板', value: fmtNum(data.templateSummary.published), note: `草稿/停用 ${data.templateSummary.draft + data.templateSummary.disabled}`, progress: data.templateSummary.total ? (data.templateSummary.published / data.templateSummary.total) * 100 : 0, color: '#7a5af8', icon: <DeploymentUnitOutlined />, bg: 'linear-gradient(135deg, #7a5af8, #2e90fa)', trend: `公开模板 ${data.templateSummary.public}`, tone: styles.trendNeutral });
    if (data.notificationAnalytics) cards.push({ key: 'notifications', eyebrow: '消息触达', title: '通知阅读率', value: fmtPct(data.notificationAnalytics.overview.read_rate), note: `活跃模板 ${data.notificationAnalytics.overview.active_templates}`, progress: clamp(data.notificationAnalytics.overview.read_rate), color: '#f79009', icon: <BellOutlined />, bg: 'linear-gradient(135deg, #f59e0b, #f97316)', trend: `失败投递 ${data.notificationAnalytics.overview.failed_deliveries}`, tone: data.notificationAnalytics.overview.failed_deliveries > 0 ? styles.trendWarning : styles.trendPositive });
    return cards;
  }, [data]);

  const attentionItems = useMemo(() => {
    const items: Array<{ key: string; title: string; desc: string; value: string; tone: string; path?: string }> = [];
    if (data.taskSummary?.failed) items.push({ key: 'tasks', title: '失败任务待处理', desc: `累计失败 ${data.taskSummary.failed} 个，建议优先检查超时与高频失败节点。`, value: `${data.taskSummary.failed} 个`, tone: styles.attentionDanger, path: '/tasks/failures' });
    if (data.notificationAnalytics?.overview.failed_deliveries) items.push({ key: 'notify', title: '通知投递存在失败', desc: `当前失败投递 ${data.notificationAnalytics.overview.failed_deliveries} 条，建议检查模板和筛选条件。`, value: `${data.notificationAnalytics.overview.failed_deliveries} 条`, tone: styles.attentionWarning, path: '/notifications/analytics' });
    if (data.templateSummary && (data.templateSummary.draft || data.templateSummary.disabled)) items.push({ key: 'templates', title: '模板资产有积压', desc: `存在 ${data.templateSummary.draft} 个草稿、${data.templateSummary.disabled} 个停用模板。`, value: `${data.templateSummary.draft + data.templateSummary.disabled} 个`, tone: '', path: '/workflow-templates' });
    if (data.userSummary?.new_last_7_days) items.push({ key: 'users', title: '近期用户增长稳定', desc: `近 7 天新增 ${data.userSummary.new_last_7_days} 位用户，可以继续观察转化情况。`, value: `${data.userSummary.new_last_7_days} 人`, tone: styles.attentionSuccess, path: '/users' });
    return items.length ? items.slice(0, 4) : [{ key: 'ok', title: '当前没有需要立即处理的异常', desc: '已加载数据未发现明显风险项，可继续做日常巡检。', value: '稳定', tone: styles.attentionSuccess }];
  }, [data]);

  const trendOption = useMemo<EChartsCoreOption>(() => {
    const list = data.failureStats?.daily_trend ?? [];
    if (!list.length) return emptyOption('暂无异常趋势');
    return {
      grid: { left: 18, right: 18, top: 20, bottom: 18, containLabel: true },
      tooltip: { trigger: 'axis', backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 0, textStyle: { color: '#F8FAFC' } },
      xAxis: { type: 'category', boundaryGap: false, axisTick: { show: false }, axisLabel: { color: resolvedTheme.inkSoft }, data: list.map((v) => dayjs(v.day).format('MM-DD')) },
      yAxis: { type: 'value', minInterval: 1, axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: resolvedTheme.line } }, axisLabel: { color: resolvedTheme.inkSoft } },
      series: [{ type: 'line', smooth: true, symbolSize: 8, data: list.map((v) => v.count), lineStyle: { width: 3, color: resolvedTheme.brand }, itemStyle: { color: resolvedTheme.panel, borderColor: resolvedTheme.brand, borderWidth: 3 }, areaStyle: { color: new graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(22, 119, 255, 0.32)' }, { offset: 1, color: 'rgba(22, 119, 255, 0.02)' }]) } }],
    };
  }, [data.failureStats, resolvedTheme.brand, resolvedTheme.inkSoft, resolvedTheme.line, resolvedTheme.panel]);

  const notifyOption = useMemo<EChartsCoreOption>(() => {
    const list = data.notificationAnalytics?.job_status_breakdown ?? [];
    if (!list.length) return emptyOption('暂无通知统计');
    return {
      color: ['#12b76a', '#f79009', '#f04438', '#2e90fa'],
      legend: { bottom: 0, icon: 'circle', textStyle: { color: resolvedTheme.inkSoft } },
      tooltip: { trigger: 'item', backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 0, textStyle: { color: '#F8FAFC' } },
      series: [{ type: 'pie', radius: ['54%', '78%'], center: ['50%', '44%'], label: { show: false }, itemStyle: { borderColor: resolvedTheme.panel, borderWidth: 4 }, data: list.map((v) => ({ name: jobLabel(v.status), value: v.count })) }],
      graphic: [{ type: 'text', left: 'center', top: '34%', style: { text: fmtNum(data.notificationAnalytics?.overview.total_jobs), fill: resolvedTheme.ink, fontSize: 28, fontWeight: 800 } }, { type: 'text', left: 'center', top: '47%', style: { text: '通知任务', fill: resolvedTheme.inkSoft, fontSize: 13 } }],
    };
  }, [data.notificationAnalytics, resolvedTheme.ink, resolvedTheme.inkSoft, resolvedTheme.panel]);

  const templateOption = useMemo<EChartsCoreOption>(() => {
    const list = [...data.topTemplates].reverse();
    if (!list.length) return emptyOption('暂无模板排行');
    return {
      grid: { left: 12, right: 18, top: 10, bottom: 12, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: 'rgba(15, 23, 42, 0.92)', borderWidth: 0, textStyle: { color: '#F8FAFC' } },
      xAxis: { type: 'value', axisLine: { show: false }, axisTick: { show: false }, splitLine: { lineStyle: { color: resolvedTheme.line } }, axisLabel: { color: resolvedTheme.inkSoft } },
      yAxis: { type: 'category', axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: resolvedTheme.inkSoft, width: 120, overflow: 'truncate' }, data: list.map((v) => v.name) },
      series: [{ type: 'bar', data: list.map((v) => v.usage_count), barWidth: 14, itemStyle: { borderRadius: [0, 10, 10, 0], color: new graphic.LinearGradient(1, 0, 0, 0, [{ offset: 0, color: resolvedTheme.brand }, { offset: 1, color: resolvedTheme.accent }]) }, label: { show: true, position: 'right', color: resolvedTheme.ink, fontWeight: 700 } }],
    };
  }, [data.topTemplates, resolvedTheme.accent, resolvedTheme.brand, resolvedTheme.ink, resolvedTheme.inkSoft, resolvedTheme.line]);

  const logColumns = useMemo<TableProps<AdminOperationLogListItem>['columns']>(() => [
    { title: '操作', dataIndex: 'action', key: 'action', width: 170, render: (value: string, r) => <div><div style={{ fontWeight: 700 }}>{value}</div><div className={styles.tableNote}>{r.resource_type}{r.resource_id ? ` #${r.resource_id}` : ''}</div></div> },
    { title: '执行人', dataIndex: 'username', key: 'username', width: 160, render: (_, r) => <div><div style={{ fontWeight: 600 }}>{r.username || '系统'}</div><div className={styles.tableNote}>{r.email || '未记录邮箱'}</div></div> },
    { title: '结果', dataIndex: 'status_code', key: 'status_code', width: 110, render: (v: number | null | undefined) => <Tag className={`${styles.statusTag} ${(v ?? 500) >= 400 ? styles.statusError : styles.statusSuccess}`}>{(v ?? 500) >= 400 ? '失败' : '成功'}</Tag> },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v: string) => <div><div>{dayjs(v).format('MM-DD HH:mm')}</div><div className={styles.tableNote}>{dayjs(v).format('YYYY')}</div></div> },
  ], []);

  const quickLinks = [
    { key: 'tasks', title: '任务排障中心', desc: '查看失败任务与节点执行。', path: '/tasks/failures', permission: 'tasks.failures' },
    { key: 'templates', title: '模板发布管理', desc: '统一处理草稿和高频模板。', path: '/workflow-templates', permission: 'workflow_templates' },
    { key: 'notifications', title: '通知投递分析', desc: '检查失败投递和阅读率。', path: '/notifications/analytics', permission: 'notifications.analytics' },
    { key: 'logs', title: '后台操作审计', desc: '追踪关键管理动作与失败请求。', path: '/logs/operation', permission: 'operation_logs' },
  ].filter((v) => canViewResource(permissions, v.permission)).slice(0, 4);

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="管理驾驶舱"
        title="平台仪表盘"
        description="聚合用户、任务、模板、通知和操作审计数据，帮助你在一个页面里完成每日巡检、风险发现与模块跳转。"
        tags={['实时概览', '任务健康', '通知触达', '模板资产', '操作审计']}
        action={(
          <div className={styles.heroAction}>
            <div className={styles.heroActionCard}>
              <div className={styles.heroActionLabel}>当前状态</div>
              <div className={styles.heroActionValue}>{errors.length ? '部分模块异常' : '核心指标运行正常'}</div>
              <div className={styles.heroActionMeta}>
                <span>已接入模块 {Object.values(access).filter(Boolean).length}</span>
                <span>上次刷新 {lastUpdatedAt ? dayjs(lastUpdatedAt).format('YYYY-MM-DD HH:mm:ss') : '首次加载中'}</span>
              </div>
            </div>
            <Button type="primary" icon={<ReloadOutlined />} className={styles.refreshButton} loading={refreshing} onClick={() => { void loadDashboard(true); }}>刷新首页数据</Button>
          </div>
        )}
      />

      {errors.length > 0 ? <Alert className={styles.errorBanner} type="warning" showIcon message="部分模块数据加载失败" description={errors.join('；')} /> : null}

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
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>任务异常趋势</Title><Paragraph className={styles.panelDescription}>观察失败任务走势，判断异常是否持续放大。</Paragraph></div><Text type="secondary">{data.failureStats ? `故障工作流 ${data.failureStats.unique_workflows}` : ''}</Text></div>
            <EChart option={trendOption} loading={loading && !data.failureStats} className={styles.chart} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>通知投递状态</Title><Paragraph className={styles.panelDescription}>快速发现投递失败和任务状态分布。</Paragraph></div><Text type="secondary">{data.notificationAnalytics ? `阅读率 ${fmtPct(data.notificationAnalytics.overview.read_rate)}` : ''}</Text></div>
            <EChart option={notifyOption} loading={loading && !data.notificationAnalytics} className={styles.compactChart} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={14}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>模板使用排行</Title><Paragraph className={styles.panelDescription}>优先维护热门模板和公共模板。</Paragraph></div><Text type="secondary">{data.templateSummary ? `公开模板 ${data.templateSummary.public}` : ''}</Text></div>
            <EChart option={templateOption} loading={loading && !data.topTemplates.length} className={styles.compactChart} />
          </Card>
        </Col>
        <Col xs={24} xl={10}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>风险提醒</Title><Paragraph className={styles.panelDescription}>承接当天最需要优先处理的运营信号。</Paragraph></div></div>
            <div className={styles.attentionList}>
              {attentionItems.map((item) => (
                <div key={item.key} className={`${styles.attentionItem} ${item.tone}`}>
                  <div className={styles.attentionTitleRow}><div className={styles.attentionTitle}>{item.title}</div><div className={styles.attentionValue}>{item.value}</div></div>
                  <div className={styles.attentionDescription}>{item.desc}</div>
                  {item.path ? <Link to={item.path} className={styles.attentionAction}>前往处理</Link> : null}
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={16}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>最近后台操作</Title><Paragraph className={styles.panelDescription}>展示最新管理动作，便于审计与复盘。</Paragraph></div>{access.logs ? <Link to="/logs/operation">查看全部</Link> : null}</div>
            {access.logs ? (
              <Table<AdminOperationLogListItem> className={styles.logTable} rowKey="id" dataSource={data.operationLogs} columns={logColumns} loading={loading && !data.operationLogs.length} pagination={false} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无最近操作" /> }} />
            ) : (
              <div className={styles.emptyState}>当前账号没有操作日志查看权限。</div>
            )}
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card bordered={false} className={styles.panelCard}>
            <div className={styles.panelHeader}><div><Title level={3} className={styles.panelTitle}>快捷入口</Title><Paragraph className={styles.panelDescription}>从首页直接进入最常用的后台模块。</Paragraph></div><CheckCircleOutlined style={{ color: '#1677ff' }} /></div>
            {quickLinks.length ? (
              <div className={styles.quickLinks}>
                {quickLinks.map((item) => <Link key={item.key} to={item.path} className={styles.quickLink}><div className={styles.quickLinkTitle}>{item.title}</div><div className={styles.quickLinkDescription}>{item.desc}</div><div className={styles.quickLinkMeta}>立即进入</div></Link>)}
              </div>
            ) : (
              <div className={styles.emptyState}>当前账号仅开放首页访问，没有更多业务模块入口。</div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

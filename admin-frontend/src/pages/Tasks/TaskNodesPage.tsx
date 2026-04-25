import { useEffect, useState } from 'react';
import { App, Card, Empty, Spin, Statistic, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useOutletContext } from 'react-router-dom';
import { getAdminTaskNodeExecutionDetail, getAdminTaskNodeExecutions } from '@/api/tasks';
import CodeViewer from '@/components/CodeViewer';
import { useI18n } from '@/i18n';
import type { AdminTaskNodeExecution } from '@/types/tasks';
import type { TaskDetailOutletContext } from './TaskDetailLayout';
import { getTaskStatusMeta } from './taskStatus';
import styles from './Tasks.module.scss';

const { Text } = Typography;

type TimelineNodeExecution = AdminTaskNodeExecution & {
  timelineStart: number;
  timelineEnd: number;
  lane: number;
  offsetPercent: number;
  widthPercent: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
}

function deriveExecutionWindow(execution: AdminTaskNodeExecution) {
  const startedAt = execution.startedAt ? dayjs(execution.startedAt).valueOf() : null;
  const completedAt = execution.completedAt ? dayjs(execution.completedAt).valueOf() : null;
  const createdAt = dayjs(execution.createdAt).valueOf();

  const start = startedAt ?? createdAt;
  let end = completedAt ?? null;
  if (end == null && execution.executionTime != null) {
    end = start + execution.executionTime;
  }
  if (end == null || end < start) {
    end = start + 1;
  }

  return { start, end };
}

function buildConcurrentTimeline(executions: AdminTaskNodeExecution[]) {
  if (executions.length === 0) {
    return {
      timeline: [] as TimelineNodeExecution[],
      totalDuration: 0,
      peakConcurrency: 0,
      laneCount: 0,
    };
  }

  const sorted = [...executions].sort((a, b) => {
    const windowA = deriveExecutionWindow(a);
    const windowB = deriveExecutionWindow(b);
    if (windowA.start !== windowB.start) {
      return windowA.start - windowB.start;
    }
    return windowA.end - windowB.end;
  });

  let globalStart = Number.POSITIVE_INFINITY;
  let globalEnd = Number.NEGATIVE_INFINITY;
  const laneEndTimes: number[] = [];
  const timeline: TimelineNodeExecution[] = [];

  for (const execution of sorted) {
    const { start, end } = deriveExecutionWindow(execution);
    globalStart = Math.min(globalStart, start);
    globalEnd = Math.max(globalEnd, end);

    let lane = laneEndTimes.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(end);
    } else {
      laneEndTimes[lane] = end;
    }

    timeline.push({
      ...execution,
      timelineStart: start,
      timelineEnd: end,
      lane,
      offsetPercent: 0,
      widthPercent: 0,
    });
  }

  const duration = Math.max(globalEnd - globalStart, 1);
  const withPercents = timeline.map((execution) => ({
    ...execution,
    offsetPercent: ((execution.timelineStart - globalStart) / duration) * 100,
    widthPercent: Math.max(((execution.timelineEnd - execution.timelineStart) / duration) * 100, 3),
  }));

  const events: Array<{ time: number; delta: number }> = [];
  for (const execution of withPercents) {
    events.push({ time: execution.timelineStart, delta: 1 });
    events.push({ time: execution.timelineEnd, delta: -1 });
  }
  events.sort((a, b) => (a.time === b.time ? a.delta - b.delta : a.time - b.time));

  let running = 0;
  let peakConcurrency = 0;
  for (const event of events) {
    running += event.delta;
    peakConcurrency = Math.max(peakConcurrency, running);
  }

  return {
    timeline: withPercents,
    totalDuration: duration,
    peakConcurrency,
    laneCount: laneEndTimes.length,
  };
}

function formatDuration(value: number) {
  if (value < 1000) return `${value} ms`;
  return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} s`;
}

function getTimelineBarClassName(status: string) {
  switch (status) {
    case 'completed':
      return styles.timelineBarSuccess;
    case 'failed':
    case 'timeout':
      return styles.timelineBarError;
    case 'running':
      return styles.timelineBarRunning;
    case 'skipped':
    case 'cancelled':
      return styles.timelineBarMuted;
    default:
      return styles.timelineBarNeutral;
  }
}

export default function TaskNodesPage() {
  const { message } = App.useApp();
  const { locale, t } = useI18n();
  const { detail } = useOutletContext<TaskDetailOutletContext>();
  const [executions, setExecutions] = useState<AdminTaskNodeExecution[]>([]);
  const [loading, setLoading] = useState(false);
  const [executionDetails, setExecutionDetails] = useState<Record<number, AdminTaskNodeExecution>>({});
  const [expandedRowKeys, setExpandedRowKeys] = useState<Array<string | number>>([]);
  const [detailLoadingIds, setDetailLoadingIds] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setLoading(true);
    getAdminTaskNodeExecutions(detail.task.id)
      .then((payload) => setExecutions(payload.executions))
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : t('tasks.loadNodesFailed'));
      })
      .finally(() => setLoading(false));
  }, [detail.task.id, message, t]);

  const timelineSummary = buildConcurrentTimeline(executions);
  const timelineRows = timelineSummary.timeline;

  const loadExecutionDetail = async (execution: AdminTaskNodeExecution) => {
    if (executionDetails[execution.id] || detailLoadingIds[execution.id]) {
      return;
    }
    setDetailLoadingIds((current) => ({ ...current, [execution.id]: true }));
    try {
      const payload = await getAdminTaskNodeExecutionDetail(detail.task.id, execution.id);
      setExecutionDetails((current) => ({ ...current, [execution.id]: payload.execution }));
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : t('tasks.loadNodeDetailFailed'));
    } finally {
      setDetailLoadingIds((current) => {
        const next = { ...current };
        delete next[execution.id];
        return next;
      });
    }
  };

  const columns: ColumnsType<TimelineNodeExecution> = [
    { title: t('tasks.columnNodeId'), dataIndex: 'nodeId', width: 180 },
    { title: t('tasks.columnNodeType'), dataIndex: 'nodeType', width: 120 },
    {
      title: t('tasks.columnStatus'),
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = getTaskStatusMeta(value, locale);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: t('tasks.columnLane'),
      dataIndex: 'lane',
      width: 100,
      render: (value: number) => <Tag bordered={false}>{t('tasks.laneLabel', { lane: value + 1 })}</Tag>,
    },
    {
      title: t('tasks.columnTimeline'),
      key: 'timeline',
      width: 320,
      render: (_, record) => (
        <div className={styles.timelineCell}>
          <div className={styles.timelineTrack}>
            <div
              className={styles.timelineBar}
              style={{
                left: `${record.offsetPercent}%`,
                width: `${record.widthPercent}%`,
              }}
            >
              <span className={styles.timelineBarLabel}>{record.nodeType}</span>
            </div>
          </div>
          <Text className={styles.timelineHint}>
            {formatDateTime(record.startedAt)} - {formatDateTime(record.completedAt)}
          </Text>
        </div>
      ),
    },
    {
      title: t('tasks.columnDuration'),
      dataIndex: 'executionTime',
      width: 120,
      render: (value?: number | null) => (value == null ? '-' : formatDuration(value)),
    },
    { title: t('tasks.columnStartedAt'), dataIndex: 'startedAt', width: 180, render: formatDateTime },
    { title: t('tasks.columnCompletedAt'), dataIndex: 'completedAt', width: 180, render: formatDateTime },
    {
      title: t('tasks.columnErrorMessage'),
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (value?: string | null) => value || '-',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.metricPeakConcurrency')} value={timelineSummary.peakConcurrency} suffix={t('tasks.suffixNodes')} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.metricLaneCount')} value={timelineSummary.laneCount} suffix={t('tasks.suffixLanes')} />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic
            title={t('tasks.metricWallClock')}
            value={timelineSummary.totalDuration ? formatDuration(timelineSummary.totalDuration) : '-'}
          />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title={t('tasks.metricScheduleMode')} value={timelineSummary.peakConcurrency > 1 ? t('tasks.scheduleConcurrent') : t('tasks.scheduleSingle')} />
        </Card>
      </div>

      <Card
        bordered={false}
        className={styles.card}
        title={t('tasks.timelineTitle')}
        extra={<Text className={styles.muted}>{t('tasks.timelineHint')}</Text>}
      >
        {timelineRows.length === 0 ? (
          <Empty description={t('tasks.nodesEmpty')} />
        ) : (
          <>
            <div className={styles.timelineMiniMapSection}>
              <div className={styles.timelineMiniMapHeader}>
                <div>
                  <Text strong>{t('tasks.minimapTitle')}</Text>
                  <div className={styles.muted}>{t('tasks.minimapDescription')}</div>
                </div>
                <Tag bordered={false}>{t('tasks.nodesCount', { count: timelineRows.length })}</Tag>
              </div>
              <div className={styles.timelineMiniMap}>
                {timelineRows.map((record) => (
                  <div key={`admin-overview-${record.id}`} className={styles.timelineMiniMapRow}>
                    <div className={styles.timelineMiniMapTrack}>
                      <div
                        className={`${styles.timelineMiniMapBar} ${getTimelineBarClassName(record.status)}`}
                        style={{
                          left: `${record.offsetPercent}%`,
                          width: `${record.widthPercent}%`,
                        }}
                        title={`${record.nodeId} · ${record.nodeType} · ${formatDuration(record.timelineEnd - record.timelineStart)}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.timelineBoard}>
              {timelineRows.map((record) => (
                <div key={record.id} className={styles.timelineBoardRow}>
                  <div className={styles.timelineBoardMeta}>
                    <Text strong>{record.nodeId}</Text>
                    <Tag bordered={false}>{record.status}</Tag>
                  </div>
                  <div className={styles.timelineTrack}>
                    <div
                      className={`${styles.timelineBar} ${getTimelineBarClassName(record.status)}`}
                      style={{
                        left: `${record.offsetPercent}%`,
                        width: `${record.widthPercent}%`,
                      }}
                    >
                      <span className={styles.timelineBarLabel}>{record.nodeType}</span>
                    </div>
                  </div>
                  <div className={styles.timelineBoardTime}>{formatDuration(record.timelineEnd - record.timelineStart)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card bordered={false} className={styles.card} title={t('tasks.nodeDetailsTitle')}>
        <Table<TimelineNodeExecution>
          rowKey="id"
          loading={loading}
          dataSource={timelineRows}
          columns={columns}
          scroll={{ x: 1420 }}
          expandable={{
            expandedRowKeys,
            onExpand: (expanded, record) => {
              setExpandedRowKeys((current) =>
                expanded ? [...current, record.id] : current.filter((key) => key !== record.id),
              );
              if (expanded) {
                void loadExecutionDetail(record);
              }
            },
            expandedRowRender: (record) => {
              const detailedRecord = executionDetails[record.id] || record;
              const isLoadingDetail = !!detailLoadingIds[record.id];
              return (
              <div className={styles.analysisGrid}>
                <Card size="small" title={t('tasks.inputData')}>
                  {isLoadingDetail && !detailedRecord.inputData ? (
                    <Spin />
                  ) : (
                    <CodeViewer value={detailedRecord.inputData?.Data ?? detailedRecord.inputData ?? null} maxHeight={320} />
                  )}
                </Card>
                <Card size="small" title={t('tasks.outputData')}>
                  {isLoadingDetail && !detailedRecord.outputData ? (
                    <Spin />
                  ) : (
                    <CodeViewer value={detailedRecord.outputData?.Data ?? detailedRecord.outputData ?? null} maxHeight={320} />
                  )}
                </Card>
              </div>
            );
            },
          }}
          pagination={false}
        />
      </Card>
    </div>
  );
}

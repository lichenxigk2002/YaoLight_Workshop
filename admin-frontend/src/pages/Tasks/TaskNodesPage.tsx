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
  const { locale } = useI18n();
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
        message.error(error instanceof Error ? error.message : '加载节点执行失败');
      })
      .finally(() => setLoading(false));
  }, [detail.task.id, message]);

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
      message.error(error instanceof Error ? error.message : '加载节点执行详情失败');
    } finally {
      setDetailLoadingIds((current) => {
        const next = { ...current };
        delete next[execution.id];
        return next;
      });
    }
  };

  const columns: ColumnsType<TimelineNodeExecution> = [
    { title: '节点 ID', dataIndex: 'nodeId', width: 180 },
    { title: '类型', dataIndex: 'nodeType', width: 120 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: string) => {
        const meta = getTaskStatusMeta(value, locale);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '并发泳道',
      dataIndex: 'lane',
      width: 100,
      render: (value: number) => <Tag bordered={false}>Lane {value + 1}</Tag>,
    },
    {
      title: '时间带',
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
      title: '耗时',
      dataIndex: 'executionTime',
      width: 120,
      render: (value?: number | null) => (value == null ? '-' : formatDuration(value)),
    },
    { title: '开始时间', dataIndex: 'startedAt', width: 180, render: formatDateTime },
    { title: '完成时间', dataIndex: 'completedAt', width: 180, render: formatDateTime },
    {
      title: '错误信息',
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (value?: string | null) => value || '-',
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.metrics}>
        <Card bordered={false} className={styles.card}>
          <Statistic title="峰值并发" value={timelineSummary.peakConcurrency} suffix="节点" />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="时间泳道" value={timelineSummary.laneCount} suffix="条" />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic
            title="墙钟耗时"
            value={timelineSummary.totalDuration ? formatDuration(timelineSummary.totalDuration) : '-'}
          />
        </Card>
        <Card bordered={false} className={styles.card}>
          <Statistic title="调度模式" value={timelineSummary.peakConcurrency > 1 ? '并发执行' : '单通道'} />
        </Card>
      </div>

      <Card
        bordered={false}
        className={styles.card}
        title="并发执行时间线"
        extra={<Text className={styles.muted}>条形重叠越明显，说明并发越充分</Text>}
      >
        {timelineRows.length === 0 ? (
          <Empty description="当前任务暂无节点执行记录" />
        ) : (
          <>
            <div className={styles.timelineMiniMapSection}>
              <div className={styles.timelineMiniMapHeader}>
                <div>
                  <Text strong>全量缩略总览</Text>
                  <div className={styles.muted}>纵轴仍然是节点，横轴仍然是时间，只保留更细的执行条带用于整体观察。</div>
                </div>
                <Tag bordered={false}>{timelineRows.length} 节点</Tag>
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

      <Card bordered={false} className={styles.card} title="节点执行明细">
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
                <Card size="small" title="输入数据">
                  {isLoadingDetail && !detailedRecord.inputData ? (
                    <Spin />
                  ) : (
                    <CodeViewer value={detailedRecord.inputData?.Data ?? detailedRecord.inputData ?? null} maxHeight={320} />
                  )}
                </Card>
                <Card size="small" title="输出数据">
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

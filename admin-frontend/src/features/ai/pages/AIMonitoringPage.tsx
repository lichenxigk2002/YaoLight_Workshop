import { Alert, Button, Card, Empty, Space, Spin, Switch, Table, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import PageHero from '@/components/PageHero';
import { aiAdminApi } from '../api';
import styles from '../AIWorkspace.module.scss';
import type { AIMonitoringItem, AIMonitoringSnapshot, AIProbeStatus } from '../types';

const { Text } = Typography;

function getProbeStatusMeta(status: AIProbeStatus) {
  switch (status) {
    case 'healthy':
      return { color: 'success', label: 'Healthy' };
    case 'failed':
      return { color: 'error', label: 'Failed' };
    case 'not_configured':
      return { color: 'warning', label: 'Not Configured' };
    default:
      return { color: 'default', label: 'Unknown' };
  }
}

function formatDateTime(value?: string) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : 'Not checked';
}

export default function AIMonitoringPage() {
  const [snapshot, setSnapshot] = useState<AIMonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkAllLoading, setCheckAllLoading] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [checkingModelId, setCheckingModelId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    aiAdminApi.getMonitoringSnapshot()
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
      })
      .catch((error) => {
        if (!active) return;
        message.error(error instanceof Error ? error.message : 'Failed to load monitoring snapshot.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const sortedItems = useMemo(() => {
    if (!snapshot) return [];
    return [...snapshot.items].sort((left, right) => {
      const probePriority: Record<AIProbeStatus, number> = {
        failed: 0,
        not_configured: 1,
        unknown: 2,
        healthy: 3,
      };
      const statusDiff = probePriority[left.probeStatus] - probePriority[right.probeStatus];
      if (statusDiff !== 0) return statusDiff;
      return `${left.provider}/${left.modelName}`.localeCompare(`${right.provider}/${right.modelName}`);
    });
  }, [snapshot]);

  async function refreshSnapshot() {
    const next = await aiAdminApi.getMonitoringSnapshot();
    setSnapshot(next);
  }

  async function handleToggle(value: boolean) {
    if (!snapshot) return;
    setToggling(true);
    try {
      const settings = await aiAdminApi.updateMonitoringSettings(value);
      setSnapshot({
        ...snapshot,
        settings,
      });
      message.success(value ? 'Automatic monitoring enabled.' : 'Automatic monitoring disabled.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to update monitoring settings.');
    } finally {
      setToggling(false);
    }
  }

  async function handleCheckAll() {
    setCheckAllLoading(true);
    try {
      const next = await aiAdminApi.runMonitoringCheckAll();
      setSnapshot(next);
      message.success('Full monitoring check completed.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to run full monitoring check.');
      await refreshSnapshot();
    } finally {
      setCheckAllLoading(false);
    }
  }

  async function handleCheckModel(id: number) {
    if (!snapshot) return;
    setCheckingModelId(id);
    try {
      const item = await aiAdminApi.runMonitoringCheckModel(id);
      setSnapshot({
        ...snapshot,
        items: snapshot.items.map((current) => current.managedModelId === id ? item : current),
      });
      message.success('Model check completed.');
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'Failed to check model.');
      await refreshSnapshot();
    } finally {
      setCheckingModelId(null);
    }
  }

  if (loading) return <Spin size="large" />;
  if (!snapshot) {
    return (
      <Card className={styles.card}>
        <Empty description="Monitoring snapshot not available" />
      </Card>
    );
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow="MONITORING"
        title="AI model monitoring"
        description="Run low-cost probes against the platform model catalog so operations can see which system models are reachable, which ones are misconfigured, and when they were last healthy."
        tags={[
          `${snapshot.summary.totalModels} models`,
          `${snapshot.summary.healthyModels} healthy`,
          `${snapshot.summary.failedModels} failed`,
        ]}
        action={
          <Space wrap>
            <Space>
              <Text>Automatic monitoring</Text>
              <Switch
                checked={snapshot.settings.autoEnabled}
                loading={toggling}
                onChange={handleToggle}
              />
            </Space>
            <Button
              type="primary"
              loading={checkAllLoading}
              onClick={handleCheckAll}
            >
              Check all models
            </Button>
          </Space>
        }
      />

      {snapshot.isChecking ? (
        <Alert
          type="info"
          showIcon
          message="Monitoring is running"
          description="Another monitoring run is in progress. The table will reflect the latest saved results after that run finishes."
        />
      ) : null}

      {!snapshot.settings.autoEnabled ? (
        <Alert
          type="warning"
          showIcon
          message="Automatic monitoring is off"
          description="The system will not probe models in the background until you enable automatic monitoring."
        />
      ) : (
        <Alert
          type="success"
          showIcon
          message="Automatic monitoring is on"
          description={`Background checks run roughly every ${snapshot.settings.probeIntervalMinutes} minutes when the switch stays enabled.`}
        />
      )}

      <div className={styles.stats}>
        <Card className={styles.metricCard}>
          <div className={styles.metricLabel}>Healthy</div>
          <div className={styles.metricValue}>{snapshot.summary.healthyModels}</div>
        </Card>
        <Card className={styles.metricCard}>
          <div className={styles.metricLabel}>Failed</div>
          <div className={styles.metricValue}>{snapshot.summary.failedModels}</div>
        </Card>
        <Card className={styles.metricCard}>
          <div className={styles.metricLabel}>Not configured</div>
          <div className={styles.metricValue}>{snapshot.summary.notConfiguredModels}</div>
        </Card>
        <Card className={styles.metricCard}>
          <div className={styles.metricLabel}>Unknown</div>
          <div className={styles.metricValue}>{snapshot.summary.unknownModels}</div>
        </Card>
      </div>

      <Card className={styles.card} title="Probe results">
        <Table
          rowKey="managedModelId"
          dataSource={sortedItems}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Model',
              render: (_value, record: AIMonitoringItem) => (
                <div>
                  <div>{record.displayName}</div>
                  <div className={styles.muted}>{record.provider} / {record.modelName}</div>
                </div>
              ),
            },
            {
              title: 'Catalog',
              render: (_value, record: AIMonitoringItem) => (
                <Space wrap>
                  <Tag color={record.isActive ? 'blue' : 'default'}>{record.isActive ? 'Active' : 'Inactive'}</Tag>
                  <Tag>{record.status}</Tag>
                </Space>
              ),
            },
            {
              title: 'Probe',
              render: (_value, record: AIMonitoringItem) => {
                const meta = getProbeStatusMeta(record.probeStatus);
                return <Tag color={meta.color}>{meta.label}</Tag>;
              },
            },
            {
              title: 'Last checked',
              render: (_value, record: AIMonitoringItem) => formatDateTime(record.lastCheckedAt),
            },
            {
              title: 'Last success',
              render: (_value, record: AIMonitoringItem) => formatDateTime(record.lastSuccessAt),
            },
            {
              title: 'Latency',
              render: (_value, record: AIMonitoringItem) => record.lastLatencyMs ? `${record.lastLatencyMs} ms` : '-',
            },
            {
              title: 'Last error',
              render: (_value, record: AIMonitoringItem) => (
                <div className={styles.tableSummary}>
                  <span>{record.lastError || '-'}</span>
                  {record.lastResponsePreview ? (
                    <span className={styles.muted}>Response: {record.lastResponsePreview}</span>
                  ) : null}
                </div>
              ),
            },
            {
              title: 'Action',
              render: (_value, record: AIMonitoringItem) => (
                <Button
                  size="small"
                  loading={checkingModelId === record.managedModelId}
                  onClick={() => handleCheckModel(record.managedModelId)}
                >
                  Check once
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

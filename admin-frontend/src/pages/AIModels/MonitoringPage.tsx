import { AppstoreOutlined, ReloadOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, Segmented, Space, Spin, Statistic, Switch, Table, Typography, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import PageHero from '@/components/PageHero';
import ProviderIcon from '@/components/Icons/ProviderIcon';
import {
  getAIMonitoringSnapshot,
  runAIMonitoringCheckAll,
  runAIModelMonitoringCheck,
  updateAIMonitoringSettings,
} from '@/api/aiModels';
import { formatDateTime as formatLocalizedDateTime } from '@/i18n/runtime';
import { useI18n } from '@/i18n';
import type { AIMonitoringRecord, AIMonitoringSnapshot, AIProbeStatus } from '@/types/aiModels';
import { getAIProviderLabel } from './i18n';
import styles from './AIModels.module.scss';

const { Paragraph, Text, Title } = Typography;

const probePriority: Record<AIProbeStatus, number> = {
  failed: 0,
  not_configured: 1,
  unsupported: 2,
  unknown: 3,
  healthy: 4,
};

function getProbeTag(status: AIProbeStatus) {
  switch (status) {
    case 'healthy':
      return { tone: 'success', labelKey: 'aiModels.monitoringProbeHealthy' };
    case 'failed':
      return { tone: 'danger', labelKey: 'aiModels.monitoringProbeFailed' };
    case 'not_configured':
      return { tone: 'warning', labelKey: 'aiModels.monitoringProbeNotConfigured' };
    case 'unsupported':
      return { tone: 'neutral', labelKey: 'aiModels.monitoringProbeUnsupported' };
    default:
      return { tone: 'neutral', labelKey: 'aiModels.monitoringProbeUnknown' };
  }
}

function formatLatency(value?: number | null) {
  if (value == null || value <= 0) {
    return null;
  }
  return `${value} ms`;
}

function getModelLabels(record: AIMonitoringRecord) {
  const primary = record.display_name?.trim() || record.model_name;
  const secondary = record.model_name?.trim() || '';
  if (!secondary || secondary === primary) {
    return { primary, secondary: null };
  }
  return { primary, secondary };
}

export default function MonitoringPage() {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState<AIMonitoringSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkAllLoading, setCheckAllLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshot() {
      try {
        const data = await getAIMonitoringSnapshot();
        if (!cancelled) {
          setSnapshot(data);
        }
      } catch (error) {
        if (!cancelled) {
          message.error(error instanceof Error ? error.message : t('aiModels.monitoringLoadFailed'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    return [...snapshot.items].sort((left, right) => {
      const byStatus = probePriority[left.probe_status] - probePriority[right.probe_status];
      if (byStatus !== 0) {
        return byStatus;
      }
      return `${left.provider}/${left.model_name}`.localeCompare(`${right.provider}/${right.model_name}`);
    });
  }, [snapshot]);

  async function refreshSnapshot() {
    const data = await getAIMonitoringSnapshot();
    setSnapshot(data);
  }

  async function handleToggle(nextValue: boolean) {
    if (!snapshot) {
      return;
    }

    setToggleLoading(true);
    try {
      const settings = await updateAIMonitoringSettings(nextValue);
      setSnapshot({
        ...snapshot,
        settings,
      });
      message.success(t(nextValue ? 'aiModels.monitoringToggleEnabled' : 'aiModels.monitoringToggleDisabled'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('aiModels.monitoringToggleFailed'));
    } finally {
      setToggleLoading(false);
    }
  }

  async function handleCheckAll() {
    setCheckAllLoading(true);
    try {
      const data = await runAIMonitoringCheckAll();
      setSnapshot(data);
      message.success(t('aiModels.monitoringCheckAllSuccess'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('aiModels.monitoringCheckAllFailed'));
      await refreshSnapshot();
    } finally {
      setCheckAllLoading(false);
    }
  }

  async function handleCheckOne(record: AIMonitoringRecord) {
    setCheckingId(record.managed_model_id);
    try {
      const item = await runAIModelMonitoringCheck(record.managed_model_id);
      setSnapshot((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          items: current.items.map((existing) =>
            existing.managed_model_id === record.managed_model_id ? item : existing,
          ),
        };
      });
      message.success(t('aiModels.monitoringCheckOneSuccess'));
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('aiModels.monitoringCheckOneFailed'));
      await refreshSnapshot();
    } finally {
      setCheckingId(null);
    }
  }

  function formatDateTime(value?: string | null) {
    return formatLocalizedDateTime(value, undefined, t('aiModels.monitoringNotChecked'));
  }

  function renderProbeStatus(status: AIProbeStatus) {
    const meta = getProbeTag(status);
    return (
      <span className={styles.monitoringStatus}>
        <span className={`${styles.monitoringStatusDot} ${styles[`monitoringStatusDot${meta.tone[0].toUpperCase()}${meta.tone.slice(1)}`]}`} />
        <span>{t(meta.labelKey)}</span>
      </span>
    );
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Spin size="large" />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className={styles.page}>
        <Card bordered={false} className={styles.card}>
          <Empty description={t('aiModels.monitoringEmpty')} />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={t('aiModels.monitoringEyebrow')}
        title={t('aiModels.monitoringTitle')}
        description={t('aiModels.monitoringDescription')}
        tags={[
          t('aiModels.monitoringTagModels', { value: snapshot.summary.total_models }),
          t('aiModels.monitoringTagHealthy', { value: snapshot.summary.healthy_models }),
          t('aiModels.monitoringTagFailed', { value: snapshot.summary.failed_models }),
          t('aiModels.monitoringTagUnsupported', { value: snapshot.summary.unsupported_models }),
        ]}
        action={(
          <Space wrap className={styles.monitoringActionBar}>
            <Space className={styles.monitoringToggleWrap}>
              <Text strong>{t('aiModels.monitoringToggleLabel')}</Text>
              <Switch
                checked={snapshot.settings.auto_enabled}
                loading={toggleLoading}
                onChange={handleToggle}
              />
            </Space>
            <Button type="primary" loading={checkAllLoading} onClick={handleCheckAll}>
              {t('aiModels.monitoringCheckAll')}
            </Button>
          </Space>
        )}
      />

      {snapshot.is_checking ? (
        <Alert
          className={styles.monitoringAlert}
          type="info"
          showIcon
          message={t('aiModels.monitoringRunningTitle')}
          description={t('aiModels.monitoringRunningDescription')}
        />
      ) : null}

      {snapshot.settings.auto_enabled ? (
        <Alert
          className={styles.monitoringAlert}
          type="success"
          showIcon
          message={t('aiModels.monitoringAutoOnTitle')}
          description={t('aiModels.monitoringAutoOnDescription', { value: snapshot.settings.probe_interval_minutes })}
        />
      ) : (
        <Alert
          className={styles.monitoringAlert}
          type="warning"
          showIcon
          message={t('aiModels.monitoringAutoOffTitle')}
          description={t('aiModels.monitoringAutoOffDescription')}
        />
      )}

      <div className={styles.metrics}>
        <Card bordered={false} className={`${styles.card} ${styles.monitoringMetricCard}`}>
          <Statistic title={t('aiModels.monitoringMetricHealthy')} value={snapshot.summary.healthy_models} />
        </Card>
        <Card bordered={false} className={`${styles.card} ${styles.monitoringMetricCard}`}>
          <Statistic title={t('aiModels.monitoringMetricFailed')} value={snapshot.summary.failed_models} />
        </Card>
        <Card bordered={false} className={`${styles.card} ${styles.monitoringMetricCard}`}>
          <Statistic title={t('aiModels.monitoringMetricNotConfigured')} value={snapshot.summary.not_configured_models} />
        </Card>
        <Card bordered={false} className={`${styles.card} ${styles.monitoringMetricCard}`}>
          <Statistic title={t('aiModels.monitoringMetricUnsupported')} value={snapshot.summary.unsupported_models} />
        </Card>
        <Card bordered={false} className={`${styles.card} ${styles.monitoringMetricCard}`}>
          <Statistic title={t('aiModels.monitoringMetricUnknown')} value={snapshot.summary.unknown_models} />
        </Card>
      </div>

      <Card bordered={false} className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <Title level={4} className={styles.sectionTitle}>
              {t('aiModels.monitoringResultsTitle')}
            </Title>
            <Paragraph className={styles.muted}>
              {t('aiModels.monitoringResultsDescription')}
            </Paragraph>
          </div>
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as 'table' | 'cards')}
            options={[
              {
                value: 'cards',
                icon: <AppstoreOutlined />,
                label: t('aiModels.monitoringViewCards'),
              },
              {
                value: 'table',
                icon: <UnorderedListOutlined />,
                label: t('aiModels.monitoringViewTable'),
              },
            ]}
          />
        </div>

        {viewMode === 'cards' ? (
          <div className={styles.monitoringCardGrid}>
            {records.map((record) => (
              <Card key={record.managed_model_id} bordered={false} className={`${styles.card} ${styles.monitoringMiniCard}`}>
                <div className={styles.monitoringMiniCardHeader}>
                  <div className={styles.providerCell}>
                    <ProviderIcon provider={record.provider} size={20} />
                    <div className={styles.providerCellText}>
                      <div>{getModelLabels(record).primary}</div>
                      {getModelLabels(record).secondary ? (
                        <div className={styles.providerKey}>{getModelLabels(record).secondary}</div>
                      ) : null}
                    </div>
                  </div>
                  <Button
                    size="small"
                    type="text"
                    icon={<ReloadOutlined />}
                    loading={checkingId === record.managed_model_id}
                    onClick={() => void handleCheckOne(record)}
                    aria-label={t('aiModels.monitoringCheckOne')}
                  />
                </div>
                <div className={styles.monitoringMiniCardFooter}>
                  {renderProbeStatus(record.probe_status)}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Table
            className={styles.monitoringTable}
            rowKey="managed_model_id"
            dataSource={records}
            scroll={{ x: 1200 }}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            tableLayout="fixed"
            columns={[
              {
                title: t('aiModels.monitoringColumnProvider'),
                dataIndex: 'provider',
                width: 220,
                render: (provider: string) => (
                  <div className={styles.providerCell}>
                    <ProviderIcon provider={provider} size={18} />
                    <div className={styles.providerCellText}>
                      <div>{getAIProviderLabel(provider, t)}</div>
                      <div className={styles.providerKey}>{provider}</div>
                    </div>
                  </div>
                ),
              },
              {
                title: t('aiModels.monitoringColumnModel'),
                width: 260,
                render: (_value: unknown, record: AIMonitoringRecord) => (
                  <div>
                    <div>{getModelLabels(record).primary}</div>
                    {getModelLabels(record).secondary ? (
                      <div className={styles.providerKey}>{getModelLabels(record).secondary}</div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: t('aiModels.monitoringColumnCatalog'),
                width: 170,
                render: (_value: unknown, record: AIMonitoringRecord) => (
                  <Space wrap size={8}>
                    <span className={`${styles.monitoringBadge} ${record.is_active ? styles.monitoringBadgeActive : styles.monitoringBadgeMuted}`}>
                      {record.is_active ? t('aiModels.monitoringCatalogEnabled') : t('aiModels.monitoringCatalogDisabled')}
                    </span>
                    <span className={`${styles.monitoringBadge} ${styles.monitoringBadgeMuted}`}>
                      {t(`aiModels.modelStatus.${record.status}`)}
                    </span>
                  </Space>
                ),
              },
              {
                title: t('aiModels.monitoringColumnProbe'),
                dataIndex: 'probe_status',
                width: 150,
                render: (status: AIProbeStatus) => renderProbeStatus(status),
              },
              {
                title: t('aiModels.monitoringColumnLastChecked'),
                dataIndex: 'last_checked_at',
                width: 170,
                render: (value?: string | null) => formatDateTime(value),
              },
              {
                title: t('aiModels.monitoringColumnLastSuccess'),
                dataIndex: 'last_success_at',
                width: 170,
                render: (value?: string | null) => formatDateTime(value),
              },
              {
                title: t('aiModels.monitoringColumnLatency'),
                dataIndex: 'last_latency_ms',
                width: 110,
                render: (value?: number | null) => formatLatency(value) ?? t('common.none'),
              },
              {
                title: t('aiModels.monitoringColumnFailures'),
                dataIndex: 'consecutive_failures',
                width: 100,
              },
              {
                title: t('aiModels.monitoringColumnLastError'),
                width: 320,
                render: (_value: unknown, record: AIMonitoringRecord) => (
                  <div className={styles.monitoringErrorBlock}>
                    <div>{record.last_error || t('common.none')}</div>
                    {record.last_response_preview ? (
                      <div className={styles.providerKey}>{t('aiModels.monitoringPreview', { value: record.last_response_preview })}</div>
                    ) : null}
                  </div>
                ),
              },
              {
                title: t('aiModels.monitoringColumnAction'),
                key: 'action',
                width: 120,
                render: (_value: unknown, record: AIMonitoringRecord) => (
                  <Button
                    size="small"
                    loading={checkingId === record.managed_model_id}
                    onClick={() => void handleCheckOne(record)}
                  >
                    {t('aiModels.monitoringCheckOne')}
                  </Button>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

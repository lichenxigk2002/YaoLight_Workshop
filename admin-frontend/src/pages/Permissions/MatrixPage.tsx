import {
  AppstoreOutlined,
  ArrowRightOutlined,
  EditOutlined,
  EyeOutlined,
  ReloadOutlined,
  SafetyOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button, Card, Table, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getRbacPermissions } from '@/features/rbac/api';
import type { PermissionOption } from '@/features/rbac/types';
import { usePermissionLabels } from '@/features/rbac/usePermissionLabels';
import { useI18n } from '@/i18n';
import styles from './MatrixPage.module.scss';

const { Paragraph, Text } = Typography;

interface MatrixRow {
  moduleKey: string;
  moduleLabel: string;
  resourceKey: string;
  viewId: number | null;
  editId: number | null;
  description: string | null;
}

interface ModuleSummary {
  moduleKey: string;
  moduleLabel: string;
  resourceCount: number;
  viewCount: number;
  editCount: number;
  permissionCount: number;
  resourcePreview: string[];
}

const PERMISSION_MODULE_LABEL_KEY_MAP: Record<string, string> = {
  dashboard: 'menu.dashboard',
  users: 'menu.users',
  permissions: 'menu.permissions',
  workflow_templates: 'menu.workflowTemplates',
  node_types: 'menu.nodeTypes',
  knowledge_base: 'menu.knowledgeBase',
  crawler_rules: 'menu.crawlerRules',
  app_logs: 'menu.appLogs',
  tasks: 'menu.tasks',
  billing: 'menu.billing',
  ai_models: 'menu.aiModels',
  system_configs: 'menu.systemConfigs',
  notifications: 'menu.notifications',
  operation_logs: 'menu.operationLogs',
};

function formatResourceKey(resourceKey: string) {
  return resourceKey.replace(/\./g, ' / ').replace(/_/g, ' ');
}

export default function MatrixPage() {
  const { t } = useI18n();
  const { getResourceLabel } = usePermissionLabels();
  const [messageApi, contextHolder] = message.useMessage();
  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [loading, setLoading] = useState(true);

  const permissionModules = permissions.reduce<
    Record<
      string,
      {
        moduleLabel: string;
        resources: Record<string, { resourceLabel: string; items: PermissionOption[] }>;
      }
    >
  >((acc, item) => {
    const [moduleKey, ...rest] = item.resource_key.split('.');
    const moduleLabel = PERMISSION_MODULE_LABEL_KEY_MAP[moduleKey]
      ? t(PERMISSION_MODULE_LABEL_KEY_MAP[moduleKey] as 'menu.dashboard')
      : formatResourceKey(moduleKey);
    const resourceKey = rest.length > 0 ? `${moduleKey}.${rest[0]}` : moduleKey;
    const resourceLabel = formatResourceKey(resourceKey);

    if (!acc[moduleKey]) {
      acc[moduleKey] = { moduleLabel, resources: {} };
    }

    if (!acc[moduleKey].resources[resourceKey]) {
      acc[moduleKey].resources[resourceKey] = { resourceLabel, items: [] };
    }

    acc[moduleKey].resources[resourceKey].items.push(item);
    return acc;
  }, {});

  const orderedPermissionModules = Object.entries(permissionModules)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([moduleKey, module]) => ({
      moduleKey,
      moduleLabel: module.moduleLabel,
      resources: Object.entries(module.resources)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([resourceKey, resource]) => {
          const viewItem = resource.items.find((permission) => permission.action === 'view');
          const editItem = resource.items.find((permission) => permission.action === 'edit');
          const description = (viewItem?.description || editItem?.description || null) ?? null;

          return {
            resourceKey,
            resourceLabel: resource.resourceLabel,
            viewId: viewItem?.id ?? null,
            editId: editItem?.id ?? null,
            description,
          };
        }),
    }));

  const matrixRows: MatrixRow[] = orderedPermissionModules.flatMap((module) =>
    module.resources.map((resource) => ({
      moduleKey: module.moduleKey,
      moduleLabel: module.moduleLabel,
      resourceKey: resource.resourceKey,
      viewId: resource.viewId,
      editId: resource.editId,
      description: resource.description,
    })),
  );

  const moduleSummaries: ModuleSummary[] = orderedPermissionModules.map((module) => ({
    moduleKey: module.moduleKey,
    moduleLabel: module.moduleLabel,
    resourceCount: module.resources.length,
    viewCount: module.resources.filter((resource) => resource.viewId !== null).length,
    editCount: module.resources.filter((resource) => resource.editId !== null).length,
    permissionCount: module.resources.reduce(
      (count, resource) => count + Number(resource.viewId !== null) + Number(resource.editId !== null),
      0,
    ),
    resourcePreview: module.resources.slice(0, 3).map((resource) => getResourceLabel(resource.resourceKey)),
  }));

  const totalViewCount = matrixRows.filter((row) => row.viewId !== null).length;
  const totalEditCount = matrixRows.filter((row) => row.editId !== null).length;
  const noneText = t('common.none');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const list = await getRbacPermissions();
        if (!cancelled) {
          setPermissions(list);
        }
      } catch (error) {
        if (!cancelled) {
          messageApi.error((error as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  async function refresh() {
    setLoading(true);
    try {
      const list = await getRbacPermissions();
      setPermissions(list);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const summaryCards = [
    {
      key: 'permissions',
      icon: <SafetyOutlined />,
      label: t('permissions.matrix.statTotal'),
      value: loading ? t('common.loading') : String(permissions.length),
      toneClassName: styles.statIconPrimary,
    },
    {
      key: 'modules',
      icon: <AppstoreOutlined />,
      label: t('permissions.matrix.tableModule'),
      value: loading ? t('common.loading') : String(orderedPermissionModules.length),
      toneClassName: styles.statIconCyan,
    },
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: t('permissions.matrix.actionView'),
      value: loading ? t('common.loading') : String(totalViewCount),
      toneClassName: styles.statIconGreen,
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: t('permissions.matrix.actionEdit'),
      value: loading ? t('common.loading') : String(totalEditCount),
      toneClassName: styles.statIconAmber,
    },
  ];

  function renderActionState(id: number | null, action: 'view' | 'edit') {
    if (id === null) {
      return <span className={styles.emptyState}>{noneText}</span>;
    }

    const isView = action === 'view';

    return (
      <span className={isView ? styles.actionChipView : styles.actionChipEdit}>
        {isView ? <EyeOutlined /> : <EditOutlined />}
        {isView ? t('permissions.matrix.actionView') : t('permissions.matrix.actionEdit')}
      </span>
    );
  }

  const columns: ColumnsType<MatrixRow> = [
    {
      title: t('permissions.matrix.tableModule'),
      dataIndex: 'moduleLabel',
      key: 'moduleKey',
      width: 184,
      render: (_, record) => (
        <div className={styles.moduleCell}>
          <span className={styles.moduleBadge}>{record.moduleLabel}</span>
        </div>
      ),
    },
    {
      title: t('permissions.matrix.tableResource'),
      dataIndex: 'resourceLabel',
      key: 'resourceKey',
      width: 280,
      render: (_, record) => (
        <div className={styles.resourceCell}>
          <div className={styles.resourceTitle}>{getResourceLabel(record.resourceKey)}</div>
          <div className={styles.resourceKey}>{record.resourceKey}</div>
        </div>
      ),
    },
    {
      title: t('permissions.matrix.actionView'),
      dataIndex: 'viewId',
      key: 'viewId',
      width: 132,
      align: 'center',
      render: (id: number | null) => renderActionState(id, 'view'),
    },
    {
      title: t('permissions.matrix.actionEdit'),
      dataIndex: 'editId',
      key: 'editId',
      width: 132,
      align: 'center',
      render: (id: number | null) => renderActionState(id, 'edit'),
    },
    {
      title: t('permissions.matrix.tableDescription'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (value: string | null) =>
        value ? <Text className={styles.descriptionText}>{value}</Text> : <span className={styles.emptyState}>{noneText}</span>,
    },
  ];

  return (
    <div className={styles.page}>
      {contextHolder}

      <Card className={styles.summaryCard} bordered={false}>
        <div className={styles.summaryTop}>
          <div className={styles.summaryTitleWrap}>
            <div className={styles.summaryIcon}>
              <TableOutlined />
            </div>
            <div className={styles.summaryCopy}>
              <div className={styles.summaryEyebrow}>{t('permissions.eyebrow')}</div>
              <Typography.Title level={4} className={styles.summaryTitle}>
                {t('permissions.matrix.pageTitle')}
              </Typography.Title>
              <Paragraph className={styles.summaryIntro}>{t('permissions.matrix.pageIntro')}</Paragraph>
            </div>
          </div>

          <div className={styles.summaryActions}>
            <Button icon={<ReloadOutlined />} onClick={() => void refresh()} loading={loading}>
              {t('permissions.roles.refresh')}
            </Button>
            <Link to="/permissions/roles">
              <Button type="primary" icon={<ArrowRightOutlined />}>
                {t('permissions.matrix.goToRoles')}
              </Button>
            </Link>
          </div>
        </div>

        <div className={styles.summaryMeta}>
          <span className={styles.summaryMetaItem}>
            <SafetyOutlined />
            <span>{t('permissions.matrix.statTotal')}</span>
            <strong>{loading ? t('common.loading') : permissions.length}</strong>
          </span>
          <span className={styles.summaryMetaItem}>
            <AppstoreOutlined />
            <span>{t('permissions.matrix.tableModule')}</span>
            <strong>{loading ? t('common.loading') : orderedPermissionModules.length}</strong>
          </span>
        </div>
      </Card>

      <section className={styles.statsGrid}>
        {summaryCards.map((card) => (
          <div key={card.key} className={styles.statCard}>
            <div className={`${styles.statIcon} ${card.toneClassName}`}>{card.icon}</div>
            <div className={styles.statValue}>{card.value}</div>
            <div className={styles.statLabel}>{card.label}</div>
          </div>
        ))}
      </section>

      <Card className={styles.shellCard} bordered={false} loading={loading}>
        <div className={styles.sectionHeader}>
          <div>
            <div className={styles.sectionEyebrow}>{t('permissions.matrix.tableModule')}</div>
            <Typography.Title level={5} className={styles.sectionTitle}>
              {t('permissions.matrix.pageTitle')}
            </Typography.Title>
            <Paragraph className={styles.sectionDescription}>
              {t('permissions.matrix.legendDescription')}
            </Paragraph>
          </div>
          <div className={styles.sectionCount}>
            {orderedPermissionModules.length} {t('permissions.matrix.modulesCount')}
          </div>
        </div>

        <div className={styles.moduleGrid}>
          {moduleSummaries.map((module) => (
            <div key={module.moduleKey} className={styles.moduleCard}>
              <div className={styles.moduleCardHead}>
                <span className={styles.moduleCardTitle}>{module.moduleLabel}</span>
                <span className={styles.moduleCardValue}>{module.permissionCount}</span>
              </div>
              <div className={styles.moduleStats}>
                <div className={styles.moduleStat}>
                  <strong>{module.resourceCount}</strong>
                  <span>{t('permissions.matrix.tableResource')}</span>
                </div>
                <div className={styles.moduleStat}>
                  <strong>{module.viewCount}</strong>
                  <span>{t('permissions.matrix.actionView')}</span>
                </div>
                <div className={styles.moduleStat}>
                  <strong>{module.editCount}</strong>
                  <span>{t('permissions.matrix.actionEdit')}</span>
                </div>
              </div>
              <div className={styles.modulePreview}>
                {module.resourcePreview.map((label) => (
                  <span key={`${module.moduleKey}-${label}`} className={styles.previewChip}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className={styles.main}>
        <Card
          className={styles.shellCard}
          bordered={false}
          title={
            <div className={styles.cardHeading}>
              <div className={styles.cardHeadingMain}>
                <span className={styles.cardHeadingIcon}>
                  <AppstoreOutlined />
                </span>
                <span>{t('permissions.matrix.fieldLabel')}</span>
              </div>
              <span className={styles.sectionCount}>
                {matrixRows.length} {t('permissions.matrix.resourcesCount')}
              </span>
            </div>
          }
          loading={loading}
        >
          <Table<MatrixRow>
            rowKey={(row) => `${row.moduleKey}-${row.resourceKey}`}
            columns={columns}
            dataSource={matrixRows}
            pagination={false}
            size="middle"
            scroll={{ x: 980 }}
          />
        </Card>
      </div>

      <section className={styles.legendCard}>
        <div className={styles.legendIcon}>
          <SafetyOutlined />
        </div>
        <div className={styles.legendContent}>
          <div className={styles.legendTitle}>{t('permissions.matrix.legendTitle')}</div>
          <Paragraph className={styles.legendText}>{t('permissions.matrix.legendDescription')}</Paragraph>
          <div className={styles.legendActions}>
            <span className={styles.actionChipView}>
              <EyeOutlined />
              {t('permissions.matrix.actionView')}
            </span>
            <span className={styles.actionChipEdit}>
              <EditOutlined />
              {t('permissions.matrix.actionEdit')}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

import { EyeOutlined } from '@ant-design/icons';
import { App, Avatar, Button, Card, DatePicker, Descriptions, Drawer, Input, Select, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import CodeViewer from '@/components/CodeViewer';
import PageHero from '@/components/PageHero';
import { getAdminOperationLogDetail, listAdminOperationLogs } from '@/api/operationLogs';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import type { AdminOperationLogDetail, AdminOperationLogListItem } from '@/types/operationLogs';
import styles from './OperationLogs.module.scss';

const { RangePicker } = DatePicker;
type SupportedLocale = 'zh-CN' | 'en-US';
type ResultFilterValue = 'success' | 'failed' | undefined;

const copyByLocale: Record<
  SupportedLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    heroTags: string[];
    searchPlaceholder: string;
    resourcePlaceholder: string;
    resultPlaceholder: string;
    datePlaceholder: [string, string];
    search: string;
    reset: string;
    success: string;
    failed: string;
    allTotal: string;
    detail: string;
    time: string;
    operator: string;
    action: string;
    resource: string;
    result: string;
    summary: string;
    operationTime: string;
    resourceType: string;
    resourceId: string;
    statusCode: string;
    ipAddress: string;
    userAgent: string;
    errorMessage: string;
    requestSnapshot: string;
    responseSnapshot: string;
    noError: string;
    unknownUser: string;
    completed: string;
  }
> = {
  'zh-CN': {
    eyebrow: '操作日志',
    title: '后台审计日志',
    description: '查看管理员写操作，快速定位谁在什么时间修改了什么资源，以及请求结果与响应快照。',
    heroTags: ['统一审计', '标签化展示', '请求快照', '排障'],
    searchPlaceholder: '搜索操作人、资源 ID、错误信息',
    resourcePlaceholder: '资源类型',
    resultPlaceholder: '结果',
    datePlaceholder: ['开始日期', '结束日期'],
    search: '查询',
    reset: '重置',
    success: '成功',
    failed: '失败',
    allTotal: '共 {{total}} 条',
    detail: '查看',
    time: '时间',
    operator: '操作人',
    action: '动作',
    resource: '资源',
    result: '结果',
    summary: '摘要',
    operationTime: '操作时间',
    resourceType: '资源类型',
    resourceId: '资源 ID',
    statusCode: '状态码',
    ipAddress: '来源 IP',
    userAgent: 'User-Agent',
    errorMessage: '错误信息',
    requestSnapshot: '请求快照',
    responseSnapshot: '响应快照',
    noError: '无错误信息',
    unknownUser: '未知管理员',
    completed: '请求已完成',
  },
  'en-US': {
    eyebrow: 'Operation Logs',
    title: 'Admin Audit Logs',
    description: 'Review admin write actions and quickly see who changed which resource, when it happened, and how the request finished.',
    heroTags: ['Audit trail', 'Localized tags', 'Request snapshot', 'Troubleshooting'],
    searchPlaceholder: 'Search operator, resource ID, or error message',
    resourcePlaceholder: 'Resource',
    resultPlaceholder: 'Result',
    datePlaceholder: ['Start date', 'End date'],
    search: 'Search',
    reset: 'Reset',
    success: 'Success',
    failed: 'Failed',
    allTotal: '{{total}} items',
    detail: 'View',
    time: 'Time',
    operator: 'Operator',
    action: 'Action',
    resource: 'Resource',
    result: 'Result',
    summary: 'Summary',
    operationTime: 'Operation time',
    resourceType: 'Resource type',
    resourceId: 'Resource ID',
    statusCode: 'Status code',
    ipAddress: 'IP address',
    userAgent: 'User-Agent',
    errorMessage: 'Error message',
    requestSnapshot: 'Request snapshot',
    responseSnapshot: 'Response snapshot',
    noError: 'No error message',
    unknownUser: 'Unknown admin',
    completed: 'Request completed',
  },
};

const actionMetaByLocale: Record<SupportedLocale, Record<string, { label: string; color: string }>> = {
  'zh-CN': {
    create: { label: '创建', color: 'green' },
    update: { label: '更新', color: 'blue' },
    delete: { label: '删除', color: 'red' },
    recover: { label: '补回', color: 'gold' },
    grant: { label: '赠送', color: 'cyan' },
    cancel: { label: '取消', color: 'orange' },
    retry: { label: '重试', color: 'purple' },
    sync: { label: '同步', color: 'geekblue' },
    clone: { label: '克隆', color: 'lime' },
    test: { label: '测试', color: 'magenta' },
    send: { label: '发送', color: 'volcano' },
    update_status: { label: '改状态', color: 'blue' },
    patch_status: { label: '改状态', color: 'blue' },
    update_capability: { label: '改能力', color: 'blue' },
    update_pricing: { label: '改计费', color: 'blue' },
  },
  'en-US': {
    create: { label: 'Create', color: 'green' },
    update: { label: 'Update', color: 'blue' },
    delete: { label: 'Delete', color: 'red' },
    recover: { label: 'Recover', color: 'gold' },
    grant: { label: 'Grant', color: 'cyan' },
    cancel: { label: 'Cancel', color: 'orange' },
    retry: { label: 'Retry', color: 'purple' },
    sync: { label: 'Sync', color: 'geekblue' },
    clone: { label: 'Clone', color: 'lime' },
    test: { label: 'Test', color: 'magenta' },
    send: { label: 'Send', color: 'volcano' },
    update_status: { label: 'Set status', color: 'blue' },
    patch_status: { label: 'Set status', color: 'blue' },
    update_capability: { label: 'Update capability', color: 'blue' },
    update_pricing: { label: 'Update pricing', color: 'blue' },
  },
};

const resourceMetaByLocale: Record<SupportedLocale, Record<string, { label: string; color: string }>> = {
  'zh-CN': {
    users: { label: '用户', color: 'blue' },
    workflow_templates: { label: '工作流模板', color: 'purple' },
    crawler_rules: { label: '爬虫规则', color: 'cyan' },
    ai_models: { label: 'AI 模型', color: 'geekblue' },
    billing: { label: '计费运营', color: 'gold' },
    notifications: { label: '通知中心', color: 'magenta' },
    alkaid_knowledge: { label: '知识库', color: 'lime' },
    tasks: { label: '任务', color: 'orange' },
    operation_logs: { label: '操作日志', color: 'default' },
  },
  'en-US': {
    users: { label: 'Users', color: 'blue' },
    workflow_templates: { label: 'Workflow Templates', color: 'purple' },
    crawler_rules: { label: 'Crawler Rules', color: 'cyan' },
    ai_models: { label: 'AI Models', color: 'geekblue' },
    billing: { label: 'Billing', color: 'gold' },
    notifications: { label: 'Notifications', color: 'magenta' },
    alkaid_knowledge: { label: 'Knowledge Base', color: 'lime' },
    tasks: { label: 'Tasks', color: 'orange' },
    operation_logs: { label: 'Operation Logs', color: 'default' },
  },
};

function titleize(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((item) => item.charAt(0).toUpperCase() + item.slice(1))
    .join(' ');
}

function getActionMeta(action: string, locale: SupportedLocale) {
  return actionMetaByLocale[locale][action] ?? { label: titleize(action), color: 'default' };
}

function getResourceMeta(resourceType: string, locale: SupportedLocale) {
  return resourceMetaByLocale[locale][resourceType] ?? { label: titleize(resourceType), color: 'default' };
}

function getResultMeta(
  record: Pick<AdminOperationLogListItem, 'status_code' | 'error_message'>,
  copy: (typeof copyByLocale)[SupportedLocale],
) {
  const failed = (record.status_code ?? 200) >= 400 || Boolean(record.error_message);
  return failed ? { color: 'red', label: copy.failed } : { color: 'green', label: copy.success };
}

function renderOperator(record: Pick<AdminOperationLogListItem, 'avatar_url' | 'real_name' | 'username' | 'email' | 'user_id'>, fallback: string) {
  const primary = record.real_name || record.username || (record.user_id ? `#${record.user_id}` : fallback);
  return (
    <div className={styles.operator}>
      <Avatar size={38} src={record.avatar_url ?? undefined} className={styles.operatorAvatar}>
        {primary.slice(0, 1).toUpperCase()}
      </Avatar>
      <div className={styles.operatorMeta}>
        <span className={styles.operatorName}>{primary}</span>
        <span className={styles.operatorSub}>{record.email || (record.username && record.real_name ? record.username : '') || fallback}</span>
      </div>
    </div>
  );
}

export default function OperationLogsPage() {
  const { message } = App.useApp();
  const { locale, t } = useI18n();
  const currentLocale = locale as SupportedLocale;
  const copy = copyByLocale[currentLocale];

  const [rows, setRows] = useState<AdminOperationLogListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [resourceType, setResourceType] = useState<string | undefined>();
  const [result, setResult] = useState<ResultFilterValue>();
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminOperationLogDetail | null>(null);

  const resourceOptions = useMemo(
    () =>
      Object.entries(resourceMetaByLocale[currentLocale]).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
    [currentLocale],
  );

  useEffect(() => {
    setLoading(true);
    listAdminOperationLogs({
      keyword: keyword || undefined,
      resource_type: resourceType,
      result,
      created_from: dateRange?.[0]?.startOf('day').toISOString(),
      created_to: dateRange?.[1]?.endOf('day').toISOString(),
      page,
      page_size: pageSize,
    })
      .then((payload) => {
        setRows(payload.list);
        setTotal(payload.total);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : copy.failed);
      })
      .finally(() => setLoading(false));
  }, [copy.failed, dateRange, keyword, message, page, pageSize, resourceType, result]);

  const openDetail = (id: number) => {
    setActiveLogId(id);
    setDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);
    getAdminOperationLogDetail(id)
      .then((payload) => {
        setDetail(payload);
      })
      .catch((error: unknown) => {
        message.error(error instanceof Error ? error.message : copy.failed);
      })
      .finally(() => setDetailLoading(false));
  };

  const columns: ColumnsType<AdminOperationLogListItem> = [
    {
      title: copy.time,
      dataIndex: 'created_at',
      width: 170,
      render: (value: string) => formatDateTime(value, currentLocale, t('common.none')),
    },
    {
      title: copy.operator,
      width: 240,
      render: (_, record) => renderOperator(record, copy.unknownUser),
    },
    {
      title: copy.action,
      dataIndex: 'action',
      width: 120,
      render: (value: string) => {
        const meta = getActionMeta(value, currentLocale);
        return (
          <Tag color={meta.color} bordered={false} className={styles.semanticTag}>
            {meta.label}
          </Tag>
        );
      },
    },
    {
      title: copy.resource,
      width: 170,
      render: (_, record) => {
        const meta = getResourceMeta(record.resource_type, currentLocale);
        return (
          <div className={styles.resourceCell}>
            <Tooltip title={`${copy.resourceId}: ${record.resource_id ?? t('common.none')}`}>
              <Tag color={meta.color} bordered={false} className={styles.semanticTag}>
                {meta.label}
              </Tag>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: copy.result,
      width: 130,
      render: (_, record) => {
        const meta = getResultMeta(record, copy);
        return (
          <div className={styles.resultCell}>
            <Tooltip title={`${copy.statusCode}: ${record.status_code ?? 200}`}>
              <Tag color={meta.color} bordered={false} className={styles.semanticTag}>
                {meta.label}
              </Tag>
            </Tooltip>
          </div>
        );
      },
    },
    {
      title: copy.summary,
      width: 260,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip
          title={
            <div className={styles.summaryTooltip}>
              <div>{record.error_message || copy.completed}</div>
              <div className={styles.summaryTooltipMeta}>
                {copy.ipAddress}: {record.ip_address || t('common.none')}
              </div>
            </div>
          }
        >
          <div className={styles.summaryCell}>
            <span className={styles.summaryMain}>{record.error_message || copy.completed}</span>
          </div>
        </Tooltip>
      ),
    },
    {
      title: copy.detail,
      dataIndex: 'id',
      width: 88,
      align: 'right',
      render: (value: number) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(value)}>
          {copy.detail}
        </Button>
      ),
    },
  ];

  const detailActionMeta = detail ? getActionMeta(detail.action, currentLocale) : null;
  const detailResourceMeta = detail ? getResourceMeta(detail.resource_type, currentLocale) : null;

  return (
    <div className={styles.page}>
      <PageHero eyebrow={copy.eyebrow} title={copy.title} description={copy.description} tags={copy.heroTags} />

      <Card bordered={false} className={styles.card}>
        <div className={styles.filterBar}>
          <Input
            placeholder={copy.searchPlaceholder}
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onPressEnter={() => {
              setPage(1);
              setKeyword(keywordInput.trim());
            }}
            className={styles.searchInput}
          />
          <Select
            allowClear
            placeholder={copy.resourcePlaceholder}
            value={resourceType}
            onChange={(value) => {
              setPage(1);
              setResourceType(value);
            }}
            className={styles.compactSelect}
            options={resourceOptions}
          />
          <Select
            allowClear
            placeholder={copy.resultPlaceholder}
            value={result}
            onChange={(value) => {
              setPage(1);
              setResult(value);
            }}
            className={styles.compactSelect}
            options={[
              { value: 'success', label: copy.success },
              { value: 'failed', label: copy.failed },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(value) => {
              setPage(1);
              setDateRange(value);
            }}
            placeholder={copy.datePlaceholder}
            className={styles.dateRange}
          />
          <Button
            type="primary"
            onClick={() => {
              setPage(1);
              setKeyword(keywordInput.trim());
            }}
          >
            {copy.search}
          </Button>
          <Button
            onClick={() => {
              setPage(1);
              setKeywordInput('');
              setKeyword('');
              setResourceType(undefined);
              setResult(undefined);
              setDateRange(null);
            }}
          >
            {copy.reset}
          </Button>
        </div>

        <div className={styles.tableWrap}>
          <Table<AdminOperationLogListItem>
            rowKey="id"
            className={styles.table}
            style={{ marginTop: 16 }}
            loading={loading}
            dataSource={rows}
            columns={columns}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showLessItems: true,
              showTotal: (value) => copy.allTotal.replace('{{total}}', String(value)),
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize || 20);
              },
            }}
          />
        </div>
      </Card>

      <Drawer
        title={activeLogId ? `${copy.title} #${activeLogId}` : copy.title}
        open={detailOpen}
        width={920}
        onClose={() => {
          setDetailOpen(false);
          setActiveLogId(null);
          setDetail(null);
        }}
        destroyOnClose
      >
        {detail ? (
          <div className={styles.drawerGrid}>
            <Descriptions bordered size="small" column={2} className={styles.detailDescriptions}>
              <Descriptions.Item label={copy.operationTime}>
                {formatDateTime(detail.created_at, currentLocale, t('common.none'))}
              </Descriptions.Item>
              <Descriptions.Item label={copy.result}>
                <Tag color={getResultMeta(detail, copy).color} bordered={false} className={styles.semanticTag}>
                  {getResultMeta(detail, copy).label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={copy.operator}>{renderOperator(detail, copy.unknownUser)}</Descriptions.Item>
              <Descriptions.Item label={copy.resourceType}>
                {detailResourceMeta ? (
                  <Tag color={detailResourceMeta.color} bordered={false} className={styles.semanticTag}>
                    {detailResourceMeta.label}
                  </Tag>
                ) : (
                  t('common.none')
                )}
              </Descriptions.Item>
              <Descriptions.Item label={copy.action}>
                {detailActionMeta ? (
                  <Tag color={detailActionMeta.color} bordered={false} className={styles.semanticTag}>
                    {detailActionMeta.label}
                  </Tag>
                ) : (
                  t('common.none')
                )}
              </Descriptions.Item>
              <Descriptions.Item label={copy.resourceId}>{detail.resource_id ?? t('common.none')}</Descriptions.Item>
              <Descriptions.Item label={copy.statusCode}>{detail.status_code ?? t('common.none')}</Descriptions.Item>
              <Descriptions.Item label={copy.ipAddress}>{detail.ip_address || t('common.none')}</Descriptions.Item>
              <Descriptions.Item label={copy.userAgent} span={2}>
                {detail.user_agent || t('common.none')}
              </Descriptions.Item>
              <Descriptions.Item label={copy.errorMessage} span={2}>
                {detail.error_message || copy.noError}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title={copy.requestSnapshot} loading={detailLoading} className={styles.snapshotCard}>
              <CodeViewer value={detail.request_data} maxHeight={320} emptyText={t('common.none')} />
            </Card>

            <Card size="small" title={copy.responseSnapshot} loading={detailLoading} className={styles.snapshotCard}>
              <CodeViewer value={detail.response_data} maxHeight={320} emptyText={t('common.none')} />
            </Card>
          </div>
        ) : (
          <Card loading={detailLoading} bordered={false} />
        )}
      </Drawer>
    </div>
  );
}

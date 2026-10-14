import { DeleteOutlined, EyeOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Card,
  DatePicker,
  Descriptions,
  Drawer,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import CodeViewer from '@/components/CodeViewer';
import PageHero from '@/components/PageHero';
import { clearAdminAppLogs, deleteAdminAppLog, getAdminAppLogDetail, listAdminAppLogs } from '@/api/appLogs';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import type { AdminAppLogDetail, AdminAppLogListItem } from '@/types/appLogs';
import styles from './AppLogs.module.scss';

const { RangePicker } = DatePicker;
const { Text } = Typography;
type SupportedLocale = 'zh-CN' | 'en-US';

const copyByLocale: Record<
  SupportedLocale,
  {
    eyebrow: string;
    title: string;
    description: string;
    heroTags: string[];
    searchPlaceholder: string;
    codePlaceholder: string;
    ownerLabel: string;
    ownerPlaceholder: string;
    filePlaceholder: string;
    levelPlaceholder: string;
    datePlaceholder: [string, string];
    search: string;
    reset: string;
    refresh: string;
    clearAll: string;
    clearAllConfirm: string;
    clearAllDescription: string;
    cancel: string;
    actions: string;
    detail: string;
    delete: string;
    deleteConfirm: string;
    total: string;
    level: string;
    code: string;
    message: string;
    file: string;
    time: string;
    context: string;
    detailTitle: string;
    baseInfo: string;
    noContext: string;
    cleared: string;
    deleted: string;
  }
> = {
  'zh-CN': {
    eyebrow: '应用日志',
    title: '控制台运行日志',
    description: '查看后端运行时日志输出，支持按编号、级别、关键词、文件路径和时间范围快速检索。',
    heroTags: ['编号检索', '运行时日志', '全量清空', '错误排查'],
    searchPlaceholder: '搜索消息内容或编号',
    codePlaceholder: '编号，例如 3009',
    ownerLabel: '命名前缀',
    ownerPlaceholder: '例如团队缩写或命名标识',
    filePlaceholder: '文件路径',
    levelPlaceholder: '级别',
    datePlaceholder: ['开始日期', '结束日期'],
    search: '查询',
    reset: '重置',
    refresh: '刷新',
    clearAll: '清空全部',
    clearAllConfirm: '确认清空全部应用日志？',
    clearAllDescription: '这会删除所有级别的日志，包括 info、warn 和 error。',
    cancel: '取消',
    actions: '操作',
    detail: '查看',
    delete: '删除',
    deleteConfirm: '删除这条日志后不可恢复，确认继续？',
    total: '共 {{total}} 条',
    level: '级别',
    code: '编号',
    message: '消息',
    file: '文件',
    time: '时间',
    context: '上下文',
    detailTitle: '日志详情',
    baseInfo: '基础信息',
    noContext: '无上下文',
    cleared: '已清空全部日志，共删除 {{count}} 条',
    deleted: '日志已删除',
  },
  'en-US': {
    eyebrow: 'App Logs',
    title: 'Runtime Console Logs',
    description: 'Browse backend runtime logs and quickly filter by code, level, keyword, file path, and time range.',
    heroTags: ['Code lookup', 'Runtime logs', 'Full clear', 'Troubleshooting'],
    searchPlaceholder: 'Search message content or code',
    codePlaceholder: 'Code, e.g. 3009',
    ownerLabel: 'Prefix',
    ownerPlaceholder: 'e.g. team prefix or naming namespace',
    filePlaceholder: 'File path',
    levelPlaceholder: 'Level',
    datePlaceholder: ['Start date', 'End date'],
    search: 'Search',
    reset: 'Reset',
    refresh: 'Refresh',
    clearAll: 'Clear all',
    clearAllConfirm: 'Clear all application logs?',
    clearAllDescription: 'This removes every log level including info, warn, and error.',
    cancel: 'Cancel',
    actions: 'Actions',
    detail: 'View',
    delete: 'Delete',
    deleteConfirm: 'Delete this log permanently?',
    total: '{{total}} items',
    level: 'Level',
    code: 'Code',
    message: 'Message',
    file: 'File',
    time: 'Time',
    context: 'Context',
    detailTitle: 'Log detail',
    baseInfo: 'Base info',
    noContext: 'No context',
    cleared: 'Cleared all logs, deleted {{count}} entries',
    deleted: 'Log deleted',
  },
};

function levelTag(level: string) {
  const normalized = level.toLowerCase();
  if (normalized === 'error') return 'red';
  if (normalized === 'warn') return 'gold';
  return 'blue';
}

export default function AppLogsPage() {
  const { message } = App.useApp();
  const { locale } = useI18n();
  const currentLocale = locale as SupportedLocale;
  const copy = copyByLocale[currentLocale];

  const [rows, setRows] = useState<AdminAppLogListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [code, setCode] = useState<number | undefined>();
  const [ownerInput, setOwnerInput] = useState('LCX');
  const [owner, setOwner] = useState('LCX');
  const [level, setLevel] = useState<string | undefined>();
  const [filePathInput, setFilePathInput] = useState('');
  const [filePath, setFilePath] = useState('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeLogId, setActiveLogId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AdminAppLogDetail | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    listAdminAppLogs({
      keyword: keyword || undefined,
      level,
      owner: owner || undefined,
      code,
      file_path: filePath || undefined,
      created_from: dateRange?.[0]?.startOf('day').toISOString(),
      created_to: dateRange?.[1]?.endOf('day').toISOString(),
      page,
      page_size: pageSize,
    })
      .then((result) => {
        setRows(Array.isArray(result.list) ? result.list : []);
        setTotal(result.total ?? 0);
      })
      .catch((error) => {
        message.error(error instanceof Error ? error.message : '加载日志失败');
      })
      .finally(() => setLoading(false));
  }, [code, dateRange, filePath, level, message, owner, page, pageSize, keyword]);

  const columns = useMemo<ColumnsType<AdminAppLogListItem>>(
    () => [
      {
        title: copy.time,
        dataIndex: 'logged_at',
        width: 180,
        render: (value: string) => formatDateTime(value, currentLocale),
      },
      {
        title: copy.level,
        dataIndex: 'level',
        width: 110,
        render: (value: string) => (
          <Tag className={styles.semanticTag} color={levelTag(value)}>
            {value.toUpperCase()}
          </Tag>
        ),
      },
      {
        title: copy.code,
        width: 128,
        render: (_, record) => <span className={styles.codeText}>{`${record.owner}-${record.code}`}</span>,
      },
      {
        title: copy.message,
        dataIndex: 'message',
        render: (value: string) => (
          <Tooltip title={value}>
            <span className={styles.messageText}>{value}</span>
          </Tooltip>
        ),
      },
      {
        title: copy.file,
        dataIndex: 'file_path',
        width: 260,
        render: (value?: string | null) => <span className={styles.pathText}>{value || '-'}</span>,
      },
      {
        title: copy.actions,
        width: 128,
        fixed: 'right',
        render: (_, record) => (
          <Space size={4}>
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => {
                setActiveLogId(record.id);
                setDetailOpen(true);
                setDetailLoading(true);
                getAdminAppLogDetail(record.id)
                  .then((result) => setDetail(result))
                  .catch((error) => {
                    message.error(error instanceof Error ? error.message : '加载日志详情失败');
                    setDetailOpen(false);
                  })
                  .finally(() => setDetailLoading(false));
              }}
            >
              {copy.detail}
            </Button>
            <Popconfirm
              title={copy.deleteConfirm}
              okText={copy.delete}
              cancelText={copy.cancel}
              onConfirm={() => {
                setDeletingId(record.id);
                deleteAdminAppLog(record.id)
                  .then(() => {
                    message.success(copy.deleted);
                    if (activeLogId === record.id) {
                      setDetailOpen(false);
                      setDetail(null);
                    }
                    if (rows.length === 1 && page > 1) {
                      setPage((current) => current - 1);
                    } else {
                      setRows((current) => current.filter((item) => item.id !== record.id));
                      setTotal((current) => Math.max(0, current - 1));
                    }
                  })
                  .catch((error) => {
                    message.error(error instanceof Error ? error.message : '删除日志失败');
                  })
                  .finally(() => setDeletingId(null));
              }}
            >
              <Button danger type="text" loading={deletingId === record.id}>
                {copy.delete}
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [activeLogId, copy, currentLocale, deletingId, message, page, rows.length],
  );

  return (
    <div className={styles.page}>
      <PageHero
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
        tags={copy.heroTags}
      />

      <Card className={styles.card} bordered={false}>
        <div className={styles.filterBar}>
          <Input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            placeholder={copy.searchPlaceholder}
            allowClear
            className={styles.searchInput}
            onPressEnter={() => {
              setPage(1);
              setKeyword(keywordInput.trim());
            }}
          />
          <Input
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            placeholder={copy.codePlaceholder}
            allowClear
            className={styles.compactInput}
          />
          <Input
            value={ownerInput}
            onChange={(event) => setOwnerInput(event.target.value)}
            addonBefore={copy.ownerLabel}
            placeholder={copy.ownerPlaceholder}
            allowClear
            className={styles.compactInput}
          />
          <Input
            value={filePathInput}
            onChange={(event) => setFilePathInput(event.target.value)}
            placeholder={copy.filePlaceholder}
            allowClear
            className={styles.compactInput}
          />
          <Select
            allowClear
            value={level}
            placeholder={copy.levelPlaceholder}
            options={[
              { value: 'info', label: 'INFO' },
              { value: 'warn', label: 'WARN' },
              { value: 'error', label: 'ERROR' },
            ]}
            onChange={(value) => {
              setLevel(value);
              setPage(1);
            }}
            className={styles.compactSelect}
          />
          <RangePicker
            value={dateRange}
            onChange={(value) => {
              setDateRange((value as [Dayjs | null, Dayjs | null] | null) ?? null);
              setPage(1);
            }}
            className={styles.dateRange}
            placeholder={copy.datePlaceholder}
          />
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={() => {
              const parsedCode = Number.parseInt(codeInput.trim(), 10);
              setPage(1);
              setKeyword(keywordInput.trim());
              setOwner(ownerInput.trim());
              setFilePath(filePathInput.trim());
              setCode(Number.isFinite(parsedCode) ? parsedCode : undefined);
            }}
          >
            {copy.search}
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              setKeywordInput('');
              setKeyword('');
              setCodeInput('');
              setCode(undefined);
              setOwnerInput('LCX');
              setOwner('LCX');
              setFilePathInput('');
              setFilePath('');
              setLevel(undefined);
              setDateRange(null);
              setPage(1);
            }}
          >
            {copy.reset}
          </Button>
          <Popconfirm
            title={copy.clearAllConfirm}
            description={copy.clearAllDescription}
            okText={copy.clearAll}
            cancelText={copy.cancel}
            onConfirm={() => {
              setClearing(true);
              clearAdminAppLogs()
                .then((result) => {
                  setRows([]);
                  setTotal(0);
                  setDetail(null);
                  setDetailOpen(false);
                  setActiveLogId(null);
                  setPage(1);
                  message.success(copy.cleared.replace('{{count}}', String(result.deleted)));
                })
                .catch((error) => {
                  message.error(error instanceof Error ? error.message : '清空日志失败');
                })
                .finally(() => setClearing(false));
            }}
          >
            <Button danger icon={<DeleteOutlined />} loading={clearing}>
              {copy.clearAll}
            </Button>
          </Popconfirm>
        </div>
      </Card>

      <Card
        className={styles.card}
        bordered={false}
        title={copy.title}
        extra={<Text type="secondary">{copy.total.replace('{{total}}', String(total))}</Text>}
      >
        <div className={styles.tableWrap}>
          <Table
            rowKey="id"
            className={styles.table}
            loading={loading}
            columns={columns}
            dataSource={rows}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (count) => copy.total.replace('{{total}}', String(count)),
              onChange: (nextPage, nextPageSize) => {
                setPage(nextPage);
                setPageSize(nextPageSize);
              },
            }}
          />
        </div>
      </Card>

      <Drawer
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={copy.detailTitle}
        width={720}
        destroyOnClose
      >
        {detail && !detailLoading ? (
          <div className={styles.drawerGrid}>
            <Descriptions bordered column={1} size="small" className={styles.detailDescriptions} title={copy.baseInfo}>
              <Descriptions.Item label={copy.time}>{formatDateTime(detail.logged_at, currentLocale)}</Descriptions.Item>
              <Descriptions.Item label={copy.level}>
                <Tag className={styles.semanticTag} color={levelTag(detail.level)}>
                  {detail.level.toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label={copy.code}>
                <span className={styles.codeText}>{`${detail.owner}-${detail.code}`}</span>
              </Descriptions.Item>
              <Descriptions.Item label={copy.file}>
                <span className={styles.pathText}>{detail.file_path || '-'}</span>
              </Descriptions.Item>
              <Descriptions.Item label={copy.message}>{detail.message}</Descriptions.Item>
            </Descriptions>
            <Card className={styles.snapshotCard} title={copy.context}>
              {detail.context ? <CodeViewer value={detail.context} language="json" /> : <Text type="secondary">{copy.noContext}</Text>}
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

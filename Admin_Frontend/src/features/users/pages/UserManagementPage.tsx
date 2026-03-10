import { EyeOutlined, LockOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Avatar,
  Button,
  Card,
  Col,
  DatePicker,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tooltip,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { useI18n } from '@/i18n';
import {
  getAdminUserDetail,
  getAdminUsers,
  getAdminUserSummary,
  resetAdminUserPassword,
  updateAdminUserStatus,
} from '../api';
import UserDetailDrawer from '../components/UserDetailDrawer';
import UserStatusTag from '../components/UserStatusTag';
import type {
  AdminUserDetail,
  AdminUserListItem,
  AdminUserListQuery,
  AdminUserRole,
  AdminUserStatus,
  AdminUserSummary,
} from '../types';
import styles from '../Users.module.scss';

const { RangePicker } = DatePicker;
const { Paragraph, Text } = Typography;

export default function UserManagementPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useI18n();
  const [summary, setSummary] = useState<AdminUserSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState<Required<Pick<AdminUserListQuery, 'page' | 'page_size'>> & AdminUserListQuery>({
    page: 1,
    page_size: 10,
  });
  const [keywordInput, setKeywordInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdminUserStatus | undefined>();
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | undefined>();
  const [createdRange, setCreatedRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailUser, setDetailUser] = useState<AdminUserDetail | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminUserListItem | AdminUserDetail | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  function formatDateTime(value?: string | null) {
    return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : t('common.empty');
  }

  function roleLabel(role: AdminUserRole) {
    return role === 'admin' ? t('users.roleAdmin') : t('users.roleUser');
  }

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);

    getAdminUserSummary()
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setSummaryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  useEffect(() => {
    let cancelled = false;
    setListLoading(true);

    getAdminUsers(query)
      .then((data) => {
        if (!cancelled) {
          setUsers(data.list);
          setTotal(data.total);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          messageApi.error(error.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [messageApi, query]);

  async function reloadSummary() {
    setSummaryLoading(true);
    try {
      const data = await getAdminUserSummary();
      setSummary(data);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }

  function reloadList() {
    setQuery((current) => ({ ...current }));
  }

  async function loadUserDetail(userId: number) {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const detail = await getAdminUserDetail(userId);
      setDetailUser(detail);
    } catch (error) {
      messageApi.error((error as Error).message);
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleStatusChange(userId: number, status: AdminUserStatus) {
    setStatusUpdatingId(userId);
    try {
      await updateAdminUserStatus(userId, status);
      messageApi.success(t('users.statusUpdated'));
      setUsers((current) => current.map((item) => (item.id === userId ? { ...item, status } : item)));
      if (detailUser?.id === userId) {
        setDetailUser((current) => (current ? { ...current, status } : current));
        await loadUserDetail(userId);
      }
      await reloadSummary();
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function applyFilters() {
    setQuery((current) => ({
      ...current,
      page: 1,
      keyword: keywordInput.trim() || undefined,
      status: statusFilter,
      role: roleFilter,
      created_from: createdRange?.[0]?.format('YYYY-MM-DD'),
      created_to: createdRange?.[1]?.format('YYYY-MM-DD'),
    }));
  }

  function resetFilters() {
    setKeywordInput('');
    setStatusFilter(undefined);
    setRoleFilter(undefined);
    setCreatedRange(null);
    setQuery((current) => ({
      ...current,
      page: 1,
      keyword: undefined,
      status: undefined,
      role: undefined,
      created_from: undefined,
      created_to: undefined,
    }));
  }

  function openResetPasswordModal(user: AdminUserListItem | AdminUserDetail) {
    setPasswordTarget(user);
    setNewPassword('');
    setPasswordModalOpen(true);
  }

  async function submitResetPassword() {
    if (!passwordTarget) return;
    if (newPassword.trim().length < 6) {
      messageApi.error(t('users.modalPasswordTooShort'));
      return;
    }

    setPasswordSubmitting(true);
    try {
      await resetAdminUserPassword(passwordTarget.id, newPassword.trim());
      messageApi.success(t('users.modalPasswordReset'));
      setPasswordModalOpen(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  const columns: ColumnsType<AdminUserListItem> = [
    {
      title: t('users.tableUser'),
      dataIndex: 'username',
      key: 'username',
      width: 260,
      render: (_, record) => (
        <div className={styles.userCell}>
          <Avatar src={record.avatar_url ?? undefined}>{record.username.slice(0, 1).toUpperCase()}</Avatar>
          <div className={styles.userMeta}>
            <Space size={8}>
              <Text strong>{record.username}</Text>
              <Text type="secondary">#{record.user_no}</Text>
            </Space>
            <Text type="secondary">{record.email}</Text>
          </div>
        </div>
      ),
    },
    {
      title: t('users.tableRole'),
      dataIndex: 'role',
      key: 'role',
      width: 100,
      render: (value: AdminUserRole) => <span>{roleLabel(value)}</span>,
    },
    {
      title: t('users.tableStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: AdminUserStatus) => <UserStatusTag status={value} />,
    },
    {
      title: t('users.tableStardust'),
      dataIndex: 'token_balance',
      key: 'token_balance',
      width: 140,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: t('users.tableLogin'),
      key: 'login',
      width: 180,
      render: (_, record) => (
        <div className={styles.loginMeta}>
          <Text>{t('users.loginTimes', { count: record.login_count })}</Text>
          <Text type="secondary">{formatDateTime(record.last_login_at)}</Text>
        </div>
      ),
    },
    {
      title: t('users.tableCreated'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t('users.tableActions'),
      key: 'actions',
      fixed: 'right',
      width: 280,
      render: (_, record) => (
        <div className={styles.actions}>
          <Button icon={<EyeOutlined />} onClick={() => void loadUserDetail(record.id)}>
            {t('users.actionDetail')}
          </Button>
          <Tooltip title={record.role === 'admin' ? t('users.adminLocked') : ''}>
            <Select<AdminUserStatus>
              value={record.status}
              style={{ width: 118 }}
              loading={statusUpdatingId === record.id}
              disabled={record.role === 'admin'}
              onChange={(value) => void handleStatusChange(record.id, value)}
              options={[
                { label: t('users.statusActive'), value: 'active' },
                { label: t('users.statusInactive'), value: 'inactive' },
                { label: t('users.statusSuspended'), value: 'suspended' },
              ]}
            />
          </Tooltip>
          <Button icon={<LockOutlined />} onClick={() => openResetPasswordModal(record)}>
            {t('users.actionResetPassword')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      {contextHolder}

      <PageHero
        eyebrow={t('users.pageEyebrow')}
        title={t('users.pageTitle')}
        description={t('users.pageDescription')}
        tags={[t('users.tagList'), t('users.tagStatus'), t('users.tagPassword'), t('users.tagDetail')]}
        action={
          <Button icon={<ReloadOutlined />} onClick={() => { void reloadSummary(); reloadList(); }}>
            {t('users.actionRefresh')}
          </Button>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card className={styles.metricCard}>
            <Statistic title={t('users.metricTotalUsers')} value={summary?.total ?? 0} loading={summaryLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className={styles.metricCard}>
            <Statistic title={t('users.metricActiveUsers')} value={summary?.active ?? 0} loading={summaryLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className={styles.metricCard}>
            <Statistic title={t('users.metricAdmins')} value={summary?.admins ?? 0} loading={summaryLoading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className={styles.metricCard}>
            <Statistic title={t('users.metricNewIn7Days')} value={summary?.new_last_7_days ?? 0} loading={summaryLoading} />
          </Card>
        </Col>
      </Row>

      <Card title={t('users.filtersTitle')} className={styles.panel}>
        <div className={styles.filters}>
          <Input allowClear placeholder={t('users.filterKeyword')} value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} onPressEnter={applyFilters} />
          <Select<AdminUserStatus>
            allowClear
            placeholder={t('users.filterStatus')}
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={[
              { label: t('users.statusActive'), value: 'active' },
              { label: t('users.statusInactive'), value: 'inactive' },
              { label: t('users.statusSuspended'), value: 'suspended' },
            ]}
          />
          <Select<AdminUserRole>
            allowClear
            placeholder={t('users.filterRole')}
            value={roleFilter}
            onChange={(value) => setRoleFilter(value)}
            options={[
              { label: t('users.roleAdmin'), value: 'admin' },
              { label: t('users.roleUser'), value: 'user' },
            ]}
          />
          <RangePicker
            value={createdRange}
            onChange={(values) => {
              if (values?.[0] && values?.[1]) {
                setCreatedRange([values[0], values[1]]);
                return;
              }
              setCreatedRange(null);
            }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={applyFilters}>
            {t('users.actionSearch')}
          </Button>
          <Button onClick={resetFilters}>{t('users.actionReset')}</Button>
        </div>
      </Card>

      <Card title={t('users.listTitle')} className={styles.panel} extra={<Paragraph className={styles.listHint}>{t('users.pageListTotal', { total })}</Paragraph>}>
        <Table<AdminUserListItem>
          rowKey="id"
          loading={listLoading}
          columns={columns}
          dataSource={users}
          scroll={{ x: 1200 }}
          pagination={{
            current: query.page,
            pageSize: query.page_size,
            total,
            showSizeChanger: true,
            onChange: (page, pageSize) => {
              setQuery((current) => ({
                ...current,
                page,
                page_size: pageSize,
              }));
            },
          }}
        />
      </Card>

      <UserDetailDrawer
        open={detailOpen}
        loading={detailLoading}
        user={detailUser}
        onClose={() => {
          setDetailOpen(false);
          setDetailUser(null);
        }}
        onResetPassword={openResetPasswordModal}
        onStatusChange={(userId, status) => void handleStatusChange(userId, status)}
        statusUpdating={statusUpdatingId === detailUser?.id}
      />

      <Modal
        title={t('users.modalTitle')}
        open={passwordModalOpen}
        confirmLoading={passwordSubmitting}
        onCancel={() => setPasswordModalOpen(false)}
        onOk={() => void submitResetPassword()}
        okText={t('users.actionConfirm')}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <Text type="secondary">
            {t('users.modalCurrentUser', { username: passwordTarget?.username ?? '--', userNo: passwordTarget?.user_no ?? '--' })}
          </Text>
          <Input.Password placeholder={t('users.modalPasswordPlaceholder')} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </Space>
      </Modal>
    </div>
  );
}

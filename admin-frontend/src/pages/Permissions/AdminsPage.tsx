import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import {
  createRbacAdmin,
  demoteRbacAdmin,
  getRbacAdmins,
  getRbacRoles,
  promoteRbacAdmin,
  resetRbacAdminPassword,
  updateRbacAdminRoles,
  updateRbacAdminStatus,
} from '@/features/rbac/api';
import PromotableUserSelect from '@/features/rbac/components/PromotableUserSelect';
import type {
  AdminAccountItem,
  AdminAccountStatus,
  CreateAdminPayload,
  PromoteAdminPayload,
} from '@/features/rbac/types';
import { usePermissionLabels } from '@/features/rbac/usePermissionLabels';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import { getAdminSession } from '@/utils/storage';

const { Paragraph, Text } = Typography;

interface AdminCreateFormValues {
  username: string;
  email: string;
  password: string;
  phone?: string;
  role_ids: number[];
}

interface PromoteAdminFormValues {
  user_id?: string;
  role_ids: number[];
}

interface AdminRoleFormValues {
  role_ids: number[];
}

interface PasswordFormValues {
  password: string;
}

function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-';
}

export default function AdminsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('permissions');
  const currentUserId = getAdminSession()?.user.id ?? 0;
  const { getResourceLabel } = usePermissionLabels();

  const [roles, setRoles] = useState<{ id: number; name: string; code: string }[]>([]);
  const [admins, setAdmins] = useState<AdminAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);
  const [roleAssignTarget, setRoleAssignTarget] = useState<AdminAccountItem | null>(null);
  const [roleAssignSubmitting, setRoleAssignSubmitting] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<AdminAccountItem | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);
  const [demotingId, setDemotingId] = useState<number | null>(null);

  const [adminForm] = Form.useForm<AdminCreateFormValues>();
  const [promoteForm] = Form.useForm<PromoteAdminFormValues>();
  const [adminRoleForm] = Form.useForm<AdminRoleFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();

  const roleOptions = roles.map((role) => ({ label: `${role.name} (${role.code})`, value: role.id }));
  const statusOptions: Array<{ label: string; value: AdminAccountStatus }> = [
    { label: t('users.statusActive'), value: 'active' },
    { label: t('users.statusInactive'), value: 'inactive' },
    { label: t('users.statusSuspended'), value: 'suspended' },
  ];

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [roleList, adminList] = await Promise.all([getRbacRoles(), getRbacAdmins()]);
        if (cancelled) {
          return;
        }
        setRoles(roleList);
        setAdmins(adminList);
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

  async function refreshAll(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [roleList, adminList] = await Promise.all([getRbacRoles(), getRbacAdmins()]);
      setRoles(roleList);
      setAdmins(adminList);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  function openCreateAdmin() {
    adminForm.resetFields();
    adminForm.setFieldsValue({ role_ids: [] });
    setAdminModalOpen(true);
  }

  function openPromoteAdmin() {
    promoteForm.resetFields();
    promoteForm.setFieldsValue({ role_ids: [] });
    setPromoteModalOpen(true);
  }

  async function submitCreateAdmin() {
    const values = await adminForm.validateFields();
    setAdminSubmitting(true);
    try {
      const payload: CreateAdminPayload = {
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password.trim(),
        phone: values.phone?.trim() || undefined,
        role_ids: values.role_ids,
      };
      await createRbacAdmin(payload);
      messageApi.success(t('permissions.admins.createSuccess'));
      setAdminModalOpen(false);
      adminForm.resetFields();
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setAdminSubmitting(false);
    }
  }

  async function submitPromoteAdmin() {
    const values = await promoteForm.validateFields();
    setPromoteSubmitting(true);
    try {
      const payload: PromoteAdminPayload = {
        user_id: Number(values.user_id),
        role_ids: values.role_ids,
      };
      await promoteRbacAdmin(payload);
      messageApi.success('用户已提升为管理员');
      setPromoteModalOpen(false);
      promoteForm.resetFields();
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setPromoteSubmitting(false);
    }
  }

  function openRoleAssign(admin: AdminAccountItem) {
    setRoleAssignTarget(admin);
    adminRoleForm.setFieldsValue({ role_ids: admin.roles.map((role) => role.id) });
  }

  async function submitAdminRoles() {
    if (!roleAssignTarget) {
      return;
    }
    const values = await adminRoleForm.validateFields();
    setRoleAssignSubmitting(true);
    try {
      await updateRbacAdminRoles(roleAssignTarget.id, values.role_ids);
      messageApi.success(t('permissions.admins.assignSuccess'));
      setRoleAssignTarget(null);
      adminRoleForm.resetFields();
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setRoleAssignSubmitting(false);
    }
  }

  async function handleStatusChange(admin: AdminAccountItem, status: AdminAccountStatus) {
    setStatusUpdatingId(admin.id);
    try {
      await updateRbacAdminStatus(admin.id, status);
      messageApi.success(t('permissions.admins.statusUpdated'));
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setStatusUpdatingId(null);
    }
  }

  function openPasswordModal(admin: AdminAccountItem) {
    setPasswordTarget(admin);
    passwordForm.resetFields();
  }

  async function submitResetPassword() {
    if (!passwordTarget) {
      return;
    }
    const values = await passwordForm.validateFields();
    setPasswordSubmitting(true);
    try {
      await resetRbacAdminPassword(passwordTarget.id, values.password.trim());
      messageApi.success(t('permissions.admins.resetPasswordSuccess'));
      setPasswordTarget(null);
      passwordForm.resetFields();
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  function confirmDemoteAdmin(admin: AdminAccountItem) {
    Modal.confirm({
      title: '确认将该管理员降权为普通用户？',
      content: `账号 ${admin.username} 降权后将失去后台访问能力，并移除当前角色绑定。`,
      okText: '确认降权',
      okButtonProps: { danger: true },
      cancelText: t('permissions.roles.cancel'),
      onOk: async () => {
        setDemotingId(admin.id);
        try {
          await demoteRbacAdmin(admin.id);
          messageApi.success('管理员已降权为普通用户');
          await refreshAll(false);
        } catch (error) {
          messageApi.error((error as Error).message);
        } finally {
          setDemotingId(null);
        }
      },
    });
  }

  const adminColumns: ColumnsType<AdminAccountItem> = [
    {
      title: t('permissions.admins.columnAdmin'),
      dataIndex: 'username',
      key: 'username',
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space size={8} wrap>
            <Text strong>{record.username}</Text>
            <Text type="secondary">#{record.user_no}</Text>
            {record.id === currentUserId ? <Tag color="geekblue">{t('permissions.admins.currentAccount')}</Tag> : null}
          </Space>
          <Text type="secondary">{record.email}</Text>
          {record.phone ? <Text type="secondary">{record.phone}</Text> : null}
        </Space>
      ),
    },
    {
      title: t('permissions.admins.columnRoles'),
      key: 'roles',
      width: 260,
      render: (_, record) => (
        <Space size={[6, 6]} wrap>
          {record.roles.map((role) => (
            <Tag key={role.id}>{role.name}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('permissions.admins.columnStatus'),
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (value: AdminAccountStatus, record) => (
        <Select<AdminAccountStatus>
          value={value}
          style={{ width: 120 }}
          options={statusOptions}
          loading={statusUpdatingId === record.id}
          disabled={!canEdit || record.id === currentUserId}
          onChange={(next) => void handleStatusChange(record, next)}
        />
      ),
    },
    {
      title: t('permissions.admins.columnPermissions'),
      key: 'permissions',
      render: (_, record) => (
        <Space size={[6, 6]} wrap>
          <Tag color="blue">
            {record.permissions.length} {t('permissions.roles.items')}
          </Tag>
          {record.permissions.slice(0, 4).map((permission) => {
            const [resourceKey, action] = permission.includes(':') ? permission.split(':') : [permission, 'view'];
            const actionLabel = action === 'edit' ? t('permissions.matrix.actionEdit') : t('permissions.matrix.actionView');
            return (
              <Tag key={permission}>
                {getResourceLabel(resourceKey)} / {actionLabel}
              </Tag>
            );
          })}
          {record.permissions.length > 4 ? <Tag>+{record.permissions.length - 4}</Tag> : null}
        </Space>
      ),
    },
    {
      title: t('permissions.admins.columnCreated'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: t('permissions.admins.columnActions'),
      key: 'actions',
      width: 360,
      render: (_, record) => (
        <Space wrap>
          <Button disabled={!canEdit || record.id === currentUserId} onClick={() => openRoleAssign(record)}>
            {t('permissions.admins.assignRoles')}
          </Button>
          <Button icon={<LockOutlined />} disabled={!canEdit} onClick={() => openPasswordModal(record)}>
            {t('permissions.admins.resetPassword')}
          </Button>
          <Button
            danger
            icon={<ArrowDownOutlined />}
            disabled={!canEdit || record.id === currentUserId || demotingId === record.id}
            loading={demotingId === record.id}
            onClick={() => confirmDemoteAdmin(record)}
          >
            降权为普通用户
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      {!canEdit ? <Alert type="info" showIcon message={t('permissions.admins.viewOnlyHint')} /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title={t('permissions.admins.statAdmins')} value={admins.length} prefix={<TeamOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic
              title={t('permissions.admins.statActive')}
              value={admins.filter((admin) => admin.status === 'active').length}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={t('permissions.admins.listTitle')}
        extra={
          <Space wrap>
            {canEdit ? (
              <Button icon={<ArrowUpOutlined />} onClick={openPromoteAdmin}>
                提权现有用户
              </Button>
            ) : null}
            {canEdit ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAdmin}>
                {t('permissions.admins.createAdmin')}
              </Button>
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              {t('permissions.admins.refresh')}
            </Button>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {t('permissions.admins.listDescription')}
        </Paragraph>
        <Table<AdminAccountItem>
          rowKey="id"
          loading={loading}
          columns={adminColumns}
          dataSource={admins}
          scroll={{ x: 1480 }}
          pagination={false}
        />
      </Card>

      <Modal
        title="提权现有用户为管理员"
        open={promoteModalOpen}
        onCancel={() => {
          setPromoteModalOpen(false);
          promoteForm.resetFields();
        }}
        onOk={() => void submitPromoteAdmin()}
        confirmLoading={promoteSubmitting}
        okButtonProps={{ disabled: !canEdit }}
        okText="确认提权"
      >
        <Form form={promoteForm} layout="vertical" initialValues={{ role_ids: [] }}>
          <Form.Item
            name="user_id"
            label="现有用户"
            rules={[{ required: true, message: '请选择要提权的用户' }]}
          >
            <PromotableUserSelect placeholder="搜索用户名 / 邮箱 / ID / 用户编号" />
          </Form.Item>
          <Form.Item
            name="role_ids"
            label={t('permissions.admins.columnRoles')}
            rules={[{ required: true, type: 'array', min: 1, message: t('permissions.admins.formRoleIdsRequired') }]}
          >
            <Select mode="multiple" placeholder={t('permissions.admins.formRoleIdsPlaceholder')} options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('permissions.admins.createTitle')}
        open={adminModalOpen}
        onCancel={() => {
          setAdminModalOpen(false);
          adminForm.resetFields();
        }}
        onOk={() => void submitCreateAdmin()}
        confirmLoading={adminSubmitting}
        okButtonProps={{ disabled: !canEdit }}
        okText={t('permissions.admins.confirmCreate')}
      >
        <Form form={adminForm} layout="vertical" initialValues={{ role_ids: [] }}>
          <Form.Item
            name="username"
            label={t('permissions.admins.formUsername')}
            rules={[{ required: true, message: t('permissions.admins.formUsernameRequired') }]}
          >
            <Input placeholder={t('permissions.admins.formUsernamePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="email"
            label={t('permissions.admins.formEmail')}
            rules={[
              { required: true, message: t('permissions.admins.formEmailRequired') },
              { type: 'email', message: t('permissions.admins.formEmailInvalid') },
            ]}
          >
            <Input placeholder={t('permissions.admins.formEmailPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="password"
            label={t('permissions.admins.formPassword')}
            rules={[
              { required: true, message: t('permissions.admins.formPasswordRequired') },
              { min: 6, message: t('permissions.admins.formPasswordMin') },
            ]}
          >
            <Input.Password placeholder={t('permissions.admins.formPasswordPlaceholder')} />
          </Form.Item>
          <Form.Item name="phone" label={t('permissions.admins.formPhone')}>
            <Input placeholder={t('permissions.admins.formPhonePlaceholder')} />
          </Form.Item>
          <Form.Item
            name="role_ids"
            label={t('permissions.admins.formRoleIds')}
            rules={[{ required: true, type: 'array', min: 1, message: t('permissions.admins.formRoleIdsRequired') }]}
          >
            <Select mode="multiple" placeholder={t('permissions.admins.formRoleIdsPlaceholder')} options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={roleAssignTarget ? `${t('permissions.admins.assignTitle')}: ${roleAssignTarget.username}` : t('permissions.admins.assignTitle')}
        open={Boolean(roleAssignTarget)}
        onCancel={() => {
          setRoleAssignTarget(null);
          adminRoleForm.resetFields();
        }}
        onOk={() => void submitAdminRoles()}
        confirmLoading={roleAssignSubmitting}
        okButtonProps={{ disabled: !canEdit }}
        okText={t('permissions.admins.save')}
      >
        <Form form={adminRoleForm} layout="vertical">
          <Form.Item
            name="role_ids"
            label={t('permissions.admins.columnRoles')}
            rules={[{ required: true, type: 'array', min: 1, message: t('permissions.admins.formRoleIdsRequired') }]}
          >
            <Select mode="multiple" placeholder={t('permissions.admins.formRoleIdsPlaceholder')} options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={passwordTarget ? `${t('permissions.admins.resetPasswordTitle')}: ${passwordTarget.username}` : t('permissions.admins.resetPasswordTitle')}
        open={Boolean(passwordTarget)}
        onCancel={() => {
          setPasswordTarget(null);
          passwordForm.resetFields();
        }}
        onOk={() => void submitResetPassword()}
        confirmLoading={passwordSubmitting}
        okButtonProps={{ disabled: !canEdit }}
        okText={t('permissions.admins.confirmReset')}
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="password"
            label={t('permissions.admins.formNewPassword')}
            rules={[
              { required: true, message: t('permissions.admins.formNewPasswordRequired') },
              { min: 6, message: t('permissions.admins.formPasswordMin') },
            ]}
          >
            <Input.Password placeholder={t('permissions.admins.formNewPasswordPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

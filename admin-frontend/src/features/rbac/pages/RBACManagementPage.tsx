import { EditOutlined, LockOutlined, PlusOutlined, ReloadOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import { getAdminSession } from '@/utils/storage';
import {
  createRbacAdmin,
  createRbacRole,
  getRbacAdmins,
  getRbacPermissions,
  getRbacRoles,
  resetRbacAdminPassword,
  updateRbacAdminRoles,
  updateRbacAdminStatus,
  updateRbacRole,
} from '../api';
import type {
  AdminAccountItem,
  AdminAccountStatus,
  CreateAdminPayload,
  CreateRolePayload,
  PermissionOption,
  RoleListItem,
  UpdateRolePayload,
} from '../types';

const { Paragraph, Text } = Typography;

interface RoleFormValues {
  code?: string;
  name: string;
  description?: string;
  permission_ids: number[];
}

interface AdminCreateFormValues {
  username: string;
  email: string;
  password: string;
  phone?: string;
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

function formatResourceKey(resourceKey: string) {
  return resourceKey.replace(/\./g, ' / ').replace(/_/g, ' ');
}

export default function RBACManagementPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('permissions');
  const currentUserId = getAdminSession()?.user.id ?? 0;

  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [admins, setAdmins] = useState<AdminAccountItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [selectedPermissionModuleKey, setSelectedPermissionModuleKey] = useState<string | null>(null);

  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  const [roleAssignTarget, setRoleAssignTarget] = useState<AdminAccountItem | null>(null);
  const [roleAssignSubmitting, setRoleAssignSubmitting] = useState(false);

  const [passwordTarget, setPasswordTarget] = useState<AdminAccountItem | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [statusUpdatingId, setStatusUpdatingId] = useState<number | null>(null);

  const [roleForm] = Form.useForm<RoleFormValues>();
  const [adminForm] = Form.useForm<AdminCreateFormValues>();
  const [adminRoleForm] = Form.useForm<AdminRoleFormValues>();
  const [passwordForm] = Form.useForm<PasswordFormValues>();

  const permissionModuleLabelKeyMap: Record<string, string> = {
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

  const permissionResourceLabelKeyMap: Record<string, string> = {
    dashboard: 'menu.dashboard',
    users: 'menu.users',
    permissions: 'menu.permissions',
    workflow_templates: 'menu.workflowTemplates',
    node_types: 'menu.nodeTypes',
    knowledge_base: 'menu.knowledgeBase',
    crawler_rules: 'menu.crawlerRules',
    app_logs: 'menu.appLogs',
    system_configs: 'menu.systemConfigs',
    operation_logs: 'menu.operationLogs',
    'ai_models.overview': 'menu.aiModelsOverview',
    'ai_models.providers': 'menu.aiModelsProviders',
    'ai_models.models': 'menu.aiModelsModels',
    'ai_models.pricing_rules': 'menu.aiModelsPricingRules',
    'ai_models.usage': 'menu.aiModelsUsage',
    'tasks.overview': 'menu.tasksOverview',
    'tasks.running': 'menu.tasksRunning',
    'tasks.failures': 'menu.tasksFailures',
    'billing.overview': 'menu.billingOverview',
    'billing.quota_recovery': 'menu.billingQuotaRecovery',
    'billing.admin_grant': 'menu.billingAdminGrant',
    'billing.packages': 'menu.billingPackages',
    'billing.orders': 'menu.billingOrders',
    'billing.ledger': 'menu.billingLedger',
    'billing.token_ledger': 'menu.billingTokenLedger',
    'notifications.send': 'menu.notificationsSend',
    'notifications.jobs': 'menu.notificationsJobs',
    'notifications.log': 'menu.notificationsLog',
    'notifications.analytics': 'menu.notificationsAnalytics',
    'notifications.templates': 'menu.notificationsTemplates',
  };

  function getResourceLabel(resourceKey: string): string {
    const i18nKey = permissionResourceLabelKeyMap[resourceKey];
    return i18nKey ? t(i18nKey as any) : formatResourceKey(resourceKey);
  }

  function getPermissionActionLabel(action: PermissionOption['action']) {
    return action === 'view' ? t('permissions.matrix.actionView') : t('permissions.matrix.actionEdit');
  }

  const permissionModules = permissions.reduce<
    Record<
      string,
      {
        moduleLabel: string;
        resources: Record<
          string,
          {
            resourceLabel: string;
            items: PermissionOption[];
          }
        >;
      }
    >
  >((accumulator, item) => {
    const [moduleKey, ...rest] = item.resource_key.split('.');
    const moduleLabel = permissionModuleLabelKeyMap[moduleKey]
      ? t(permissionModuleLabelKeyMap[moduleKey] as any)
      : formatResourceKey(moduleKey);
    const resourceKey = rest.length > 0 ? `${moduleKey}.${rest[0]}` : moduleKey;
    const resourceLabel = formatResourceKey(resourceKey);

    if (!accumulator[moduleKey]) {
      accumulator[moduleKey] = {
        moduleLabel,
        resources: {},
      };
    }

    if (!accumulator[moduleKey].resources[resourceKey]) {
      accumulator[moduleKey].resources[resourceKey] = {
        resourceLabel,
        items: [],
      };
    }

    accumulator[moduleKey].resources[resourceKey].items.push(item);
    return accumulator;
  }, {});

  const orderedPermissionModules = Object.entries(permissionModules)
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([moduleKey, module]) => ({
      moduleKey,
      moduleLabel: module.moduleLabel,
      resources: Object.entries(module.resources)
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([resourceKey, resource]) => ({
          resourceKey,
          resourceLabel: resource.resourceLabel,
          items: [...resource.items].sort((left, right) => left.action.localeCompare(right.action)),
        })),
    }));

  const roleOptions = roles.map((role) => ({
    label: `${role.name} (${role.code})`,
    value: role.id,
  }));

  const statusOptions: Array<{ label: string; value: AdminAccountStatus }> = [
    { label: '正常', value: 'active' },
    { label: '未启用', value: 'inactive' },
    { label: '已停用', value: 'suspended' },
  ];

  useEffect(() => {
    let cancelled = false;

    async function loadInitialData() {
      setLoading(true);
      try {
        const [permissionList, roleList, adminList] = await Promise.all([
          getRbacPermissions(),
          getRbacRoles(),
          getRbacAdmins(),
        ]);
        if (cancelled) {
          return;
        }
        setPermissions(permissionList);
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

    void loadInitialData();

    return () => {
      cancelled = true;
    };
  }, [messageApi]);

  async function refreshAll(showLoading = true) {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [permissionList, roleList, adminList] = await Promise.all([
        getRbacPermissions(),
        getRbacRoles(),
        getRbacAdmins(),
      ]);
      setPermissions(permissionList);
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

  function openCreateRoleDrawer() {
    setEditingRole(null);
    roleForm.resetFields();
    roleForm.setFieldsValue({ permission_ids: [] });
    setRoleDrawerOpen(true);
  }

  function openEditRoleDrawer(role: RoleListItem) {
    setEditingRole(role);
    roleForm.setFieldsValue({
      code: role.code,
      name: role.name,
      description: role.description ?? '',
      permission_ids: role.permission_ids,
    });
    setRoleDrawerOpen(true);
  }

  async function submitRole() {
    const values = await roleForm.validateFields();
    setRoleSubmitting(true);
    try {
      if (editingRole) {
        const payload: UpdateRolePayload = {
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          permission_ids: values.permission_ids,
        };
        await updateRbacRole(editingRole.id, payload);
        messageApi.success('角色已更新');
      } else {
        const payload: CreateRolePayload = {
          code: (values.code ?? '').trim(),
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          permission_ids: values.permission_ids,
        };
        await createRbacRole(payload);
        messageApi.success('角色已创建');
      }

      setRoleDrawerOpen(false);
      roleForm.resetFields();
      setEditingRole(null);
      setSelectedPermissionModuleKey(null);
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setRoleSubmitting(false);
    }
  }

  function openCreateAdminModal() {
    adminForm.resetFields();
    adminForm.setFieldsValue({ role_ids: [] });
    setAdminModalOpen(true);
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
      messageApi.success('管理员账号已创建');
      setAdminModalOpen(false);
      adminForm.resetFields();
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setAdminSubmitting(false);
    }
  }

  function openRoleAssignModal(admin: AdminAccountItem) {
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
      messageApi.success('管理员角色已更新');
      setRoleAssignTarget(null);
      adminRoleForm.resetFields();
      await refreshAll(false);
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setRoleAssignSubmitting(false);
    }
  }

  async function handleAdminStatusChange(admin: AdminAccountItem, status: AdminAccountStatus) {
    setStatusUpdatingId(admin.id);
    try {
      await updateRbacAdminStatus(admin.id, status);
      messageApi.success('管理员状态已更新');
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
      messageApi.success('管理员密码已重置');
      setPasswordTarget(null);
      passwordForm.resetFields();
    } catch (error) {
      messageApi.error((error as Error).message);
    } finally {
      setPasswordSubmitting(false);
    }
  }

  const roleColumns: ColumnsType<RoleListItem> = [
    {
      title: '角色',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space size={8} wrap>
            <Text strong>{record.name}</Text>
            <Tag>{record.code}</Tag>
            {record.is_system ? <Tag color="gold">系统内置</Tag> : null}
          </Space>
          <Text type="secondary">{record.description || '未填写描述'}</Text>
        </Space>
      ),
    },
    {
      title: '权限',
      key: 'permissions',
      render: (_, record) => (
        <Space size={[6, 6]} wrap>
          <Tag color="blue">{record.permissions.length} 项</Tag>
          {record.permissions.slice(0, 6).map((permission) => (
            <Tag key={permission.id}>
              {getResourceLabel(permission.resource_key)} / {getPermissionActionLabel(permission.action)}
            </Tag>
          ))}
          {record.permissions.length > 6 ? <Tag>+{record.permissions.length - 6}</Tag> : null}
        </Space>
      ),
    },
    {
      title: '管理员数',
      dataIndex: 'admin_count',
      key: 'admin_count',
      width: 120,
      render: (value: number) => value.toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Button
          icon={<EditOutlined />}
          disabled={!canEdit || record.is_system}
          onClick={() => openEditRoleDrawer(record)}
        >
          编辑
        </Button>
      ),
    },
  ];

  const adminColumns: ColumnsType<AdminAccountItem> = [
    {
      title: '管理员',
      dataIndex: 'username',
      key: 'username',
      width: 260,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space size={8} wrap>
            <Text strong>{record.username}</Text>
            <Text type="secondary">#{record.user_no}</Text>
            {record.id === currentUserId ? <Tag color="geekblue">当前账号</Tag> : null}
          </Space>
          <Text type="secondary">{record.email}</Text>
          {record.phone ? <Text type="secondary">{record.phone}</Text> : null}
        </Space>
      ),
    },
    {
      title: '角色',
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
      title: '状态',
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
          onChange={(nextStatus) => {
            void handleAdminStatusChange(record, nextStatus);
          }}
        />
      ),
    },
    {
      title: '权限覆盖',
      key: 'permissions',
      render: (_, record) => (
        <Space size={[6, 6]} wrap>
          <Tag color="blue">{record.permissions.length} 项</Tag>
          {record.permissions.slice(0, 4).map((permission) => {
            const [resKey, action] = permission.includes(':') ? permission.split(':') : [permission, 'view'];
            const actionLabel = action === 'edit' ? t('permissions.matrix.actionEdit') : t('permissions.matrix.actionView');
            return (
              <Tag key={permission}>{getResourceLabel(resKey)} / {actionLabel}</Tag>
            );
          })}
          {record.permissions.length > 4 ? <Tag>+{record.permissions.length - 4}</Tag> : null}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space wrap>
          <Button disabled={!canEdit || record.id === currentUserId} onClick={() => openRoleAssignModal(record)}>
            分配角色
          </Button>
          <Button icon={<LockOutlined />} disabled={!canEdit} onClick={() => openPasswordModal(record)}>
            重置密码
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {contextHolder}

      <PageHero
        eyebrow={t('permissions.eyebrow')}
        title={t('permissions.title')}
        description={t('permissions.description')}
        tags={['角色管理', '权限矩阵', '管理员账号', '账号安全']}
        action={
          <Space wrap>
            {canEdit ? (
              <>
                <Button icon={<PlusOutlined />} type="primary" onClick={openCreateRoleDrawer}>
                  新建角色
                </Button>
                <Button icon={<TeamOutlined />} onClick={openCreateAdminModal}>
                  新建管理员
                </Button>
              </>
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              刷新
            </Button>
          </Space>
        }
      />

      {!canEdit ? <Alert type="info" showIcon message="当前账号仅有查看权限，不能创建角色、修改分配或重置管理员密码。" /> : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="权限点" value={permissions.length} prefix={<SafetyOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="角色数" value={roles.length} prefix={<TeamOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="管理员数" value={admins.length} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title="正常管理员" value={admins.filter((item) => item.status === 'active').length} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="roles"
        items={[
          {
            key: 'roles',
            label: '角色与权限',
            children: (
              <Card title="角色列表" extra={<Text type="secondary">共 {roles.length} 个角色</Text>}>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  角色决定管理员能看到哪些菜单、能调用哪些后台接口。系统内置 `super_admin` 角色保留为不可编辑。
                </Paragraph>
                <Table<RoleListItem>
                  rowKey="id"
                  loading={loading}
                  columns={roleColumns}
                  dataSource={roles}
                  scroll={{ x: 960 }}
                  pagination={false}
                />
              </Card>
            ),
          },
          {
            key: 'admins',
            label: '管理员账号',
            children: (
              <Card title="管理员列表" extra={<Text type="secondary">共 {admins.length} 个管理员</Text>}>
                <Paragraph type="secondary" style={{ marginBottom: 16 }}>
                  这里负责注册管理员账号、分配角色、维护管理员状态，以及在需要时重置管理员登录密码。
                </Paragraph>
                <Table<AdminAccountItem>
                  rowKey="id"
                  loading={loading}
                  columns={adminColumns}
                  dataSource={admins}
                  scroll={{ x: 1320 }}
                  pagination={false}
                />
              </Card>
            ),
          },
        ]}
      />

      <Modal
        title={editingRole ? `编辑角色 ${editingRole.name}` : '新建角色'}
        open={roleDrawerOpen}
        onCancel={() => {
          setRoleDrawerOpen(false);
          setEditingRole(null);
          setSelectedPermissionModuleKey(null);
          roleForm.resetFields();
        }}
        width={960}
        footer={
          <Space>
            <Button
              onClick={() => {
                setRoleDrawerOpen(false);
                setEditingRole(null);
                setSelectedPermissionModuleKey(null);
                roleForm.resetFields();
              }}
            >
              取消
            </Button>
            <Button type="primary" loading={roleSubmitting} disabled={!canEdit} onClick={() => void submitRole()}>
              保存
            </Button>
          </Space>
        }
        destroyOnClose
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form<RoleFormValues> form={roleForm} layout="vertical" initialValues={{ permission_ids: [] }}>
          {!editingRole ? (
            <Form.Item
              label="角色编码"
              name="code"
              rules={[
                { required: true, message: '请输入角色编码' },
                { pattern: /^[a-z0-9_]+$/, message: '角色编码仅支持小写字母、数字和下划线' },
              ]}
            >
              <Input placeholder="例如：ops_admin" />
            </Form.Item>
          ) : (
            <Form.Item label="角色编码">
              <Input value={editingRole.code} disabled />
            </Form.Item>
          )}

          <Form.Item label="角色名称" name="name" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input placeholder="例如：运营管理员" />
          </Form.Item>

          <Form.Item label="角色描述" name="description">
            <Input.TextArea rows={3} placeholder="说明这个角色的职责边界" />
          </Form.Item>

          <Form.Item
            label={t('permissions.matrix.fieldLabel')}
            name="permission_ids"
            rules={[{ required: true, type: 'array', min: 1, message: t('permissions.matrix.fieldRequired') }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <div style={{ display: 'flex', gap: 16, minHeight: 320 }}>
                <div style={{ width: 160, flexShrink: 0, borderRight: '1px solid #f0f0f0', paddingRight: 16 }}>
                  {orderedPermissionModules.map((module) => {
                    const active =
                      (selectedPermissionModuleKey ?? orderedPermissionModules[0]?.moduleKey) === module.moduleKey;
                    return (
                      <div
                        key={module.moduleKey}
                        onClick={() => setSelectedPermissionModuleKey(module.moduleKey)}
                        style={{
                          padding: '10px 12px',
                          cursor: 'pointer',
                          borderRadius: 6,
                          background: active ? 'var(--ant-color-primary-bg)' : 'transparent',
                          color: active ? 'var(--ant-color-primary)' : undefined,
                        }}
                      >
                        {module.moduleLabel}
                      </div>
                    );
                  })}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
                  {orderedPermissionModules.map((module) => {
                    const isActive =
                      (selectedPermissionModuleKey ?? orderedPermissionModules[0]?.moduleKey) === module.moduleKey;
                    return (
                      <div
                        key={module.moduleKey}
                        style={{ display: isActive ? 'block' : 'none' }}
                        role="tabpanel"
                        aria-hidden={!isActive}
                      >
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          {module.resources.map((resource) => (
                            <div key={resource.resourceKey}>
                              <Text strong>{getResourceLabel(resource.resourceKey)}</Text>
                              <div style={{ marginTop: 8 }}>
                                <Space size={[12, 12]} wrap>
                                  {resource.items.map((permission) => (
                                    <Checkbox key={permission.id} value={permission.id}>
                                      {getPermissionActionLabel(permission.action)}
                                    </Checkbox>
                                  ))}
                                </Space>
                              </div>
                            </div>
                          ))}
                        </Space>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Checkbox.Group>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="新建管理员"
        open={adminModalOpen}
        confirmLoading={adminSubmitting}
        onCancel={() => {
          setAdminModalOpen(false);
          adminForm.resetFields();
        }}
        onOk={() => void submitCreateAdmin()}
        okButtonProps={{ disabled: !canEdit }}
        okText="创建"
      >
        <Form<AdminCreateFormValues> form={adminForm} layout="vertical" initialValues={{ role_ids: [] }}>
          <Form.Item label="用户名" name="username" rules={[{ required: true, message: '请输入管理员用户名' }]}>
            <Input placeholder="登录用户名" />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '邮箱格式不正确' },
            ]}
          >
            <Input placeholder="管理员邮箱" />
          </Form.Item>
          <Form.Item
            label="初始密码"
            name="password"
            rules={[
              { required: true, message: '请输入初始密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item label="手机号" name="phone">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item
            label="绑定角色"
            name="role_ids"
            rules={[{ required: true, type: 'array', min: 1, message: '至少选择一个角色' }]}
          >
            <Select mode="multiple" placeholder="选择角色" options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={roleAssignTarget ? `分配角色: ${roleAssignTarget.username}` : '分配角色'}
        open={Boolean(roleAssignTarget)}
        confirmLoading={roleAssignSubmitting}
        onCancel={() => {
          setRoleAssignTarget(null);
          adminRoleForm.resetFields();
        }}
        onOk={() => void submitAdminRoles()}
        okButtonProps={{ disabled: !canEdit }}
        okText="保存"
      >
        <Form<AdminRoleFormValues> form={adminRoleForm} layout="vertical">
          <Form.Item
            label="角色"
            name="role_ids"
            rules={[{ required: true, type: 'array', min: 1, message: '至少选择一个角色' }]}
          >
            <Select mode="multiple" placeholder="选择角色" options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={passwordTarget ? `重置密码: ${passwordTarget.username}` : '重置密码'}
        open={Boolean(passwordTarget)}
        confirmLoading={passwordSubmitting}
        onCancel={() => {
          setPasswordTarget(null);
          passwordForm.resetFields();
        }}
        onOk={() => void submitResetPassword()}
        okButtonProps={{ disabled: !canEdit }}
        okText="确认重置"
      >
        <Form<PasswordFormValues> form={passwordForm} layout="vertical">
          <Form.Item
            label="新密码"
            name="password"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少 6 位' },
            ]}
          >
            <Input.Password placeholder="输入新的管理员登录密码" />
          </Form.Item>
        </Form>
      </Modal>

      <Card size="small" title={t('permissions.matrix.legendTitle')}>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {orderedPermissionModules.map((module) => (
            <div key={module.moduleKey}>
              <Text strong>{module.moduleLabel}</Text>
              <div style={{ marginTop: 8 }}>
                <Space size={[8, 8]} wrap>
                  {module.resources.flatMap((resource) =>
                    resource.items.map((permission) => (
                      <Tag key={permission.id}>
                        {getResourceLabel(permission.resource_key)} / {getPermissionActionLabel(permission.action)}
                      </Tag>
                    )),
                  )}
                </Space>
              </div>
            </div>
          ))}
        </Space>
        <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          {t('permissions.matrix.legendDescription')}
        </Paragraph>
      </Card>
    </div>
  );
}

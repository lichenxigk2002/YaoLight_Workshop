import { EditOutlined, PlusOutlined, ReloadOutlined, SafetyOutlined, TeamOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminPermission } from '@/hooks/useAdminPermission';
import { useI18n } from '@/i18n';
import {
  createRbacRole,
  getRbacPermissions,
  getRbacRoles,
  updateRbacRole,
} from '@/features/rbac/api';
import { usePermissionLabels } from '@/features/rbac/usePermissionLabels';
import type { CreateRolePayload, PermissionOption, RoleListItem, UpdateRolePayload } from '@/features/rbac/types';

const { Paragraph, Text } = Typography;

interface RoleFormValues {
  code?: string;
  name: string;
  description?: string;
  permission_ids: number[];
}

const PERMISSION_MODULE_LABEL_KEY_MAP: Record<string, string> = {
  dashboard: 'menu.dashboard',
  users: 'menu.users',
  permissions: 'menu.permissions',
  workflow_templates: 'menu.workflowTemplates',
  node_types: 'menu.nodeTypes',
  knowledge_base: 'menu.knowledgeBase',
  crawler_rules: 'menu.crawlerRules',
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

export default function RolesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const { t } = useI18n();
  const { canEdit } = useAdminPermission('permissions');
  const { getResourceLabel, getPermissionActionLabel } = usePermissionLabels();

  const [permissions, setPermissions] = useState<PermissionOption[]>([]);
  const [roles, setRoles] = useState<RoleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | null>(null);
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [selectedPermissionModuleKey, setSelectedPermissionModuleKey] = useState<string | null>(null);

  const [roleForm] = Form.useForm<RoleFormValues>();

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
    if (!acc[moduleKey]) acc[moduleKey] = { moduleLabel, resources: {} };
    if (!acc[moduleKey].resources[resourceKey]) acc[moduleKey].resources[resourceKey] = { resourceLabel, items: [] };
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
        .map(([resourceKey, resource]) => ({
          resourceKey,
          resourceLabel: resource.resourceLabel,
          items: [...resource.items].sort((a, b) => a.action.localeCompare(b.action)),
        })),
    }));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [permList, roleList] = await Promise.all([getRbacPermissions(), getRbacRoles()]);
        if (cancelled) return;
        setPermissions(permList);
        setRoles(roleList);
      } catch (e) {
        if (!cancelled) messageApi.error((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [messageApi]);

  async function refreshAll(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [permList, roleList] = await Promise.all([getRbacPermissions(), getRbacRoles()]);
      setPermissions(permList);
      setRoles(roleList);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  function openCreateRole() {
    setEditingRole(null);
    roleForm.resetFields();
    roleForm.setFieldsValue({ permission_ids: [] });
    setRoleDrawerOpen(true);
  }

  function openEditRole(role: RoleListItem) {
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
        messageApi.success(t('permissions.roles.updateSuccess'));
      } else {
        const payload: CreateRolePayload = {
          code: (values.code ?? '').trim(),
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
          permission_ids: values.permission_ids,
        };
        await createRbacRole(payload);
        messageApi.success(t('permissions.roles.createSuccess'));
      }
      setRoleDrawerOpen(false);
      roleForm.resetFields();
      setEditingRole(null);
      setSelectedPermissionModuleKey(null);
      await refreshAll(false);
    } catch (e) {
      messageApi.error((e as Error).message);
    } finally {
      setRoleSubmitting(false);
    }
  }

  const roleColumns: ColumnsType<RoleListItem> = [
    {
      title: t('permissions.roles.columnRole'),
      dataIndex: 'name',
      key: 'name',
      width: 240,
      render: (_, record) => (
        <Space direction="vertical" size={4}>
          <Space size={8} wrap>
            <Text strong>{record.name}</Text>
            <Tag>{record.code}</Tag>
            {record.is_system ? <Tag color="gold">{t('permissions.roles.systemRole')}</Tag> : null}
          </Space>
          <Text type="secondary">{record.description || t('permissions.roles.noDescription')}</Text>
        </Space>
      ),
    },
    {
      title: t('permissions.roles.columnPermissions'),
      key: 'permissions',
      render: (_, record) => (
        <Space size={[6, 6]} wrap>
          <Tag color="blue">{record.permissions.length} {t('permissions.roles.items')}</Tag>
          {record.permissions.slice(0, 6).map((p) => (
            <Tag key={p.id}>{getResourceLabel(p.resource_key)} / {getPermissionActionLabel(p.action)}</Tag>
          ))}
          {record.permissions.length > 6 ? <Tag>+{record.permissions.length - 6}</Tag> : null}
        </Space>
      ),
    },
    {
      title: t('permissions.roles.columnAdminCount'),
      dataIndex: 'admin_count',
      key: 'admin_count',
      width: 120,
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: t('permissions.roles.columnActions'),
      key: 'actions',
      width: 140,
      render: (_, record) => (
        <Button
          icon={<EditOutlined />}
          disabled={!canEdit || record.is_system}
          onClick={() => openEditRole(record)}
        >
          {t('permissions.roles.actionEdit')}
        </Button>
      ),
    },
  ];

  return (
    <>
      {contextHolder}
      {!canEdit ? (
        <Alert type="info" showIcon message={t('permissions.roles.viewOnlyHint')} />
      ) : null}

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title={t('permissions.roles.statPermissions')} value={permissions.length} prefix={<SafetyOutlined />} loading={loading} />
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card>
            <Statistic title={t('permissions.roles.statRoles')} value={roles.length} prefix={<TeamOutlined />} loading={loading} />
          </Card>
        </Col>
      </Row>

      <Card
        title={t('permissions.roles.listTitle')}
        extra={
          <Space>
            {canEdit ? (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateRole}>
                {t('permissions.roles.createRole')}
              </Button>
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={() => void refreshAll()}>
              {t('permissions.roles.refresh')}
            </Button>
          </Space>
        }
      >
        <Paragraph type="secondary" style={{ marginBottom: 16 }}>
          {t('permissions.roles.listDescription')}
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

      <Modal
        title={editingRole ? t('permissions.roles.editTitle', { name: editingRole.name }) : t('permissions.roles.createTitle')}
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
            <Button onClick={() => { setRoleDrawerOpen(false); setEditingRole(null); setSelectedPermissionModuleKey(null); roleForm.resetFields(); }}>
              {t('permissions.roles.cancel')}
            </Button>
            <Button type="primary" loading={roleSubmitting} disabled={!canEdit} onClick={() => void submitRole()}>
              {t('permissions.roles.save')}
            </Button>
          </Space>
        }
        destroyOnClose
        bodyStyle={{ maxHeight: '70vh', overflowY: 'auto' }}
      >
        <Form form={roleForm} layout="vertical" initialValues={{ permission_ids: [] }}>
          {!editingRole ? (
            <Form.Item
              label={t('permissions.roles.formCode')}
              name="code"
              rules={[
                { required: true, message: t('permissions.roles.formCodeRequired') },
                { pattern: /^[a-z0-9_]+$/, message: t('permissions.roles.formCodePattern') },
              ]}
            >
              <Input placeholder={t('permissions.roles.formCodePlaceholder')} />
            </Form.Item>
          ) : (
            <Form.Item label={t('permissions.roles.formCode')}>
              <Input value={editingRole.code} disabled />
            </Form.Item>
          )}
          <Form.Item label={t('permissions.roles.formName')} name="name" rules={[{ required: true, message: t('permissions.roles.formNameRequired') }]}>
            <Input placeholder={t('permissions.roles.formNamePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('permissions.roles.formDescription')} name="description">
            <Input.TextArea rows={3} placeholder={t('permissions.roles.formDescriptionPlaceholder')} />
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
                    const active = (selectedPermissionModuleKey ?? orderedPermissionModules[0]?.moduleKey) === module.moduleKey;
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
                    const isActive = (selectedPermissionModuleKey ?? orderedPermissionModules[0]?.moduleKey) === module.moduleKey;
                    return (
                      <div key={module.moduleKey} style={{ display: isActive ? 'block' : 'none' }} role="tabpanel" aria-hidden={!isActive}>
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          {module.resources.map((resource) => (
                            <div key={resource.resourceKey}>
                              <Text strong>{getResourceLabel(resource.resourceKey)}</Text>
                              <div style={{ marginTop: 8 }}>
                                <Space size={[12, 12]} wrap>
                                  {resource.items.map((p) => (
                                    <Checkbox key={p.id} value={p.id}>{getPermissionActionLabel(p.action)}</Checkbox>
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

      <Card size="small">
        <Paragraph type="secondary" style={{ marginBottom: 8 }}>
          {t('permissions.matrix.legendDescription')}
        </Paragraph>
        <Link to="/permissions/matrix">
          <Button type="link" size="small" style={{ padding: 0 }}>
            {t('permissions.matrix.legendTitle')} →
          </Button>
        </Link>
      </Card>
    </>
  );
}

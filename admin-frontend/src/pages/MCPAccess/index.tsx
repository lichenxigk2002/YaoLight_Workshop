import { ApiOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { App, Button, Card, Checkbox, Divider, Form, InputNumber, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useState } from 'react';
import PageHero from '@/components/PageHero';
import { adminMCPApi, type AdminMCPCallLog, type AdminMCPSettings, type AdminMCPToken } from '@/api/mcp';
import { useI18n } from '@/i18n';
import { formatDateTime } from '@/i18n/runtime';
import styles from './index.module.scss';

const { Text, Title } = Typography;

const copy = {
  'zh-CN': {
    eyebrow: 'AI 工具治理',
    title: 'MCP 接入管理',
    desc: '统一管理用户 MCP Token、调用日志和全局接入策略。',
    settings: '全局设置',
    enabled: '启用 MCP 接入',
    allowExecution: '允许执行类工具',
    expires: '默认有效天数',
    maxExpires: '最长有效天数',
    maxTokens: '每用户 Token 上限',
    rateLimit: '每 Token 每分钟调用上限',
    defaultScopes: '默认权限范围',
    save: '保存设置',
    tokens: 'Token 列表',
    logs: '调用日志',
    refresh: '刷新',
    revoke: '吊销',
    revokeConfirm: '确定吊销该 Token？',
    revokeUser: '禁用用户 Token',
    revokeUserConfirm: '确定吊销该用户所有 MCP Token？',
    saved: '设置已保存',
    failed: '操作失败',
    active: '可用',
    revoked: '已吊销',
    expired: '已过期',
    readScopes: '只读权限',
    executeScopes: '高风险执行权限',
    scopes: {
      projectsRead: '查看项目',
      workflowsRead: '查看工作流',
      tasksRead: '查看任务',
      artifactsRead: '查看产物',
      knowledgeRead: '检索知识库',
      modelsRead: '查看模型',
      workflowsExecute: '运行工作流',
      tasksWrite: '管理任务',
    },
  },
  'en-US': {
    eyebrow: 'AI Tool Governance',
    title: 'MCP Access',
    desc: 'Manage MCP tokens, call logs, and global access policy.',
    settings: 'Global Settings',
    enabled: 'Enable MCP Access',
    allowExecution: 'Allow Execution Tools',
    expires: 'Default Expiry Days',
    maxExpires: 'Max Expiry Days',
    maxTokens: 'Max Tokens per User',
    rateLimit: 'Rate Limit per Token / Minute',
    defaultScopes: 'Default Scopes',
    save: 'Save Settings',
    tokens: 'Tokens',
    logs: 'Call Logs',
    refresh: 'Refresh',
    revoke: 'Revoke',
    revokeConfirm: 'Revoke this token?',
    revokeUser: 'Revoke User Tokens',
    revokeUserConfirm: 'Revoke all MCP tokens for this user?',
    saved: 'Settings saved',
    failed: 'Operation failed',
    active: 'Active',
    revoked: 'Revoked',
    expired: 'Expired',
    readScopes: 'Read Scopes',
    executeScopes: 'High-risk Execution Scopes',
    scopes: {
      projectsRead: 'View Projects',
      workflowsRead: 'View Workflows',
      tasksRead: 'View Tasks',
      artifactsRead: 'View Artifacts',
      knowledgeRead: 'Search Knowledge',
      modelsRead: 'View Models',
      workflowsExecute: 'Run Workflows',
      tasksWrite: 'Manage Tasks',
    },
  },
};

const defaultSettings: AdminMCPSettings = {
  enabled: true,
  allowExecutionTools: false,
  defaultExpiresInDays: 90,
  maxExpiresInDays: 365,
  maxTokensPerUser: 10,
  rateLimitPerMinute: 60,
  defaultScopes: ['projects:read', 'workflows:read', 'tasks:read', 'artifacts:read', 'knowledge:read', 'models:read'],
};

const scopeOptions = [
  { value: 'projects:read', labelKey: 'projectsRead', group: 'read' },
  { value: 'workflows:read', labelKey: 'workflowsRead', group: 'read' },
  { value: 'tasks:read', labelKey: 'tasksRead', group: 'read' },
  { value: 'artifacts:read', labelKey: 'artifactsRead', group: 'read' },
  { value: 'knowledge:read', labelKey: 'knowledgeRead', group: 'read' },
  { value: 'models:read', labelKey: 'modelsRead', group: 'read' },
  { value: 'workflows:execute', labelKey: 'workflowsExecute', group: 'execute' },
  { value: 'tasks:write', labelKey: 'tasksWrite', group: 'execute' },
];

export default function MCPAccessAdminPage() {
  const { locale } = useI18n();
  const c = copy[locale];
  const { message } = App.useApp();
  const [form] = Form.useForm<AdminMCPSettings>();
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [tokens, setTokens] = useState<AdminMCPToken[]>([]);
  const [logs, setLogs] = useState<AdminMCPCallLog[]>([]);

  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      form.setFieldsValue(await adminMCPApi.getSettings());
    } catch (error) {
      message.error(error instanceof Error ? error.message : c.failed);
      form.setFieldsValue(defaultSettings);
    } finally {
      setSettingsLoading(false);
    }
  }, [c.failed, form, message]);

  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const data = await adminMCPApi.listTokens({ page: 1, pageSize: 50 });
      setTokens(data.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : c.failed);
    } finally {
      setTokensLoading(false);
    }
  }, [c.failed, message]);

  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const data = await adminMCPApi.listCallLogs({ page: 1, pageSize: 50 });
      setLogs(data.list || []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : c.failed);
    } finally {
      setLogsLoading(false);
    }
  }, [c.failed, message]);

  useEffect(() => {
    void loadSettings();
    void loadTokens();
    void loadLogs();
  }, [loadLogs, loadSettings, loadTokens]);

  const saveSettings = async () => {
    try {
      const values = await form.validateFields();
      const saved = await adminMCPApi.updateSettings({ ...defaultSettings, ...values });
      form.setFieldsValue(saved);
      message.success(c.saved);
    } catch (error) {
      message.error(error instanceof Error ? error.message : c.failed);
    }
  };

  const revokeToken = async (id: number) => {
    try {
      await adminMCPApi.revokeToken(id);
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : c.failed);
    }
  };

  const revokeUserTokens = async (userId: number) => {
    try {
      await adminMCPApi.revokeUserTokens(userId);
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : c.failed);
    }
  };

  const tokenColumns: ColumnsType<AdminMCPToken> = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: 'User', render: (_, r) => r.username || r.email || r.user_id },
    { title: 'Name', dataIndex: 'name' },
    { title: 'Prefix', dataIndex: 'token_prefix', render: (v) => <Text code>{v}...</Text> },
    {
      title: 'Status',
      render: (_, r) => {
        const expired = r.expires_at ? new Date(r.expires_at).getTime() <= Date.now() : false;
        if (r.revoked_at) return <Tag>{c.revoked}</Tag>;
        if (expired) return <Tag color="warning">{c.expired}</Tag>;
        return <Tag color="success">{c.active}</Tag>;
      },
    },
    { title: 'Last Used', dataIndex: 'last_used_at', render: (v) => formatDateTime(v, locale) },
    {
      title: 'Actions',
      width: 230,
      render: (_, r) => (
        <Space>
          <Popconfirm title={c.revokeConfirm} onConfirm={() => void revokeToken(r.id)}>
            <Button size="small" danger icon={<StopOutlined />} disabled={Boolean(r.revoked_at)}>{c.revoke}</Button>
          </Popconfirm>
          <Popconfirm title={c.revokeUserConfirm} onConfirm={() => void revokeUserTokens(r.user_id)}>
            <Button size="small">{c.revokeUser}</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const logColumns: ColumnsType<AdminMCPCallLog> = [
    { title: 'ID', dataIndex: 'id', width: 72 },
    { title: 'User', render: (_, r) => r.username || r.email || r.user_id },
    { title: 'Tool', dataIndex: 'tool_name', render: (v) => <Text code>{v}</Text> },
    { title: 'Resource', render: (_, r) => r.resource_type ? `${r.resource_type}:${r.resource_id || '-'}` : '-' },
    { title: 'Status', dataIndex: 'status', render: (v) => <Tag color={v === 'success' ? 'success' : 'error'}>{v}</Tag> },
    { title: 'Latency', dataIndex: 'latency_ms', render: (v) => `${v}ms` },
    { title: 'Time', dataIndex: 'created_at', render: (v) => formatDateTime(v, locale) },
  ];

  return (
    <div className={styles.page}>
      <PageHero eyebrow={c.eyebrow} title={c.title} description={c.desc} tags={['MCP', 'Token', 'Audit']} />

      <Card className={styles.card} bordered={false}>
        <Title level={3} className={styles.cardTitle}><ApiOutlined /> {c.settings}</Title>
        <Form form={form} layout="vertical" initialValues={defaultSettings} className={styles.settingsForm}>
          <div className={styles.switchRow}>
            <Form.Item name="enabled" label={c.enabled} valuePropName="checked">
            <Switch loading={settingsLoading} />
            </Form.Item>
            <Form.Item name="allowExecutionTools" label={c.allowExecution} valuePropName="checked">
              <Switch loading={settingsLoading} />
            </Form.Item>
          </div>
          <div className={styles.numberGrid}>
            <Form.Item name="defaultExpiresInDays" label={c.expires}>
              <InputNumber min={1} max={365} />
            </Form.Item>
            <Form.Item name="maxExpiresInDays" label={c.maxExpires}>
              <InputNumber min={1} max={365} />
            </Form.Item>
            <Form.Item name="maxTokensPerUser" label={c.maxTokens}>
              <InputNumber min={0} max={100} />
            </Form.Item>
            <Form.Item name="rateLimitPerMinute" label={c.rateLimit}>
              <InputNumber min={0} max={10000} />
            </Form.Item>
          </div>
          <Form.Item name="defaultScopes" label={c.defaultScopes}>
            <Checkbox.Group className={styles.scopeGrid}>
              <div className={styles.scopeGroupTitle}>{c.readScopes}</div>
              {scopeOptions.filter((item) => item.group === 'read').map((item) => (
                <Checkbox key={item.value} value={item.value}>{c.scopes[item.labelKey as keyof typeof c.scopes]}</Checkbox>
              ))}
              <Divider className={styles.scopeDivider} />
              <div className={styles.scopeGroupTitle}>{c.executeScopes}</div>
              {scopeOptions.filter((item) => item.group === 'execute').map((item) => (
                <Checkbox key={item.value} value={item.value}>{c.scopes[item.labelKey as keyof typeof c.scopes]}</Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
          <Button type="primary" onClick={() => void saveSettings()} loading={settingsLoading}>{c.save}</Button>
        </Form>
      </Card>

      <Card className={styles.card} bordered={false}>
        <div className={styles.tableHeader}>
          <Title level={3}>{c.tokens}</Title>
          <Button icon={<ReloadOutlined />} onClick={() => void loadTokens()}>{c.refresh}</Button>
        </div>
        <Table rowKey="id" columns={tokenColumns} dataSource={tokens} loading={tokensLoading} scroll={{ x: 980 }} />
      </Card>

      <Card className={styles.card} bordered={false}>
        <div className={styles.tableHeader}>
          <Title level={3}>{c.logs}</Title>
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs()}>{c.refresh}</Button>
        </div>
        <Table rowKey="id" columns={logColumns} dataSource={logs} loading={logsLoading} scroll={{ x: 900 }} />
      </Card>
    </div>
  );
}

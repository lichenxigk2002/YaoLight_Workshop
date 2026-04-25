import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Checkbox, Form, Input, InputNumber, Modal, Popconfirm, Space, Table, Tabs, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ApiOutlined, CopyOutlined, DeleteOutlined, KeyOutlined, PlusOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import { CodeBlock } from '@/components/CodeBlock';
import { mcpApi } from '@/api/mcp';
import type { CreatedMCPToken, MCPAccessSettings, MCPCallLog, MCPToken } from '@/types/mcp';
import styles from './index.module.scss';

const { Paragraph, Text } = Typography;

const DEFAULT_SCOPES = ['projects:read', 'workflows:read', 'tasks:read', 'artifacts:read', 'knowledge:read', 'models:read'];
const ALL_SCOPES = [...DEFAULT_SCOPES, 'workflows:execute', 'tasks:write'];
const DEFAULT_SETTINGS: MCPAccessSettings = {
  enabled: true,
  allowExecutionTools: false,
  defaultExpiresInDays: 90,
  maxExpiresInDays: 365,
  maxTokensPerUser: 10,
  rateLimitPerMinute: 60,
  defaultScopes: DEFAULT_SCOPES,
};

const SCOPE_META: Record<string, { tone: 'read' | 'write' | 'execute'; labelKey: string; descKey: string }> = {
  'projects:read': { tone: 'read', labelKey: 'settings.mcpScopeLabels.projectsRead', descKey: 'settings.mcpScopeDescriptions.projectsRead' },
  'workflows:read': { tone: 'read', labelKey: 'settings.mcpScopeLabels.workflowsRead', descKey: 'settings.mcpScopeDescriptions.workflowsRead' },
  'tasks:read': { tone: 'read', labelKey: 'settings.mcpScopeLabels.tasksRead', descKey: 'settings.mcpScopeDescriptions.tasksRead' },
  'artifacts:read': { tone: 'read', labelKey: 'settings.mcpScopeLabels.artifactsRead', descKey: 'settings.mcpScopeDescriptions.artifactsRead' },
  'knowledge:read': { tone: 'read', labelKey: 'settings.mcpScopeLabels.knowledgeRead', descKey: 'settings.mcpScopeDescriptions.knowledgeRead' },
  'models:read': { tone: 'read', labelKey: 'settings.mcpScopeLabels.modelsRead', descKey: 'settings.mcpScopeDescriptions.modelsRead' },
  'workflows:execute': { tone: 'execute', labelKey: 'settings.mcpScopeLabels.workflowsExecute', descKey: 'settings.mcpScopeDescriptions.workflowsExecute' },
  'tasks:write': { tone: 'write', labelKey: 'settings.mcpScopeLabels.tasksWrite', descKey: 'settings.mcpScopeDescriptions.tasksWrite' },
};

function formatDateTime(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function apiBaseURL() {
  const explicit = import.meta.env.VITE_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window === 'undefined') return '/api';
  if (['3000', '5173'].includes(window.location.port)) return 'http://localhost:8080/api';
  return `${window.location.origin}/api`;
}

function cliCommand() {
  return import.meta.env.VITE_YAOLIGHT_CLI_COMMAND || 'yaolight';
}

function buildCodexCommand(token: string) {
  return [
    'codex mcp remove yaolight',
    '',
    'codex mcp add yaolight \\',
    `  --env YAOLIGHT_BASE_URL=${apiBaseURL()} \\`,
    `  --env YAOLIGHT_MCP_TOKEN=${token} \\`,
    `  -- ${cliCommand()} mcp serve`,
  ].join('\n');
}

function buildGenericMCPConfig(token: string) {
  return JSON.stringify({
    mcpServers: {
      yaolight: {
        command: cliCommand(),
        args: ['mcp', 'serve'],
        env: {
          YAOLIGHT_BASE_URL: apiBaseURL(),
          YAOLIGHT_MCP_TOKEN: token,
        },
      },
    },
  }, null, 2);
}

function isTokenExpired(token: MCPToken) {
  return token.expires_at ? new Date(token.expires_at).getTime() <= Date.now() : false;
}

export default function MCPAccessPage() {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [tokens, setTokens] = useState<MCPToken[]>([]);
  const [logs, setLogs] = useState<MCPCallLog[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logPage, setLogPage] = useState(1);
  const [logPageSize, setLogPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<MCPAccessSettings>(DEFAULT_SETTINGS);
  const [logsLoading, setLogsLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<CreatedMCPToken | null>(null);

  const loadTokens = useCallback(async () => {
    setLoading(true);
    try {
      setTokens(await mcpApi.listTokens());
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.mcpLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [message, t]);

  const loadSettings = useCallback(async () => {
    try {
      const next = await mcpApi.getSettings();
      setSettings(next);
      form.setFieldsValue({
        expires_in_days: next.defaultExpiresInDays,
        scopes: next.defaultScopes?.length ? next.defaultScopes : DEFAULT_SCOPES,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.mcpLoadFailed'));
    }
  }, [form, message, t]);

  const loadLogs = useCallback(async (page: number, pageSize: number) => {
    setLogsLoading(true);
    try {
      const data = await mcpApi.listCallLogs({ page, pageSize });
      setLogs(data.list || []);
      setLogsTotal(data.total || 0);
      setLogPage(data.page || page);
      setLogPageSize(data.pageSize || pageSize);
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.mcpLoadFailed'));
    } finally {
      setLogsLoading(false);
    }
  }, [message, t]);

  useEffect(() => {
    void loadSettings();
    void loadTokens();
    void loadLogs(1, logPageSize);
  }, [loadLogs, loadSettings, loadTokens, logPageSize]);

  const activeCount = useMemo(
    () => tokens.filter((token) => !token.revoked_at && !isTokenExpired(token)).length,
    [tokens],
  );

  const scopeLabel = useCallback((scope: string) => t(SCOPE_META[scope]?.labelKey || scope, scope), [t]);
  const scopeDesc = useCallback((scope: string) => t(SCOPE_META[scope]?.descKey || scope, ''), [t]);

  const handleCreate = async (values: { name: string; expires_in_days: number; scopes: string[] }) => {
    try {
      const created = await mcpApi.createToken({
        name: values.name,
        expires_in_days: values.expires_in_days,
        scopes: values.scopes?.length ? values.scopes : DEFAULT_SCOPES,
      });
      setCreatedToken(created);
      setCreateOpen(false);
      form.resetFields();
      message.success(t('settings.mcpTokenCreated'));
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.mcpCreateFailed'));
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await mcpApi.revokeToken(id);
      message.success(t('settings.mcpTokenRevoked'));
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.mcpRevokeFailed'));
    }
  };

  const handleDeleteRecord = async (id: number) => {
    try {
      await mcpApi.deleteTokenRecord(id);
      message.success(t('settings.mcpTokenDeleted'));
      await loadTokens();
    } catch (error) {
      message.error(error instanceof Error ? error.message : t('settings.mcpDeleteFailed'));
    }
  };

  const handleCopy = async (value: string, successText = t('settings.mcpCopied')) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(successText);
    } catch {
      message.error(t('settings.mcpCopyFailed'));
    }
  };

  const tokenColumns: ColumnsType<MCPToken> = [
    {
      title: t('settings.mcpTokenName'),
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record) => (
        <div className={styles.tokenName}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.token_prefix}...</Text>
        </div>
      ),
    },
    {
      title: t('settings.mcpScopes'),
      dataIndex: 'scopes',
      key: 'scopes',
      render: (scopes: string[]) => (
        <Space size={[6, 6]} wrap>
          {(scopes || []).map((scope) => (
            <Tag key={scope} className={styles.scopeTag} data-tone={SCOPE_META[scope]?.tone || 'read'}>
              {scopeLabel(scope)}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: t('settings.status'),
      key: 'status',
      render: (_, record) => {
        const expired = record.expires_at ? new Date(record.expires_at).getTime() <= Date.now() : false;
        if (record.revoked_at) return <Tag color="default">{t('settings.mcpRevoked')}</Tag>;
        if (expired) return <Tag color="warning">{t('settings.mcpExpired')}</Tag>;
        return <Tag color="success">{t('settings.mcpActive')}</Tag>;
      },
    },
    {
      title: t('settings.expiresAt'),
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (value: string | null) => formatDateTime(value, '-'),
    },
    {
      title: t('settings.mcpLastUsed'),
      dataIndex: 'last_used_at',
      key: 'last_used_at',
      render: (value: string | null) => formatDateTime(value, '-'),
    },
    {
      title: t('settings.actions'),
      key: 'actions',
      width: 110,
      render: (_, record) => {
        const canDelete = Boolean(record.revoked_at) || isTokenExpired(record);
        if (canDelete) {
          return (
            <Popconfirm
              title={t('settings.mcpDeleteConfirm')}
              okText={t('common.ok')}
              cancelText={t('common.cancel')}
              onConfirm={() => void handleDeleteRecord(record.id)}
            >
              <Button danger size="small" icon={<DeleteOutlined />}>
                {t('settings.mcpDeleteRecord')}
              </Button>
            </Popconfirm>
          );
        }
        return (
          <Popconfirm
            title={t('settings.mcpRevokeConfirm')}
            okText={t('common.ok')}
            cancelText={t('common.cancel')}
            onConfirm={() => void handleRevoke(record.id)}
          >
            <Button size="small" icon={<StopOutlined />}>
              {t('settings.mcpRevoke')}
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  const logColumns: ColumnsType<MCPCallLog> = [
    {
      title: t('settings.mcpToolName'),
      dataIndex: 'tool_name',
      key: 'tool_name',
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: t('settings.status'),
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={value === 'success' ? 'success' : 'error'}>{value}</Tag>,
    },
    {
      title: t('settings.mcpResource'),
      key: 'resource',
      render: (_, record) => record.resource_type ? `${record.resource_type}:${record.resource_id || '-'}` : '-',
    },
    {
      title: t('settings.mcpLatency'),
      dataIndex: 'latency_ms',
      key: 'latency_ms',
      render: (value: number) => `${value}ms`,
    },
    {
      title: t('settings.createdAt'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => formatDateTime(value, '-'),
    },
  ];

  return (
    <div className={styles.container}>
      <SettingsPageTitle
        title={t('settings.mcpAccess')}
        desc={t('settings.mcpAccessDesc')}
        icon={<ApiOutlined />}
      />

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{activeCount}</div>
          <div className={styles.summaryLabel}>{t('settings.mcpActiveTokens')}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{tokens.length}</div>
          <div className={styles.summaryLabel}>{t('settings.mcpTotalTokens')}</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{logsTotal}</div>
          <div className={styles.summaryLabel}>{t('settings.mcpCallCount')}</div>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('settings.mcpTokens')}</h2>
            <p>{t('settings.mcpTokensDesc')}</p>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => void loadTokens()}>
              {t('common.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              {t('settings.mcpCreateToken')}
            </Button>
          </Space>
        </div>
        <div className={styles.tableShell}>
          <Table<MCPToken>
            rowKey="id"
            loading={loading}
            columns={tokenColumns}
            dataSource={tokens}
            pagination={false}
            scroll={{ x: 920 }}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('settings.mcpClientConfig')}</h2>
            <p>{t('settings.mcpClientConfigDesc')}</p>
          </div>
        </div>
        <Alert
          type="info"
          showIcon
          message={t('settings.mcpConfigHint')}
          className={styles.configAlert}
        />
        <Tabs
          items={[
            {
              key: 'codex',
              label: t('settings.mcpCodexConfig'),
              children: (
                <>
                  <CodeBlock value={buildCodexCommand('yl_mcp_xxx')} language="bash" className={styles.codeBlock} defaultExpanded collapsedLines={999} />
                </>
              ),
            },
            {
              key: 'json',
              label: t('settings.mcpJsonConfig'),
              children: (
                <>
                  <CodeBlock value={buildGenericMCPConfig('yl_mcp_xxx')} language="json" className={styles.codeBlock} defaultExpanded collapsedLines={999} />
                </>
              ),
            },
          ]}
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <h2>{t('settings.mcpCallLogs')}</h2>
            <p>{t('settings.mcpCallLogsDesc')}</p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void loadLogs(logPage, logPageSize)}>
            {t('common.refresh')}
          </Button>
        </div>
        <div className={styles.tableShell}>
          <Table<MCPCallLog>
            rowKey="id"
            loading={logsLoading}
            columns={logColumns}
            dataSource={logs}
            pagination={{
              current: logPage,
              pageSize: logPageSize,
              total: logsTotal,
              showSizeChanger: true,
              onChange: (page, pageSize) => void loadLogs(page, pageSize),
            }}
            scroll={{ x: 760 }}
          />
        </div>
      </section>

      <Modal
        title={t('settings.mcpCreateToken')}
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        footer={null}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ name: 'Codex', expires_in_days: settings.defaultExpiresInDays, scopes: settings.defaultScopes }}
          onFinish={handleCreate}
        >
          <Form.Item name="name" label={t('settings.mcpTokenName')} rules={[{ required: true, message: t('settings.mcpTokenNameRequired') }]}>
            <Input prefix={<KeyOutlined />} maxLength={120} />
          </Form.Item>
          <Form.Item name="expires_in_days" label={t('settings.mcpExpiresInDays')} rules={[{ required: true }]}>
            <InputNumber min={1} max={settings.maxExpiresInDays || 365} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="scopes" label={t('settings.mcpScopes')} rules={[{ required: true }]}>
            <Checkbox.Group className={styles.scopeGrid}>
              {ALL_SCOPES.map((scope) => (
                <Checkbox key={scope} value={scope} disabled={!settings.allowExecutionTools && (scope === 'workflows:execute' || scope === 'tasks:write')}>
                  <span className={styles.scopeOption}>
                    <span>{scopeLabel(scope)}</span>
                    <small>{scopeDesc(scope)}</small>
                  </span>
                </Checkbox>
              ))}
            </Checkbox.Group>
          </Form.Item>
          <Button type="primary" htmlType="submit" block>
            {t('settings.mcpCreateToken')}
          </Button>
        </Form>
      </Modal>

      <Modal
        title={t('settings.mcpTokenCreated')}
        open={Boolean(createdToken)}
        onCancel={() => setCreatedToken(null)}
        footer={[
          <Button key="copy-token" icon={<CopyOutlined />} onClick={() => createdToken && void handleCopy(createdToken.token, t('settings.mcpTokenCopied'))}>
            {t('settings.mcpCopyToken')}
          </Button>,
          <Button key="copy-config" type="primary" icon={<CopyOutlined />} onClick={() => createdToken && void handleCopy(buildCodexCommand(createdToken.token), t('settings.mcpCopied'))}>
            {t('settings.mcpCopyCodexConfig')}
          </Button>,
        ]}
      >
        <Alert type="warning" showIcon message={t('settings.mcpTokenVisibleOnce')} />
        {createdToken && (
          <>
            <Paragraph className={styles.secretBlock} copyable={{ text: createdToken.token }}>
              {createdToken.token}
            </Paragraph>
            <Tabs
              items={[
                {
                  key: 'codex',
                  label: t('settings.mcpCodexConfig'),
                  children: <CodeBlock value={buildCodexCommand(createdToken.token)} language="bash" className={styles.codeBlock} defaultExpanded collapsedLines={999} />,
                },
                {
                  key: 'json',
                  label: t('settings.mcpJsonConfig'),
                  children: <CodeBlock value={buildGenericMCPConfig(createdToken.token)} language="json" className={styles.codeBlock} defaultExpanded collapsedLines={999} />,
                },
              ]}
            />
          </>
        )}
      </Modal>
    </div>
  );
}

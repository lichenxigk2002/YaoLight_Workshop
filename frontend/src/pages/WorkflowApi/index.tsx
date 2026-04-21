import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, BookOutlined, ClockCircleOutlined, CopyOutlined, DeleteOutlined, EyeOutlined, GlobalOutlined, KeyOutlined, LinkOutlined, LockOutlined, ReloadOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import type { Dayjs } from 'dayjs'
import { workflowApi } from '@/api/workflow'
import { workflowPublishApi } from '@/api/workflowApi'
import { JsonCodeEditor } from '@/components/WorkflowEditor/utils/JsonCodeEditor'
import type { Workflow } from '@/types/workflow'
import type {
  CreatedWorkflowAPIKey,
  WorkflowAPIEndpoint,
  WorkflowAPIInvocationItem,
  WorkflowAPIKeySummary,
} from '@/types/workflowApi'
import styles from './index.module.scss'

const { Text, Title, Paragraph } = Typography

function formatDateTime(value: string | undefined, language: string, fallback: string) {
  if (!value) return fallback

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')
}

function stringifyExample(value: unknown) {
  if (value == null || value === '') return ''
  return JSON.stringify(value, null, 2)
}

function parseJsonField(value: string | undefined, fieldLabel: string, emptyAsNull = false) {
  if (!value || !value.trim()) return emptyAsNull ? null : undefined
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${fieldLabel} JSON 格式无效`)
  }
}

function stringifyNodeIds(value: unknown) {
  if (!Array.isArray(value) || !value.length) return ''
  return value.join(', ')
}

function parseNodeIds(value: string | undefined) {
  if (!value || !value.trim()) return null
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function getOpenApiOrigin() {
  const explicitOrigin = import.meta.env.VITE_OPEN_API_ORIGIN || import.meta.env.VITE_PROXY_TARGET
  if (explicitOrigin && /^https?:\/\//i.test(explicitOrigin)) {
    return explicitOrigin.replace(/\/$/, '')
  }

  const apiBase = import.meta.env.VITE_BASE_URL || '/api'
  if (/^https?:\/\//i.test(apiBase)) {
    return apiBase.replace(/\/api\/?$/, '').replace(/\/$/, '')
  }

  if (typeof window === 'undefined') return ''

  const { hostname, origin, port, protocol } = window.location
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && (port === '3000' || port === '5173')) {
    return `${protocol}//${hostname}:8080`
  }

  return origin
}

function buildOpenApiUrl(path: string | undefined) {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path

  const origin = getOpenApiOrigin()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return origin ? `${origin}${normalizedPath}` : normalizedPath
}

export default function WorkflowApiPage() {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { projectId, workflowId } = useParams<{ projectId: string; workflowId: string }>()
  const [form] = Form.useForm()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [endpoint, setEndpoint] = useState<WorkflowAPIEndpoint | null>(null)
  const [keys, setKeys] = useState<WorkflowAPIKeySummary[]>([])
  const [invocations, setInvocations] = useState<WorkflowAPIInvocationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [latestKey, setLatestKey] = useState<CreatedWorkflowAPIKey | null>(null)
  const [canvasApiStatus, setCanvasApiStatus] = useState<{
    hasApiInput: boolean
    hasApiOutput: boolean
    apiInputNodes: string[]
    apiOutputNodes: Array<{ id: string; label: string; responsePath?: string }>
  }>({
    hasApiInput: false,
    hasApiOutput: false,
    apiInputNodes: [],
    apiOutputNodes: [],
  })

  const numericWorkflowId = Number(workflowId)

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate(projectId ? `/projects/${projectId}/workflows` : '/')
  }

  const loadAll = useCallback(async () => {
    if (!numericWorkflowId) return
    setLoading(true)
    try {
      const [workflowData, endpointData, keyData, invocationData] = await Promise.all([
        workflowApi.getWorkflowById(numericWorkflowId),
        workflowPublishApi.getEndpoint(numericWorkflowId),
        workflowPublishApi.listKeys(numericWorkflowId),
        workflowPublishApi.listInvocations(numericWorkflowId),
      ])
      const workflowCanvas = await workflowApi.getWorkflowNodes(numericWorkflowId)
      const nodes = workflowCanvas?.nodes || []
      const apiInputNodes = nodes
        .filter((node: any) => node.type === 'start' && node.data?.config?.inputMode === 'api_input')
        .map((node: any) => node.data?.label || node.id)
      const apiOutputNodes = nodes
        .filter((node: any) => node.type === 'output' && node.data?.config?.outputMode === 'api_output')
        .map((node: any) => ({
          id: node.id,
          label: node.data?.label || node.id,
          responsePath: node.data?.config?.responsePath,
        }))

      setWorkflow(workflowData)
      setEndpoint(endpointData)
      setKeys(keyData)
      setInvocations(invocationData.list || [])
      setCanvasApiStatus({
        hasApiInput: apiInputNodes.length > 0,
        hasApiOutput: apiOutputNodes.length > 0,
        apiInputNodes,
        apiOutputNodes,
      })
      form.setFieldsValue({
        name: endpointData.name,
        slug: endpointData.slug,
        description: endpointData.description,
        status: endpointData.status,
        responseMode: endpointData.responseMode,
        resultMode: endpointData.resultMode,
        requestSchema: stringifyExample(endpointData.requestSchema),
        inputMapping: stringifyExample(endpointData.inputMapping),
        responseSchema: stringifyExample(endpointData.responseSchema),
        outputMapping: stringifyExample(endpointData.outputMapping),
        exposeArtifacts: endpointData.exposeArtifacts || 'all',
        exposedArtifactNodeIds: stringifyNodeIds(endpointData.exposedArtifactNodeIds),
        waitTimeoutSeconds: endpointData.waitTimeoutSeconds,
        requestExample: stringifyExample(endpointData.requestExample),
        responseExample: stringifyExample(endpointData.responseExample),
      })
    } catch (error: any) {
      message.error(error.message || t('workflowApi.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [form, message, numericWorkflowId, t])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const handleSave = async (values: any) => {
    if (!numericWorkflowId) return

    try {
      const payload = {
        ...values,
        requestSchema: parseJsonField(values.requestSchema, 'Request Schema', true),
        inputMapping: parseJsonField(values.inputMapping, 'Input Mapping', true),
        responseSchema: parseJsonField(values.responseSchema, 'Response Schema', true),
        outputMapping: parseJsonField(values.outputMapping, 'Output Mapping', true),
        exposeArtifacts: values.exposeArtifacts || 'all',
        exposedArtifactNodeIds: parseNodeIds(values.exposedArtifactNodeIds),
        requestExample: parseJsonField(values.requestExample, 'Request Example', true),
        responseExample: parseJsonField(values.responseExample, 'Response Example', true),
      }
      const data = await workflowPublishApi.saveEndpoint(numericWorkflowId, payload)
      setEndpoint(data)
      message.success(t('workflowApi.saveSuccess'))
      void loadAll()
    } catch (error: any) {
      message.error(error.message || t('workflowApi.saveFailed'))
    }
  }

  const handleCreateKey = async (values: { name: string; expiresAt?: Dayjs | null }) => {
    if (!numericWorkflowId) return
    try {
      const data = await workflowPublishApi.createKey(numericWorkflowId, {
        name: values.name,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : undefined,
      })
      setLatestKey(data)
      setCreateKeyOpen(false)
      message.success(t('workflowApi.keyCreateSuccess'))
      void loadAll()
    } catch (error: any) {
      message.error(error.message || t('workflowApi.keyCreateFailed'))
    }
  }

  const handleToggleKeyStatus = async (item: WorkflowAPIKeySummary) => {
    if (!numericWorkflowId) return
    const nextStatus = item.status === 'active' ? 'inactive' : 'active'
    try {
      await workflowPublishApi.updateKey(numericWorkflowId, item.id, { status: nextStatus })
      message.success(nextStatus === 'active' ? 'API Key 已启用' : 'API Key 已停用')
      void loadAll()
    } catch (error: any) {
      message.error(error.message || '更新 API Key 状态失败')
    }
  }

  const handleDeleteKey = async (item: WorkflowAPIKeySummary) => {
    if (!numericWorkflowId) return
    try {
      await workflowPublishApi.deleteKey(numericWorkflowId, item.id)
      message.success('API Key 已删除')
      void loadAll()
    } catch (error: any) {
      message.error(error.message || '删除 API Key 失败')
    }
  }

  const handleCopy = async (value: string, tip = t('workflowApi.copySuccess')) => {
    try {
      await navigator.clipboard.writeText(value)
      message.success(tip)
    } catch {
      message.error(t('workflowApi.copyFailed'))
    }
  }

  const statusOptions = [
    { label: t('workflowApi.statusDraft'), value: 'draft' },
    { label: t('workflowApi.statusPublished'), value: 'published' },
    { label: t('workflowApi.statusDisabled'), value: 'disabled' },
  ]

  const responseModeOptions = [
    { label: t('workflowApi.responseModeWait'), value: 'wait' },
    { label: t('workflowApi.responseModeAsync'), value: 'async' },
  ]

  const resultModeOptions = [
    { label: t('workflowApi.resultModeJson'), value: 'json' },
    { label: t('workflowApi.resultModeArtifact'), value: 'artifact' },
  ]

  const exposeArtifactsOptions = [
    { label: '全部暴露', value: 'all' },
    { label: '不暴露', value: 'none' },
    { label: '仅指定输出节点', value: 'selected' },
  ]

  const endpointStatusMeta = useMemo(() => {
    switch (endpoint?.status) {
      case 'published':
        return { color: 'success', label: t('workflowApi.statusPublished') }
      case 'disabled':
        return { color: 'default', label: t('workflowApi.statusDisabled') }
      default:
        return { color: 'processing', label: t('workflowApi.statusDraft') }
    }
  }, [endpoint?.status, t])

  const activeKeyCount = keys.filter((item) => item.status === 'active').length
  const latestInvocation = invocations[0]
  const invokeUrl = useMemo(() => buildOpenApiUrl(endpoint?.invokePath), [endpoint?.invokePath])
  const docsUrl = useMemo(() => buildOpenApiUrl(endpoint?.docsPath), [endpoint?.docsPath])

  const overviewMetrics = [
    {
      label: t('workflowApi.endpointStatus'),
      value: endpointStatusMeta.label,
      hint: endpoint?.status === 'published' ? t('workflowApi.docsReady') : t('workflowApi.docsDraft'),
    },
    {
      label: t('workflowApi.totalKeys'),
      value: String(keys.length),
      hint: t('workflowApi.keysDesc'),
    },
    {
      label: t('workflowApi.activeKeys'),
      value: String(activeKeyCount),
      hint: t('workflowApi.authHeaderValue'),
    },
    {
      label: t('workflowApi.lastInvocation'),
      value: formatDateTime(latestInvocation?.createdAt, i18n.language, t('workflowApi.neverUsed')),
      hint: latestInvocation?.status || t('workflowApi.noData'),
    },
  ]

  const invocationColumns = [
    {
      title: t('workflowApi.requestId'),
      dataIndex: 'requestId',
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: t('workflowApi.requestStatus'),
      dataIndex: 'status',
      render: (value: string) => (
        <Tag color={value === 'completed' ? 'green' : value === 'failed' ? 'red' : 'default'}>{value}</Tag>
      ),
    },
    {
      title: t('workflowApi.taskId'),
      dataIndex: 'taskId',
      render: (value?: number) => value ?? '-',
    },
    {
      title: t('workflowApi.errorMessage'),
      dataIndex: 'errorMessage',
      ellipsis: true,
      render: (value?: string) => value || '-',
    },
    {
      title: t('workflowApi.createdAt'),
      dataIndex: 'createdAt',
      render: (value: string) => formatDateTime(value, i18n.language, '-'),
    },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <section className={styles.hero}>
          <div className={styles.heroGlow} />
          <div className={styles.heroContent}>
            <div className={styles.heroBadgeRow}>
              <Button className={styles.backButton} type="text" size="small" icon={<ArrowLeftOutlined />} onClick={handleBack}>
                返回
              </Button>
              <Text className={styles.badge}>{t('workflowApi.heroBadge')}</Text>
              <Tag color={endpointStatusMeta.color}>{endpointStatusMeta.label}</Tag>
            </div>

            <div className={styles.heroHeader}>
              <div className={styles.heroText}>
                <Title level={2} className={styles.title}>
                  {workflow?.name || t('workflowApi.title')}
                </Title>
                <Paragraph className={styles.description}>
                  {t('workflowApi.subtitle')}
                </Paragraph>
              </div>

              <div className={styles.heroAside}>
                <div className={styles.heroAsideCard}>
                  <span className={styles.heroAsideLabel}>{t('workflowApi.invokePath')}</span>
                  <div className={styles.heroAsideValue}>{invokeUrl || t('workflowApi.noData')}</div>
                </div>
                <Space wrap className={styles.heroActions}>
                  <Button icon={<ReloadOutlined />} onClick={() => void loadAll()}>
                    {t('workflowApi.refresh')}
                  </Button>
                  {endpoint?.docsPath ? (
                    <Button
                      type="primary"
                      icon={<EyeOutlined />}
                      disabled={endpoint.status !== 'published'}
                      onClick={() => navigate(endpoint.docsPath)}
                    >
                      {t('workflowApi.previewDocs')}
                    </Button>
                  ) : null}
                </Space>
              </div>
            </div>

            <div className={styles.metricGrid}>
              {overviewMetrics.map((item) => (
                <div key={item.label} className={styles.metricCard}>
                  <span className={styles.metricLabel}>{item.label}</span>
                  <span className={styles.metricValue}>{item.value}</span>
                  <span className={styles.metricHint}>{item.hint}</span>
                </div>
              ))}
            </div>

            <div className={styles.heroRail}>
              <div className={styles.heroRailCard}>
                <span className={styles.heroRailLabel}>{t('workflowApi.responseModeLabel')}</span>
                <span className={styles.heroRailValue}>
                  {endpoint?.responseMode === 'async' ? t('workflowApi.responseModeAsync') : t('workflowApi.responseModeWait')}
                </span>
              </div>
              <div className={styles.heroRailCard}>
                <span className={styles.heroRailLabel}>{t('workflowApi.resultModeLabel')}</span>
                <span className={styles.heroRailValue}>
                  {endpoint?.resultMode === 'artifact' ? t('workflowApi.resultModeArtifact') : t('workflowApi.resultModeJson')}
                </span>
              </div>
              <div className={styles.heroRailCard}>
                <span className={styles.heroRailLabel}>{t('workflowApi.waitTimeoutLabel')}</span>
                <span className={styles.heroRailValue}>
                  {endpoint?.waitTimeoutSeconds ? `${endpoint.waitTimeoutSeconds}s` : t('workflowApi.noData')}
                </span>
              </div>
            </div>
          </div>
        </section>

        {latestKey ? (
          <Alert
            className={styles.latestKeyAlert}
            type="success"
            showIcon
            message={t('workflowApi.latestKeyTitle')}
            description={
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>{t('workflowApi.latestKeyDesc')}</Text>
                <Text code>{latestKey.key}</Text>
                <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(latestKey.key, t('workflowApi.apiKeyCopied'))}>
                  {t('workflowApi.copyApiKey')}
                </Button>
              </Space>
            }
          />
        ) : null}

        <Row gutter={[20, 20]} className={styles.mainGrid}>
          <Col xs={24} xl={15}>
            <div className={styles.contentStack}>
              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.settingsTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.settingsDesc')}</span>
                  </div>
                )}
                loading={loading}
              >
                <Alert
                  style={{ marginBottom: 16 }}
                  type={canvasApiStatus.hasApiInput && canvasApiStatus.hasApiOutput ? 'success' : 'warning'}
                  showIcon
                  message={canvasApiStatus.hasApiInput && canvasApiStatus.hasApiOutput ? '画布已具备 API 入口与出口' : '发布前还需要补齐 API 入口或出口'}
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text>
                        API 输入节点：
                        {' '}
                        {canvasApiStatus.hasApiInput ? canvasApiStatus.apiInputNodes.join(', ') : '未配置'}
                      </Text>
                      <Text>
                        API 输出节点：
                        {' '}
                        {canvasApiStatus.hasApiOutput
                          ? canvasApiStatus.apiOutputNodes.map((item) => `${item.label}${item.responsePath ? ` -> ${item.responsePath}` : ''}`).join(', ')
                          : '未配置'}
                      </Text>
                    </Space>
                  }
                />
                <Form form={form} layout="vertical" onFinish={handleSave}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="name" label={t('workflowApi.apiName')} rules={[{ required: true, message: t('workflowApi.apiNameRequired') }]}>
                        <Input placeholder={t('workflowApi.apiNamePlaceholder')} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="slug" label={t('workflowApi.slug')} rules={[{ required: true, message: t('workflowApi.slugRequired') }]}>
                        <Input placeholder={t('workflowApi.slugPlaceholder')} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="description" label={t('workflowApi.descriptionLabel')}>
                    <Input.TextArea rows={3} placeholder={t('workflowApi.descriptionPlaceholder')} />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="status" label={t('workflowApi.statusLabel')} rules={[{ required: true }]}>
                        <Select options={statusOptions} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="responseMode" label={t('workflowApi.responseModeLabel')} rules={[{ required: true }]}>
                        <Select options={responseModeOptions} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="resultMode" label={t('workflowApi.resultModeLabel')} rules={[{ required: true }]}>
                        <Select options={resultModeOptions} />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item name="waitTimeoutSeconds" label={t('workflowApi.waitTimeoutLabel')}>
                    <InputNumber min={1} max={600} style={{ width: '100%' }} />
                  </Form.Item>

                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="exposeArtifacts" label="Artifacts 暴露策略" rules={[{ required: true }]}>
                        <Select options={exposeArtifactsOptions} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="exposedArtifactNodeIds" label="暴露的输出节点 ID">
                        <Input placeholder="output-report, output-json" />
                      </Form.Item>
                    </Col>
                  </Row>

                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <div className={styles.editorTitle}>Request Schema</div>
                        <div className={styles.editorHint}>定义对外 input 的字段类型、必填项与结构。</div>
                      </div>
                    </div>
                    <Form.Item name="requestSchema" noStyle>
                      <JsonCodeEditor rows={8} />
                    </Form.Item>
                  </div>

                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <div className={styles.editorTitle}>Input Mapping</div>
                        <div className={styles.editorHint}>把外部 input 映射到工作流运行时输入结构，键为目标路径，值为源路径或映射规则。</div>
                      </div>
                    </div>
                    <Form.Item name="inputMapping" noStyle>
                      <JsonCodeEditor rows={8} />
                    </Form.Item>
                  </div>

                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <div className={styles.editorTitle}>{t('workflowApi.requestExampleLabel')}</div>
                        <div className={styles.editorHint}>{t('workflowApi.requestExampleHelp')}</div>
                      </div>
                      <span className={styles.editorPill}>{t('workflowApi.resultModeJson')}</span>
                    </div>
                    <Form.Item name="requestExample" noStyle>
                      <JsonCodeEditor rows={8} />
                    </Form.Item>
                  </div>

                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <div className={styles.editorTitle}>{t('workflowApi.responseExampleLabel')}</div>
                        <div className={styles.editorHint}>{t('workflowApi.responseExampleHelp')}</div>
                      </div>
                      <span className={styles.editorPill}>
                        <ThunderboltOutlined />
                        {endpoint?.responseMode === 'async' ? t('workflowApi.responseModeAsync') : t('workflowApi.responseModeWait')}
                      </span>
                    </div>
                    <Form.Item name="responseExample" noStyle>
                      <JsonCodeEditor rows={8} />
                    </Form.Item>
                  </div>

                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <div className={styles.editorTitle}>Response Schema</div>
                        <div className={styles.editorHint}>约束最终返回的 result 结构；如果运行结果不满足，会把本次 API 调用标记为失败。</div>
                      </div>
                    </div>
                    <Form.Item name="responseSchema" noStyle>
                      <JsonCodeEditor rows={8} />
                    </Form.Item>
                  </div>

                  <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                      <div>
                        <div className={styles.editorTitle}>Output Mapping</div>
                        <div className={styles.editorHint}>从工作流结果中抽取并重组对外返回值。可访问 `result.*`、`artifacts`、`taskId`、`status`、`requestId`。</div>
                      </div>
                    </div>
                    <Form.Item name="outputMapping" noStyle>
                      <JsonCodeEditor rows={8} />
                    </Form.Item>
                  </div>

                  <Alert
                    style={{ marginBottom: 16 }}
                    type="info"
                    showIcon
                    message="API 返回预览"
                    description={
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text>
                          当前 API 会优先使用画布中的 `api_output` 节点作为返回出口。
                        </Text>
                        {canvasApiStatus.apiOutputNodes.length > 0 ? (
                          canvasApiStatus.apiOutputNodes.map((item) => (
                            <Text key={item.id}>
                              {item.label}（{item.id}）
                              {item.responsePath ? ` -> ${item.responsePath}` : ' -> 返回当前输入整体'}
                            </Text>
                          ))
                        ) : (
                          <Text>当前还没有配置 `api_output` 节点。</Text>
                        )}
                      </Space>
                    }
                  />

                  <div className={styles.formActions}>
                    <Button type="primary" htmlType="submit">
                      {t('workflowApi.saveSettings')}
                    </Button>
                  </div>
                </Form>
              </Card>

              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.invocationsTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.invocationsDesc')}</span>
                  </div>
                )}
                loading={loading}
              >
                <Table
                  rowKey="requestId"
                  pagination={false}
                  dataSource={invocations}
                  columns={invocationColumns}
                  scroll={{ x: 860 }}
                  locale={{ emptyText: t('workflowApi.noInvocations') }}
                />
              </Card>
            </div>
          </Col>

          <Col xs={24} xl={9}>
            <div className={styles.railStack}>
              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.accessTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.accessDesc')}</span>
                  </div>
                )}
                loading={loading}
              >
                <div className={styles.infoGrid}>
                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><LinkOutlined /> {t('workflowApi.invokePath')}</span>
                    <div className={styles.infoValueRow}>
                      <span className={styles.infoValue}>{invokeUrl || t('workflowApi.noData')}</span>
                      {invokeUrl ? (
                        <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(invokeUrl, t('workflowApi.copyInvokeUrl'))} />
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><BookOutlined /> {t('workflowApi.docsPath')}</span>
                    <div className={styles.infoValueRow}>
                      <span className={styles.infoValue}>{docsUrl || t('workflowApi.noData')}</span>
                      {docsUrl ? (
                        <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(docsUrl, t('workflowApi.copyInvokeUrl'))} />
                      ) : null}
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><LockOutlined /> {t('workflowApi.authHeader')}</span>
                    <span className={styles.infoMuted}>{t('workflowApi.authHeaderValue')}</span>
                  </div>

                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><ClockCircleOutlined /> {t('workflowApi.publishedAt')}</span>
                    <span className={styles.infoMuted}>
                      {formatDateTime(endpoint?.publishedAt, i18n.language, t('workflowApi.noData'))}
                    </span>
                  </div>
                </div>

                <Button type="primary" icon={<KeyOutlined />} onClick={() => setCreateKeyOpen(true)} className={styles.fullButton}>
                  {t('workflowApi.createApiKey')}
                </Button>

                <div className={styles.securityNote}>
                  <GlobalOutlined className={styles.securityIcon} />
                  <div>
                    <div className={styles.securityTitle}>{t('workflowApi.securityHintTitle')}</div>
                    <div className={styles.securityDesc}>{t('workflowApi.securityHintDesc')}</div>
                  </div>
                </div>
              </Card>

              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.keysTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.keysDesc')}</span>
                  </div>
                )}
                loading={loading}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {keys.map((item) => (
                    <div key={item.id} className={styles.keyRow}>
                      <div className={styles.keyMeta}>
                        <Text strong>{item.name}</Text>
                        <Text type="secondary">{item.keyPrefix}...</Text>
                        <Text type="secondary">
                          {t('workflowApi.createdAt')}: {formatDateTime(item.createdAt, i18n.language, '-')}
                        </Text>
                        <Text type="secondary">
                          {t('workflowApi.lastUsedAt')}: {formatDateTime(item.lastUsedAt, i18n.language, t('workflowApi.neverUsed'))}
                        </Text>
                        <Text type="secondary">
                          到期时间: {formatDateTime(item.expiresAt, i18n.language, '永不过期')}
                        </Text>
                      </div>
                      <Space direction="vertical" align="end">
                        <Tag color={item.status === 'active' ? 'green' : 'default'}>
                          {item.status === 'active' ? t('workflowApi.statusActive') : t('workflowApi.statusInactive')}
                        </Tag>
                        <Space size={8}>
                          <Button
                            size="small"
                            icon={<StopOutlined />}
                            onClick={() => void handleToggleKeyStatus(item)}
                          >
                            {item.status === 'active' ? '停用' : '启用'}
                          </Button>
                          <Popconfirm
                            title="删除这个 API Key？"
                            description="删除后无法恢复，已发出的密钥会立即失效。"
                            okText="删除"
                            cancelText="取消"
                            onConfirm={() => void handleDeleteKey(item)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                              删除
                            </Button>
                          </Popconfirm>
                        </Space>
                      </Space>
                    </div>
                  ))}
                  {!keys.length ? <Text type="secondary">{t('workflowApi.noKeys')}</Text> : null}
                </Space>
              </Card>
            </div>
          </Col>
        </Row>

        <Modal title={t('workflowApi.createKeyTitle')} open={createKeyOpen} footer={null} onCancel={() => setCreateKeyOpen(false)}>
          <Form layout="vertical" onFinish={handleCreateKey}>
            <Form.Item name="name" label={t('workflowApi.keyNameLabel')} rules={[{ required: true, message: t('workflowApi.keyNameRequired') }]}>
              <Input placeholder={t('workflowApi.keyNamePlaceholder')} />
            </Form.Item>
            <Form.Item name="expiresAt" label="过期时间">
              <DatePicker
                showTime
                style={{ width: '100%' }}
                placeholder="可选，不填则永不过期"
                disabledDate={(current) => !!current && current < dayjs().startOf('day')}
              />
            </Form.Item>
            <Button htmlType="submit" type="primary" block>
              {t('workflowApi.create')}
            </Button>
          </Form>
        </Modal>
      </div>
    </div>
  )
}

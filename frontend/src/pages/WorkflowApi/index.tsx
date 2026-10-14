import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { ApiOutlined, ArrowLeftOutlined, BookOutlined, BulbOutlined, ClockCircleOutlined, CopyOutlined, DeleteOutlined, EyeOutlined, GlobalOutlined, KeyOutlined, LinkOutlined, LockOutlined, ReloadOutlined, StopOutlined, ThunderboltOutlined } from '@ant-design/icons'
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

type CanvasAPIInputNode = {
  id: string
  label: string
  inputDataType?: string
  inputData?: string
}

type CanvasAPIOutputNode = {
  id: string
  label: string
  responsePath?: string
  format?: string
  destination?: string
}

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

function parseJsonField(value: string | undefined, fieldLabel: string, emptyAsNull = false, invalidMessage = 'JSON format invalid') {
  if (!value || !value.trim()) return emptyAsNull ? null : undefined
  try {
    return JSON.parse(value)
  } catch {
    throw new Error(`${fieldLabel} ${invalidMessage}`)
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

function tryParseJson(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}

function buildSampleInput(nodes: CanvasAPIInputNode[], fallbackText: string) {
  const node = nodes[0]
  if (!node) {
    return { data: fallbackText }
  }

  if (node.inputDataType === 'json') {
    const parsed = tryParseJson(node.inputData)
    if (parsed && typeof parsed === 'object') return parsed
  }

  if (node.inputDataType === 'number') {
    const numberValue = Number(node.inputData)
    return { data: Number.isFinite(numberValue) ? numberValue : 1 }
  }

  if (node.inputDataType === 'url') {
    return { url: node.inputData || 'https://example.com' }
  }

  return { data: node.inputData || fallbackText }
}

function inferJsonSchema(value: unknown): any {
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length > 0 ? inferJsonSchema(value[0]) : { type: 'any' },
    }
  }

  if (value && typeof value === 'object') {
    const properties: Record<string, any> = {}
    const required: string[] = []
    Object.entries(value as Record<string, unknown>).forEach(([key, childValue]) => {
      properties[key] = inferJsonSchema(childValue)
      required.push(key)
    })
    return {
      type: 'object',
      required,
      properties,
    }
  }

  if (typeof value === 'string') return { type: 'string' }
  if (typeof value === 'number') return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' }
  if (typeof value === 'boolean') return { type: 'boolean' }
  return { type: 'any' }
}

function buildIdentityMapping(value: unknown) {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    return { data: 'data' }
  }

  return Object.keys(value as Record<string, unknown>).reduce<Record<string, string>>((acc, key) => {
    acc[key] = key
    return acc
  }, {})
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
    apiInputNodes: CanvasAPIInputNode[]
    apiOutputNodes: CanvasAPIOutputNode[]
    artifactOutputNodes: CanvasAPIOutputNode[]
  }>({
    hasApiInput: false,
    hasApiOutput: false,
    apiInputNodes: [],
    apiOutputNodes: [],
    artifactOutputNodes: [],
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
        .map((node: any) => ({
          id: node.id,
          label: node.data?.label || node.id,
          inputDataType: node.data?.config?.inputDataType,
          inputData: node.data?.config?.inputData,
        }))
      const apiOutputNodes = nodes
        .filter((node: any) => node.type === 'output' && node.data?.config?.outputMode === 'api_output')
        .map((node: any) => ({
          id: node.id,
          label: node.data?.label || node.id,
          responsePath: node.data?.config?.responsePath,
          format: node.data?.config?.format,
          destination: node.data?.config?.destination,
        }))
      const artifactOutputNodes = nodes
        .filter((node: any) => node.type === 'output')
        .map((node: any) => ({
          id: node.id,
          label: node.data?.label || node.id,
          responsePath: node.data?.config?.responsePath,
          format: node.data?.config?.format,
          destination: node.data?.config?.destination,
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
        artifactOutputNodes,
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
        requestSchema: parseJsonField(values.requestSchema, 'Request Schema', true, t('workflowApi.invalidJsonField')),
        inputMapping: parseJsonField(values.inputMapping, 'Input Mapping', true, t('workflowApi.invalidJsonField')),
        responseSchema: parseJsonField(values.responseSchema, 'Response Schema', true, t('workflowApi.invalidJsonField')),
        outputMapping: parseJsonField(values.outputMapping, 'Output Mapping', true, t('workflowApi.invalidJsonField')),
        exposeArtifacts: values.exposeArtifacts || 'all',
        exposedArtifactNodeIds: parseNodeIds(values.exposedArtifactNodeIds),
        requestExample: parseJsonField(values.requestExample, 'Request Example', true, t('workflowApi.invalidJsonField')),
        responseExample: parseJsonField(values.responseExample, 'Response Example', true, t('workflowApi.invalidJsonField')),
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
      message.success(nextStatus === 'active' ? t('workflowApi.keyActivated') : t('workflowApi.keyDisabled'))
      void loadAll()
    } catch (error: any) {
      message.error(error.message || t('workflowApi.keyStatusUpdateFailed'))
    }
  }

  const handleDeleteKey = async (item: WorkflowAPIKeySummary) => {
    if (!numericWorkflowId) return
    try {
      await workflowPublishApi.deleteKey(numericWorkflowId, item.id)
      message.success(t('workflowApi.keyDeleted'))
      void loadAll()
    } catch (error: any) {
      message.error(error.message || t('workflowApi.keyDeleteFailed'))
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
    { label: t('workflowApi.exposeArtifactsAll'), value: 'all' },
    { label: t('workflowApi.exposeArtifactsNone'), value: 'none' },
    { label: t('workflowApi.exposeArtifactsSelected'), value: 'selected' },
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
  const contractSuggestions = useMemo(() => {
    const sampleInput = buildSampleInput(canvasApiStatus.apiInputNodes, t('workflowApi.sampleInputText'))
    const requestSchema = inferJsonSchema(sampleInput)
    const inputMapping = buildIdentityMapping(sampleInput)
    const outputMapping = {
      data: 'result',
      artifacts: 'artifacts',
      taskId: 'taskId',
      requestId: 'requestId',
    }
    const responseSchema = {
      type: 'object',
      properties: {
        data: { type: 'any' },
        artifacts: {
          type: 'array',
          items: { type: 'object' },
        },
        taskId: { type: 'integer' },
        requestId: { type: 'string' },
      },
    }

    return {
      sampleInput,
      requestExample: {
        input: sampleInput,
        responseMode: endpoint?.responseMode || 'wait',
      },
      requestSchema,
      inputMapping,
      outputMapping,
      responseSchema,
    }
  }, [canvasApiStatus.apiInputNodes, endpoint?.responseMode, t])

  const applyJsonSuggestion = (fieldName: string, value: unknown) => {
    form.setFieldValue(fieldName, value == null ? '' : stringifyExample(value))
  }

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
                {t('workflowApi.back')}
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
                  message={canvasApiStatus.hasApiInput && canvasApiStatus.hasApiOutput ? t('workflowApi.canvasReady') : t('workflowApi.canvasIncomplete')}
                  description={
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Text>
                        {t('workflowApi.apiInputNodes')}:
                        {' '}
                        {canvasApiStatus.hasApiInput
                          ? canvasApiStatus.apiInputNodes.map((item) => `${item.label}（${item.id}）`).join(', ')
                          : t('workflowApi.notConfigured')}
                      </Text>
                      <Text>
                        {t('workflowApi.apiOutputNodes')}:
                        {' '}
                        {canvasApiStatus.hasApiOutput
                          ? canvasApiStatus.apiOutputNodes.map((item) => `${item.label}${item.responsePath ? ` -> ${item.responsePath}` : ''}`).join(', ')
                          : t('workflowApi.notConfigured')}
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

                  <div className={styles.contractPanel}>
                    <div className={styles.contractPanelHeader}>
                      <div>
                        <div className={styles.contractEyebrow}>{t('workflowApi.contractEyebrow')}</div>
                        <div className={styles.contractTitle}>{t('workflowApi.contractTitle')}</div>
                      </div>
                      <Tag icon={<BulbOutlined />} color="processing">{t('workflowApi.contractHintTag')}</Tag>
                    </div>

                    <div className={styles.contractGuideGrid}>
                      <div className={styles.contractGuideCard}>
                        <span className={styles.contractGuideLabel}>{t('workflowApi.contractInput')}</span>
                        <span className={styles.contractGuideValue}>
                          {canvasApiStatus.apiInputNodes.length
                            ? canvasApiStatus.apiInputNodes.map((item) => item.label).join(', ')
                            : t('workflowApi.noApiInputNode')}
                        </span>
                      </div>
                      <div className={styles.contractGuideCard}>
                        <span className={styles.contractGuideLabel}>{t('workflowApi.contractOutput')}</span>
                        <span className={styles.contractGuideValue}>
                          {canvasApiStatus.apiOutputNodes.length
                            ? canvasApiStatus.apiOutputNodes.map((item) => item.label).join(', ')
                            : t('workflowApi.noApiOutputNode')}
                        </span>
                      </div>
                      <div className={styles.contractGuideCard}>
                        <span className={styles.contractGuideLabel}>{t('workflowApi.contractArtifactNodes')}</span>
                        <span className={styles.contractGuideValue}>
                          {canvasApiStatus.artifactOutputNodes.length
                            ? canvasApiStatus.artifactOutputNodes.map((item) => item.id).join(', ')
                            : t('workflowApi.noOutputNodes')}
                        </span>
                      </div>
                    </div>

                    <div className={styles.editorSection}>
                      <div className={styles.editorHeader}>
                        <div>
                          <div className={styles.editorTitle}>{t('workflowApi.requestSchemaTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.requestSchemaHint')}</div>
                        </div>
                        <Button size="small" icon={<ApiOutlined />} onClick={() => applyJsonSuggestion('requestSchema', contractSuggestions.requestSchema)}>
                          {t('workflowApi.generateFromInput')}
                        </Button>
                      </div>
                      <Form.Item name="requestSchema" noStyle>
                        <JsonCodeEditor
                          rows={8}
                          placeholder={stringifyExample(contractSuggestions.requestSchema)}
                        />
                      </Form.Item>
                    </div>

                    <div className={styles.editorSection}>
                      <div className={styles.editorHeader}>
                        <div>
                          <div className={styles.editorTitle}>{t('workflowApi.inputMappingTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.inputMappingHint')}</div>
                        </div>
                        <Space wrap>
                          <Button size="small" onClick={() => applyJsonSuggestion('inputMapping', null)}>
                            {t('workflowApi.leaveEmptyPassthrough')}
                          </Button>
                          <Button size="small" onClick={() => applyJsonSuggestion('inputMapping', contractSuggestions.inputMapping)}>
                            {t('workflowApi.generateIdentityMapping')}
                          </Button>
                        </Space>
                      </div>
                      <Form.Item name="inputMapping" noStyle>
                        <JsonCodeEditor
                          rows={7}
                          placeholder={t('workflowApi.inputMappingPlaceholder')}
                        />
                      </Form.Item>
                    </div>

                    <div className={styles.editorSection}>
                      <div className={styles.editorHeader}>
                        <div>
                          <div className={styles.editorTitle}>{t('workflowApi.requestExampleDisplayTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.requestExampleDisplayHint')}</div>
                        </div>
                        <span className={styles.editorPill}>{endpoint?.responseMode === 'async' ? t('workflowApi.responseModeAsync') : t('workflowApi.responseModeWait')}</span>
                      </div>
                      <div className={styles.editorActions}>
                        <Button size="small" onClick={() => applyJsonSuggestion('requestExample', contractSuggestions.requestExample)}>
                          {t('workflowApi.useCurrentInputExample')}
                        </Button>
                      </div>
                      <Form.Item name="requestExample" noStyle>
                        <JsonCodeEditor
                          rows={8}
                          placeholder={stringifyExample(contractSuggestions.requestExample)}
                        />
                      </Form.Item>
                    </div>

                    <div className={styles.editorSection}>
                      <div className={styles.editorHeader}>
                        <div>
                          <div className={styles.editorTitle}>{t('workflowApi.responseSchemaTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.responseSchemaHint')}</div>
                        </div>
                        <Space wrap>
                          <Button size="small" onClick={() => applyJsonSuggestion('responseSchema', null)}>
                            {t('workflowApi.skipValidation')}
                          </Button>
                          <Button size="small" onClick={() => applyJsonSuggestion('responseSchema', contractSuggestions.responseSchema)}>
                            {t('workflowApi.generateBaseSchema')}
                          </Button>
                        </Space>
                      </div>
                      <Form.Item name="responseSchema" noStyle>
                        <JsonCodeEditor
                          rows={8}
                          placeholder={stringifyExample(contractSuggestions.responseSchema)}
                        />
                      </Form.Item>
                    </div>

                    <div className={styles.editorSection}>
                      <div className={styles.editorHeader}>
                        <div>
                          <div className={styles.editorTitle}>{t('workflowApi.outputMappingTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.outputMappingHint')}</div>
                        </div>
                        <Space wrap>
                          <Button size="small" onClick={() => applyJsonSuggestion('outputMapping', null)}>
                            {t('workflowApi.returnRawResult')}
                          </Button>
                          <Button size="small" onClick={() => applyJsonSuggestion('outputMapping', contractSuggestions.outputMapping)}>
                            {t('workflowApi.generateCommonResponse')}
                          </Button>
                        </Space>
                      </div>
                      <Form.Item name="outputMapping" noStyle>
                        <JsonCodeEditor
                          rows={8}
                          placeholder={t('workflowApi.outputMappingPlaceholder')}
                        />
                      </Form.Item>
                    </div>

                    <div className={styles.editorSection}>
                      <div className={styles.editorHeader}>
                        <div>
                          <div className={styles.editorTitle}>{t('workflowApi.responseExampleDisplayTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.responseExampleDisplayHint')}</div>
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
                          <div className={styles.editorTitle}>{t('workflowApi.artifactAccessTitle')}</div>
                          <div className={styles.editorHint}>{t('workflowApi.artifactAccessHint')}</div>
                        </div>
                      </div>
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item name="exposeArtifacts" label={t('workflowApi.artifactAccessLabel')} rules={[{ required: true }]}>
                            <Select options={exposeArtifactsOptions} />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <Form.Item name="exposedArtifactNodeIds" label={t('workflowApi.exposedArtifactNodeIdsLabel')}>
                            <Input placeholder={canvasApiStatus.artifactOutputNodes.map((item) => item.id).join(', ') || 'output-report, output-json'} />
                          </Form.Item>
                        </Col>
                      </Row>
                    </div>
                  </div>

                  <Alert
                    style={{ marginBottom: 16 }}
                    type="info"
                    showIcon
                    message={t('workflowApi.apiResponsePreview')}
                    description={
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Text>
                          {t('workflowApi.apiResponsePreviewDesc')}
                        </Text>
                        {canvasApiStatus.apiOutputNodes.length > 0 ? (
                          canvasApiStatus.apiOutputNodes.map((item) => (
                            <Text key={item.id}>
                              {item.label}（{item.id}）
                              {item.responsePath ? ` -> ${item.responsePath}` : ` -> ${t('workflowApi.returnWholeInput')}`}
                            </Text>
                          ))
                        ) : (
                          <Text>{t('workflowApi.noApiOutputConfigured')}</Text>
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
                          {t('workflowApi.expiresAt')}: {formatDateTime(item.expiresAt, i18n.language, t('workflowApi.neverExpires'))}
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
                            {item.status === 'active' ? t('workflowApi.disable') : t('workflowApi.enable')}
                          </Button>
                          <Popconfirm
                            title={t('workflowApi.deleteKeyConfirmTitle')}
                            description={t('workflowApi.deleteKeyConfirmDesc')}
                            okText={t('workflowApi.delete')}
                            cancelText={t('workflowApi.cancel')}
                            onConfirm={() => void handleDeleteKey(item)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                              {t('workflowApi.delete')}
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
            <Form.Item name="expiresAt" label={t('workflowApi.expiresAt')}>
              <DatePicker
                showTime
                style={{ width: '100%' }}
                placeholder={t('workflowApi.expiresAtPlaceholder')}
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

import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { BookOutlined, ClockCircleOutlined, CopyOutlined, EyeOutlined, GlobalOutlined, KeyOutlined, LinkOutlined, LockOutlined, ReloadOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { workflowApi } from '@/api/workflow'
import { workflowPublishApi } from '@/api/workflowApi'
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

export default function WorkflowApiPage() {
  const { t, i18n } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { workflowId } = useParams<{ projectId: string; workflowId: string }>()
  const [form] = Form.useForm()
  const [workflow, setWorkflow] = useState<Workflow | null>(null)
  const [endpoint, setEndpoint] = useState<WorkflowAPIEndpoint | null>(null)
  const [keys, setKeys] = useState<WorkflowAPIKeySummary[]>([])
  const [invocations, setInvocations] = useState<WorkflowAPIInvocationItem[]>([])
  const [loading, setLoading] = useState(false)
  const [createKeyOpen, setCreateKeyOpen] = useState(false)
  const [latestKey, setLatestKey] = useState<CreatedWorkflowAPIKey | null>(null)

  const numericWorkflowId = Number(workflowId)

  const loadAll = async () => {
    if (!numericWorkflowId) return
    setLoading(true)
    try {
      const [workflowData, endpointData, keyData, invocationData] = await Promise.all([
        workflowApi.getWorkflowById(numericWorkflowId),
        workflowPublishApi.getEndpoint(numericWorkflowId),
        workflowPublishApi.listKeys(numericWorkflowId),
        workflowPublishApi.listInvocations(numericWorkflowId),
      ])
      setWorkflow(workflowData)
      setEndpoint(endpointData)
      setKeys(keyData)
      setInvocations(invocationData.list || [])
      form.setFieldsValue({
        name: endpointData.name,
        slug: endpointData.slug,
        description: endpointData.description,
        status: endpointData.status,
        responseMode: endpointData.responseMode,
        resultMode: endpointData.resultMode,
        waitTimeoutSeconds: endpointData.waitTimeoutSeconds,
        requestExample: stringifyExample(endpointData.requestExample),
        responseExample: stringifyExample(endpointData.responseExample),
      })
    } catch (error: any) {
      message.error(error.message || t('workflowApi.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAll()
  }, [numericWorkflowId])

  const handleSave = async (values: any) => {
    if (!numericWorkflowId) return

    let requestExample: unknown
    let responseExample: unknown

    try {
      requestExample = values.requestExample ? JSON.parse(values.requestExample) : undefined
      responseExample = values.responseExample ? JSON.parse(values.responseExample) : undefined
    } catch {
      message.error(t('workflowApi.invalidJson'))
      return
    }

    try {
      const payload = {
        ...values,
        requestExample,
        responseExample,
      }
      const data = await workflowPublishApi.saveEndpoint(numericWorkflowId, payload)
      setEndpoint(data)
      message.success(t('workflowApi.saveSuccess'))
      void loadAll()
    } catch (error: any) {
      message.error(error.message || t('workflowApi.saveFailed'))
    }
  }

  const handleCreateKey = async (values: { name: string }) => {
    if (!numericWorkflowId) return
    try {
      const data = await workflowPublishApi.createKey(numericWorkflowId, values)
      setLatestKey(data)
      setCreateKeyOpen(false)
      message.success(t('workflowApi.keyCreateSuccess'))
      void loadAll()
    } catch (error: any) {
      message.error(error.message || t('workflowApi.keyCreateFailed'))
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
      <section className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroContent}>
          <Text className={styles.badge}>{t('workflowApi.heroBadge')}</Text>
          <div className={styles.heroHeader}>
            <div className={styles.heroText}>
              <div className={styles.titleRow}>
                <Title level={2} className={styles.title}>
                  {workflow?.name || t('workflowApi.title')}
                </Title>
                <Tag color={endpointStatusMeta.color}>{endpointStatusMeta.label}</Tag>
              </div>
              <Paragraph className={styles.description}>
                {t('workflowApi.subtitle')}
              </Paragraph>
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

          <div className={styles.metricGrid}>
            {overviewMetrics.map((item) => (
              <div key={item.label} className={styles.metricCard}>
                <span className={styles.metricLabel}>{item.label}</span>
                <span className={styles.metricValue}>{item.value}</span>
                <span className={styles.metricHint}>{item.hint}</span>
              </div>
            ))}
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

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={15}>
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

              <Form.Item name="requestExample" label={t('workflowApi.requestExampleLabel')} extra={t('workflowApi.requestExampleHelp')}>
                <Input.TextArea rows={8} className={styles.codeInput} />
              </Form.Item>

              <Form.Item name="responseExample" label={t('workflowApi.responseExampleLabel')} extra={t('workflowApi.responseExampleHelp')}>
                <Input.TextArea rows={8} className={styles.codeInput} />
              </Form.Item>

              <div className={styles.formActions}>
                <Button type="primary" htmlType="submit">
                  {t('workflowApi.saveSettings')}
                </Button>
              </div>
            </Form>
          </Card>
        </Col>

        <Col xs={24} xl={9}>
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
                  <span className={styles.infoValue}>{endpoint?.invokePath || t('workflowApi.noData')}</span>
                  {endpoint?.invokePath ? (
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(endpoint.invokePath, t('workflowApi.copyInvokeUrl'))} />
                  ) : null}
                </div>
              </div>

              <div className={styles.infoCard}>
                <span className={styles.infoLabel}><BookOutlined /> {t('workflowApi.docsPath')}</span>
                <div className={styles.infoValueRow}>
                  <span className={styles.infoValue}>{endpoint?.docsPath || t('workflowApi.noData')}</span>
                  {endpoint?.docsPath ? (
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(endpoint.docsPath, t('workflowApi.copyInvokeUrl'))} />
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
            style={{ marginTop: 16 }}
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
                  </div>
                  <Tag color={item.status === 'active' ? 'green' : 'default'}>
                    {item.status === 'active' ? t('workflowApi.statusActive') : t('workflowApi.statusInactive')}
                  </Tag>
                </div>
              ))}
              {!keys.length ? <Text type="secondary">{t('workflowApi.noKeys')}</Text> : null}
            </Space>
          </Card>
        </Col>
      </Row>

      <Card
        className={styles.card}
        title={(
          <div className={styles.cardHeader}>
            <span className={styles.cardTitle}>{t('workflowApi.invocationsTitle')}</span>
            <span className={styles.cardDesc}>{t('workflowApi.invocationsDesc')}</span>
          </div>
        )}
        style={{ marginTop: 16 }}
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

      <Modal title={t('workflowApi.createKeyTitle')} open={createKeyOpen} footer={null} onCancel={() => setCreateKeyOpen(false)}>
        <Form layout="vertical" onFinish={handleCreateKey}>
          <Form.Item name="name" label={t('workflowApi.keyNameLabel')} rules={[{ required: true, message: t('workflowApi.keyNameRequired') }]}>
            <Input placeholder={t('workflowApi.keyNamePlaceholder')} />
          </Form.Item>
          <Button htmlType="submit" type="primary" block>
            {t('workflowApi.create')}
          </Button>
        </Form>
      </Modal>
    </div>
  )
}

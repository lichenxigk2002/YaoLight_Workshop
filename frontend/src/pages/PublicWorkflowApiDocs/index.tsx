import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Card, Col, Divider, Row, Segmented, Space, Spin, Tag, Typography } from 'antd'
import { ArrowLeftOutlined, ClockCircleOutlined, CopyOutlined, GlobalOutlined, LockOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { CodeBlock } from '@/components/CodeBlock'
import { getPublicWorkflowDocs } from '@/api/workflowApi'
import type { WorkflowPublicDocs } from '@/types/workflowApi'
import styles from './index.module.scss'

const { Title, Paragraph, Text } = Typography

type SampleLang = 'curl' | 'javascript' | 'python'

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2)
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

function HighlightedCode({ value, language = 'json' }: { value: string; language?: string }) {
  return (
    <CodeBlock
      value={value}
      language={language}
      className={styles.codeBlock}
      showHeader={false}
      defaultExpanded
      collapsedLines={999}
    />
  )
}

export default function PublicWorkflowApiDocsPage() {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const { slug } = useParams<{ slug: string }>()
  const [docs, setDocs] = useState<WorkflowPublicDocs | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [language, setLanguage] = useState<SampleLang>('curl')
  const invokeUrl = useMemo(() => buildOpenApiUrl(docs?.endpoints.invoke), [docs?.endpoints.invoke])

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/')
  }

  useEffect(() => {
    const load = async () => {
      if (!slug) return
      setLoading(true)
      setError(null)
      try {
        const data = await getPublicWorkflowDocs(slug)
        setDocs(data)
      } catch (err: any) {
        if (err?.message === 'workflowApi.publicNonJson') {
          setError(t('workflowApi.publicNonJson'))
        } else if (err?.message === 'workflowApi.publicLoadFailed') {
          setError(t('workflowApi.publicLoadFailed'))
        } else {
          setError(err.message || t('workflowApi.publicLoadFailed'))
        }
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [slug, t])

  const codeSamples = useMemo(() => {
    if (!docs) {
      return { curl: '', javascript: '', python: '' }
    }

    const requestExample = docs.requestExample ?? {}
    const endpoint = invokeUrl || docs.endpoints.invoke
    const requestLiteral = JSON.stringify(requestExample, null, 2)
    const requestInline = JSON.stringify(requestExample)

    return {
      curl: `curl --request POST '${endpoint}' \\
  --header 'Content-Type: application/json' \\
  --header 'X-API-Key: YOUR_API_KEY' \\
  --data '${requestInline}'`,
      javascript: `const response = await fetch('${endpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'YOUR_API_KEY',
  },
  body: JSON.stringify(${requestLiteral}),
})

const data = await response.json()
console.log(data)`,
      python: `import requests

response = requests.post(
    '${endpoint}',
    headers={
        'Content-Type': 'application/json',
        'X-API-Key': 'YOUR_API_KEY',
    },
    json=${requestLiteral},
)

print(response.json())`,
    }
  }, [docs, invokeUrl])

  const handleCopy = async (value: string, tip = t('workflowApi.copySuccess')) => {
    try {
      await navigator.clipboard.writeText(value)
      message.success(tip)
    } catch {
      message.error(t('workflowApi.copyFailed'))
    }
  }

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spin size="large" />
      </div>
    )
  }

  if (error || !docs) {
    return (
      <div className={styles.errorPage}>
        <Alert type="error" message={error || t('workflowApi.publicLoadFailed')} className={styles.errorAlert} />
      </div>
    )
  }

  const waitExample = docs.responseExamples?.wait ?? {}
  const asyncExample = docs.responseExamples?.async ?? {}
  const isPublished = docs.status === 'published'

  return (
    <div className={styles.page}>
      <div className={styles.pageInner}>
        <div className={styles.hero}>
          <div className={styles.heroGlow} />
          <div className={styles.heroContent}>
            <div className={styles.heroBadgeRow}>
              <Button className={styles.backButton} type="text" size="small" icon={<ArrowLeftOutlined />} onClick={handleBack}>
                返回
              </Button>
              <Text className={styles.badge}>{t('workflowApi.publicBadge')}</Text>
              <Tag color={isPublished ? 'success' : 'default'}>
                {isPublished ? t('workflowApi.statusPublished') : t('workflowApi.statusDraft')}
              </Tag>
            </div>

            <div className={styles.heroHeader}>
              <div className={styles.heroCopy}>
                <Title className={styles.title}>{docs.name}</Title>
                <Paragraph className={styles.description}>
                  {docs.description || t('workflowApi.publicSubtitle')}
                </Paragraph>
              </div>

              <div className={styles.heroActionStack}>
                <div className={styles.heroActionCard}>
                  <span className={styles.heroActionLabel}>{t('workflowApi.invokePath')}</span>
                  <span className={styles.heroActionValue}>{invokeUrl || docs.endpoints.invoke}</span>
                </div>
                <Button type="primary" icon={<CopyOutlined />} onClick={() => void handleCopy(invokeUrl || docs.endpoints.invoke, t('workflowApi.copyInvokeUrl'))}>
                  {t('workflowApi.copyInvokeUrl')}
                </Button>
              </div>
            </div>

            <div className={styles.metricGrid}>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t('workflowApi.endpointStatus')}</span>
                <span className={styles.metricValue}>{isPublished ? t('workflowApi.docsReady') : t('workflowApi.docsDraft')}</span>
                <span className={styles.metricHint}>{docs.slug}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t('workflowApi.responseModeLabel')}</span>
                <span className={styles.metricValue}>
                  {docs.responseMode === 'async' ? t('workflowApi.responseModeAsync') : t('workflowApi.responseModeWait')}
                </span>
                <span className={styles.metricHint}>{t('workflowApi.responseExamplesDesc')}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t('workflowApi.resultModeLabel')}</span>
                <span className={styles.metricValue}>
                  {docs.resultMode === 'artifact' ? t('workflowApi.resultModeArtifact') : t('workflowApi.resultModeJson')}
                </span>
                <span className={styles.metricHint}>{t('workflowApi.quickStartDesc')}</span>
              </div>
              <div className={styles.metricCard}>
                <span className={styles.metricLabel}>{t('workflowApi.waitTimeoutLabel')}</span>
                <span className={styles.metricValue}>{docs.waitTimeoutSeconds}s</span>
                <span className={styles.metricHint}>{t('workflowApi.authHeaderValue')}</span>
              </div>
            </div>
          </div>
        </div>

        <Row gutter={[20, 20]}>
          <Col xs={24} xl={14}>
            <div className={styles.contentStack}>
              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.quickStartTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.quickStartDesc')}</span>
                  </div>
                )}
              >
                <div className={styles.quickStartGrid}>
                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><GlobalOutlined /> {t('workflowApi.invokePath')}</span>
                    <div className={styles.valueRow}>
                      <span className={styles.valueText}>{invokeUrl || docs.endpoints.invoke}</span>
                      <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(invokeUrl || docs.endpoints.invoke, t('workflowApi.copyInvokeUrl'))} />
                    </div>
                  </div>

                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><LockOutlined /> {t('workflowApi.authLabel')}</span>
                    <span className={styles.infoMuted}>
                      <Text code>{docs.auth.header}</Text>: <Text code>YOUR_API_KEY</Text>
                    </span>
                  </div>

                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><ClockCircleOutlined /> {t('workflowApi.method')}</span>
                    <span className={styles.infoMuted}>{t('workflowApi.methodValue')}</span>
                  </div>

                  <div className={styles.infoCard}>
                    <span className={styles.infoLabel}><ThunderboltOutlined /> {t('workflowApi.responseModeLabel')}</span>
                    <span className={styles.infoMuted}>
                      {docs.responseMode === 'async' ? t('workflowApi.responseModeAsync') : t('workflowApi.responseModeWait')}
                    </span>
                  </div>
                </div>

                <Divider className={styles.sectionDivider} />

                <div className={styles.blockSection}>
                  <div className={styles.blockHeader}>
                    <span className={styles.blockTitle}>{t('workflowApi.requestExampleTitle')}</span>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(formatJson(docs.requestExample), t('workflowApi.copyRequest'))}>
                      {t('workflowApi.copyRequest')}
                    </Button>
                  </div>
                  <HighlightedCode value={formatJson(docs.requestExample)} language="json" />
                </div>

                {docs.requestSchema ? (
                  <div className={styles.blockSection}>
                    <div className={styles.blockHeader}>
                      <span className={styles.blockTitle}>Request Schema</span>
                    </div>
                    <HighlightedCode value={formatJson(docs.requestSchema)} language="json" />
                  </div>
                ) : null}

                {docs.inputMapping ? (
                  <div className={styles.blockSection}>
                    <div className={styles.blockHeader}>
                      <span className={styles.blockTitle}>Input Mapping</span>
                    </div>
                    <HighlightedCode value={formatJson(docs.inputMapping)} language="json" />
                  </div>
                ) : null}
              </Card>

              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.errorCodesTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.errorCodesDesc')}</span>
                  </div>
                )}
              >
                {docs.errors.length ? (
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {docs.errors.map((item) => (
                      <div key={item.code} className={styles.errorRow}>
                        <Text code>{item.code}</Text>
                        <Text>{item.message}</Text>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary">{t('workflowApi.emptyErrors')}</Text>
                )}
              </Card>

              {docs.responseSchema || docs.outputMapping || docs.exposeArtifacts !== 'all' ? (
                <Card
                  className={styles.card}
                  title={(
                    <div className={styles.cardHeader}>
                      <span className={styles.cardTitle}>Response Contract</span>
                      <span className={styles.cardDesc}>返回值结构、映射规则和 artifacts 暴露策略。</span>
                    </div>
                  )}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <div className={styles.infoCard}>
                      <span className={styles.infoLabel}>Artifacts</span>
                      <span className={styles.infoMuted}>
                        {docs.exposeArtifacts === 'selected'
                          ? `selected: ${(docs.exposedArtifactNodeIds || []).join(', ') || '-'}`
                          : docs.exposeArtifacts}
                      </span>
                    </div>
                    {docs.responseSchema ? <HighlightedCode value={formatJson(docs.responseSchema)} language="json" /> : null}
                    {docs.outputMapping ? <HighlightedCode value={formatJson(docs.outputMapping)} language="json" /> : null}
                  </Space>
                </Card>
              ) : null}
            </div>
          </Col>

          <Col xs={24} xl={10}>
            <div className={styles.railStack}>
              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.codeSamplesTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.codeSamplesDesc')}</span>
                  </div>
                )}
                extra={
                  <Segmented
                    size="small"
                    value={language}
                    onChange={(value) => setLanguage(value as SampleLang)}
                    options={[
                      { label: t('workflowApi.languageCurl'), value: 'curl' },
                      { label: t('workflowApi.languageJavascript'), value: 'javascript' },
                      { label: t('workflowApi.languagePython'), value: 'python' },
                    ]}
                  />
                }
              >
                <div className={styles.blockHeader}>
                  <span className={styles.blockTitle}>{t('workflowApi.codeSamplesTitle')}</span>
                  <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(codeSamples[language], t('workflowApi.copyCode'))}>
                    {t('workflowApi.copyCode')}
                  </Button>
                </div>
                <HighlightedCode
                  value={codeSamples[language]}
                  language={language === 'curl' ? 'bash' : language}
                />
              </Card>

              <Card
                className={styles.card}
                title={(
                  <div className={styles.cardHeader}>
                    <span className={styles.cardTitle}>{t('workflowApi.responseExamplesTitle')}</span>
                    <span className={styles.cardDesc}>{t('workflowApi.responseExamplesDesc')}</span>
                  </div>
                )}
              >
                <div className={styles.blockSection}>
                  <div className={styles.blockHeader}>
                    <span className={styles.blockTitle}>{t('workflowApi.responseWait')}</span>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(formatJson(waitExample), t('workflowApi.copyResponse'))}>
                      {t('workflowApi.copyResponse')}
                    </Button>
                  </div>
                  <HighlightedCode value={formatJson(waitExample)} language="json" />
                </div>

                <div className={styles.blockSection}>
                  <div className={styles.blockHeader}>
                    <span className={styles.blockTitle}>{t('workflowApi.responseAsync')}</span>
                    <Button size="small" icon={<CopyOutlined />} onClick={() => void handleCopy(formatJson(asyncExample), t('workflowApi.copyResponse'))}>
                      {t('workflowApi.copyResponse')}
                    </Button>
                  </div>
                  <HighlightedCode value={formatJson(asyncExample)} language="json" />
                </div>
              </Card>
            </div>
          </Col>
        </Row>
      </div>
    </div>
  )
}

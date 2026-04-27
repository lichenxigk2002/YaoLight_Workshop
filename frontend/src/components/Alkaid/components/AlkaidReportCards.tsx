import { AlertTriangle, Bug, FileText, Lightbulb, Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DebugReport, ExplainReport } from '../types'
import styles from './AlkaidReportCards.module.scss'

interface DebugReportCardProps {
  report: DebugReport
}

interface ExplainReportCardProps {
  report: ExplainReport
}

const compactList = (items?: string[], limit = 4) => {
  if (!items || items.length === 0) return []
  return items.filter(Boolean).slice(0, limit)
}

export const DebugReportCard = ({ report }: DebugReportCardProps) => {
  const { t } = useTranslation()
  const observations = compactList(report.observations)
  const hasFailure = !!report.failedNodeId || report.success === false

  return (
    <section className={styles.reportCard}>
      <div className={styles.reportHeader}>
        <span className={hasFailure ? styles.reportIconWarn : styles.reportIcon}>
          {hasFailure ? <Bug size={15} /> : <Network size={15} />}
        </span>
        <div className={styles.reportTitleBlock}>
          <div className={styles.reportTitle}>{t('workflowEditor.alkaid.debugReport', '调试报告')}</div>
          <div className={styles.reportSub}>
            {hasFailure
              ? t('workflowEditor.alkaid.debugReportFailed', '发现需要处理的问题')
              : t('workflowEditor.alkaid.debugReportPassed', '未发现阻塞性错误')}
          </div>
        </div>
      </div>

      {report.summary && <p className={styles.reportSummary}>{report.summary}</p>}

      {hasFailure && (
        <div className={styles.reportMetaGrid}>
          {report.failedNodeId && (
            <div className={styles.reportMetaItem}>
              <span>{t('workflowEditor.alkaid.failedNode', '失败节点')}</span>
              <strong>{report.failedNodeLabel || report.failedNodeId}</strong>
            </div>
          )}
          {report.failedNodeId && report.failedNodeLabel && report.failedNodeLabel !== report.failedNodeId && (
            <div className={styles.reportMetaItem}>
              <span>{t('workflowEditor.alkaid.nodeId', '节点 ID')}</span>
              <strong>{report.failedNodeId}</strong>
            </div>
          )}
        </div>
      )}

      {observations.length > 0 && (
        <ul className={styles.reportList}>
          {observations.map((item, index) => (
            <li key={`${item}-${index}`}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

export const ExplainReportCard = ({ report }: ExplainReportCardProps) => {
  const { t } = useTranslation()
  const risks = compactList(report.risks)
  const suggestions = compactList(report.suggestions)
  const variableFlow = compactList(report.variableFlow, 3)

  return (
    <section className={styles.reportCard}>
      <div className={styles.reportHeader}>
        <span className={styles.reportIcon}>
          <FileText size={15} />
        </span>
        <div className={styles.reportTitleBlock}>
          <div className={styles.reportTitle}>{t('workflowEditor.alkaid.explainReport', '解释报告')}</div>
          <div className={styles.reportSub}>
            {typeof report.nodeCount === 'number' || typeof report.edgeCount === 'number'
              ? `${report.nodeCount ?? 0} ${t('workflowEditor.nodes', '节点')} · ${report.edgeCount ?? 0} ${t('workflowEditor.edges', '边')}`
              : t('workflowEditor.alkaid.workflowExplained', '已完成工作流梳理')}
          </div>
        </div>
      </div>

      {report.summary && <p className={styles.reportSummary}>{report.summary}</p>}

      {variableFlow.length > 0 && (
        <div className={styles.reportSection}>
          <div className={styles.reportSectionTitle}>
            <Network size={13} />
            {t('workflowEditor.alkaid.variableFlow', '变量流转')}
          </div>
          <ul className={styles.reportList}>
            {variableFlow.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {risks.length > 0 && (
        <div className={styles.reportSection}>
          <div className={styles.reportSectionTitle}>
            <AlertTriangle size={13} />
            {t('workflowEditor.alkaid.risks', '潜在风险')}
          </div>
          <ul className={styles.reportList}>
            {risks.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className={styles.reportSection}>
          <div className={styles.reportSectionTitle}>
            <Lightbulb size={13} />
            {t('workflowEditor.alkaid.suggestions', '建议')}
          </div>
          <ul className={styles.reportList}>
            {suggestions.map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

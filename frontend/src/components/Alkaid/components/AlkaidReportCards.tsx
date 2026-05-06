import { useState } from 'react'
import { Button, Modal, Tooltip } from 'antd'
import { AlertTriangle, Bug, Eye, FileText, Lightbulb, Network } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { MarkdownRenderer } from '@/components/WorkflowEditor/utils/MarkdownRenderer'
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

const fullList = (items?: string[]) => {
  if (!items || items.length === 0) return []
  return items.filter(Boolean)
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

      {report.summary && (
        <MarkdownRenderer
          content={report.summary}
          className={styles.reportSummaryMarkdown}
          codeBlockAppearance="minimal"
          codeBlockShowHeader={false}
          codeBlockShowLineNumbers={false}
        />
      )}

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
  const [detailOpen, setDetailOpen] = useState(false)
  const risks = compactList(report.risks)
  const suggestions = compactList(report.suggestions)
  const variableFlow = compactList(report.variableFlow, 3)
  const fullVariableFlow = fullList(report.variableFlow)
  const fullRisks = fullList(report.risks)
  const fullSuggestions = fullList(report.suggestions)
  const hasDetail =
    !!report.summary ||
    fullVariableFlow.length > 0 ||
    fullRisks.length > 0 ||
    fullSuggestions.length > 0

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
        {hasDetail && (
          <Tooltip title={t('workflowEditor.alkaid.viewExplainReportDetail', '查看完整解释报告')}>
            <Button
              className={styles.reportAction}
              type="text"
              size="small"
              icon={<Eye size={15} />}
              aria-label={t('workflowEditor.alkaid.viewExplainReportDetail', '查看完整解释报告')}
              onClick={() => setDetailOpen(true)}
            />
          </Tooltip>
        )}
      </div>

      {report.summary && (
        <MarkdownRenderer
          content={report.summary}
          className={styles.reportSummaryMarkdown}
          codeBlockAppearance="minimal"
          codeBlockShowHeader={false}
          codeBlockShowLineNumbers={false}
        />
      )}

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

      <Modal
        title={t('workflowEditor.alkaid.explainReportDetail', '完整解释报告')}
        open={detailOpen}
        onCancel={() => setDetailOpen(false)}
        footer={null}
        width={680}
      >
        <div className={styles.reportDetail}>
          <div className={styles.reportDetailMeta}>
            {typeof report.nodeCount === 'number' || typeof report.edgeCount === 'number'
              ? `${report.nodeCount ?? 0} ${t('workflowEditor.nodes', '节点')} · ${report.edgeCount ?? 0} ${t('workflowEditor.edges', '边')}`
              : t('workflowEditor.alkaid.workflowExplained', '已完成工作流梳理')}
          </div>

          {report.summary && (
            <section className={styles.reportDetailSection}>
              <div className={styles.reportDetailTitle}>{t('workflowEditor.alkaid.summary', '整体说明')}</div>
              <MarkdownRenderer
                content={report.summary}
                className={styles.reportDetailMarkdown}
                codeBlockAppearance="minimal"
                codeBlockShowHeader={false}
                codeBlockShowLineNumbers={false}
              />
            </section>
          )}

          {fullVariableFlow.length > 0 && (
            <section className={styles.reportDetailSection}>
              <div className={styles.reportDetailTitle}>
                <Network size={14} />
                {t('workflowEditor.alkaid.variableFlow', '变量流转')}
              </div>
              <ul className={styles.reportDetailList}>
                {fullVariableFlow.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <MarkdownRenderer
                      content={item}
                      className={styles.reportDetailMarkdown}
                      codeBlockAppearance="minimal"
                      codeBlockShowHeader={false}
                      codeBlockShowLineNumbers={false}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {fullRisks.length > 0 && (
            <section className={styles.reportDetailSection}>
              <div className={styles.reportDetailTitle}>
                <AlertTriangle size={14} />
                {t('workflowEditor.alkaid.risks', '潜在风险')}
              </div>
              <ul className={styles.reportDetailList}>
                {fullRisks.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <MarkdownRenderer
                      content={item}
                      className={styles.reportDetailMarkdown}
                      codeBlockAppearance="minimal"
                      codeBlockShowHeader={false}
                      codeBlockShowLineNumbers={false}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {fullSuggestions.length > 0 && (
            <section className={styles.reportDetailSection}>
              <div className={styles.reportDetailTitle}>
                <Lightbulb size={14} />
                {t('workflowEditor.alkaid.suggestions', '建议')}
              </div>
              <ul className={styles.reportDetailList}>
                {fullSuggestions.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <MarkdownRenderer
                      content={item}
                      className={styles.reportDetailMarkdown}
                      codeBlockAppearance="minimal"
                      codeBlockShowHeader={false}
                      codeBlockShowLineNumbers={false}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Modal>
    </section>
  )
}

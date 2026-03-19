import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  CodeOutlined,
  CommentOutlined,
  FileTextOutlined,
  LoadingOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { AgentPlanStep, AgentToolStep, Phase } from '../types';
import styles from './AlkaidProgress.module.scss';

const RoundedChevronDown: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
    <path d="M3 5 L6 8 L9 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface PipelineStep {
  key: string;
  labelKey: string;
  descriptionKey: string;
  phases: Phase[];
  icon: React.ReactNode;
}

interface DisplayPlanStep extends AgentPlanStep {
  mergedPlanStepIds: string[];
  toolSteps: AgentToolStep[];
}

interface AlkaidProgressProps {
  phase: Phase;
  planSteps?: AgentPlanStep[];
  toolSteps: AgentToolStep[];
  maxSteps?: number;
  collapsed?: boolean;
  compact?: boolean;
}

type TimelineStatus = 'pending' | 'inProgress' | 'completed' | 'skipped' | 'error';

const PIPELINE_STEPS: PipelineStep[] = [
  {
    key: 'planning',
    labelKey: 'workflowEditor.alkaid.progressPlanning',
    descriptionKey: 'workflowEditor.alkaid.progressPlanningDesc',
    phases: ['planning'],
    icon: <CodeOutlined />,
  },
  {
    key: 'generating',
    labelKey: 'workflowEditor.alkaid.progressGenerating',
    descriptionKey: 'workflowEditor.alkaid.progressGeneratingDesc',
    phases: ['generating'],
    icon: <FileTextOutlined />,
  },
  {
    key: 'validating',
    labelKey: 'workflowEditor.alkaid.progressValidating',
    descriptionKey: 'workflowEditor.alkaid.progressValidatingDesc',
    phases: ['validating', 'repairing', 'running_trial'],
    icon: <SafetyCertificateOutlined />,
  },
  {
    key: 'finishing',
    labelKey: 'workflowEditor.alkaid.progressFinishing',
    descriptionKey: 'workflowEditor.alkaid.progressFinishingDesc',
    phases: ['waiting_approval', 'summarizing'],
    icon: <RocketOutlined />,
  },
];

const COMPACT_MAX_PLAN_STEPS = 4;
const COMPACT_MAX_TOOL_STEPS = 3;

function toolNameToI18nKey(toolName: string): string {
  const key = 'tool' + toolName.split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join('');
  return `workflowEditor.alkaid.${key}`;
}

function getLatestRoundMessageId(planSteps: AgentPlanStep[], toolSteps: AgentToolStep[]): number | null {
  const ids = [
    ...planSteps.map((step) => step.userMessageId),
    ...toolSteps.map((step) => step.userMessageId),
  ].filter((id) => Number.isFinite(id) && id > 0);

  if (ids.length === 0) return null;
  return Math.max(...ids);
}

function dedupeToolSteps(steps: AgentToolStep[]): AgentToolStep[] {
  const merged = new Map<string, AgentToolStep>();

  steps.forEach((step) => {
    const prev = merged.get(step.stepId);
    if (!prev) {
      merged.set(step.stepId, step);
      return;
    }

    merged.set(step.stepId, {
      ...prev,
      ...step,
      resultSummary: step.resultSummary ?? prev.resultSummary,
      errorMessage: step.errorMessage ?? prev.errorMessage,
      finishedAt: step.finishedAt ?? prev.finishedAt,
    });
  });

  return Array.from(merged.values());
}

function planStatusToTimelineStatus(status: AgentPlanStep['status']): TimelineStatus {
  if (status === 'running') return 'inProgress';
  if (status === 'success') return 'completed';
  if (status === 'error') return 'error';
  if (status === 'skipped') return 'skipped';
  return 'pending';
}

function renderStatusIcon(status: TimelineStatus, customIcon?: React.ReactNode) {
  if (status === 'completed') return <CheckOutlined style={{ fontSize: 10 }} />;
  if (status === 'inProgress') return <LoadingOutlined style={{ fontSize: 10 }} spin />;
  if (status === 'error') return <CloseOutlined style={{ fontSize: 10 }} />;
  return customIcon
    ? React.cloneElement(customIcon as React.ReactElement, { style: { fontSize: 10 } })
    : <ClockCircleOutlined style={{ fontSize: 10 }} />;
}

function shouldShowExpand(text?: string): boolean {
  if (!text) return false;
  return text.length > 92 || text.includes('\n');
}

function hasPlanStepDetails(step: DisplayPlanStep): boolean {
  return Boolean(
    step.reason
    || step.expectedOutput
    || step.resultSummary
    || step.errorMessage
    || step.toolSteps.length > 0,
  );
}

function isSyntheticPlanStep(step: AgentPlanStep): boolean {
  return step.source === 'synthetic';
}

const AlkaidProgress: React.FC<AlkaidProgressProps> = ({
  phase,
  planSteps = [],
  toolSteps,
  compact = false,
}) => {
  const { t } = useTranslation();
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  const [expandedTexts, setExpandedTexts] = useState<Record<string, boolean>>({});

  const latestRoundMessageId = useMemo(
    () => getLatestRoundMessageId(planSteps, toolSteps),
    [planSteps, toolSteps],
  );

  const currentRoundPlanSteps = useMemo(
    () => (latestRoundMessageId == null
      ? planSteps
      : planSteps.filter((step) => step.userMessageId === latestRoundMessageId)),
    [latestRoundMessageId, planSteps],
  );

  const currentRoundToolSteps = useMemo(
    () => (latestRoundMessageId == null
      ? toolSteps
      : toolSteps.filter((step) => step.userMessageId === latestRoundMessageId)),
    [latestRoundMessageId, toolSteps],
  );

  const planTools = useMemo(() => {
    const grouped: Record<string, AgentToolStep[]> = {};
    currentRoundToolSteps.forEach((step) => {
      const key = step.planStepId || '__unplanned__';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(step);
    });
    return grouped;
  }, [currentRoundToolSteps]);

  const displayPlanSteps = useMemo<DisplayPlanStep[]>(() => {
    return currentRoundPlanSteps.map((step) => ({
      ...step,
      mergedPlanStepIds: [step.planStepId],
      toolSteps: compact
        ? dedupeToolSteps(planTools[step.planStepId] || []).slice(-COMPACT_MAX_TOOL_STEPS)
        : dedupeToolSteps(planTools[step.planStepId] || []),
    }));
  }, [compact, currentRoundPlanSteps, planTools]);

  const plannedDisplayPlanSteps = useMemo(
    () => displayPlanSteps.filter((step) => !isSyntheticPlanStep(step)),
    [displayPlanSteps],
  );

  const syntheticDisplayPlanSteps = useMemo(
    () => displayPlanSteps.filter((step) => isSyntheticPlanStep(step)),
    [displayPlanSteps],
  );

  const toolStepsByMessage = useMemo(() => {
    const groups: Record<number, AgentToolStep[]> = {};
    currentRoundToolSteps.forEach((step) => {
      if (!groups[step.userMessageId]) groups[step.userMessageId] = [];
      groups[step.userMessageId].push(step);
    });
    return groups;
  }, [currentRoundToolSteps]);

  const messageIds = useMemo(
    () => Object.keys(toolStepsByMessage).map(Number).sort((a, b) => a - b),
    [toolStepsByMessage],
  );

  const currentStepIndex = useMemo(() => {
    if (phase === 'idle' && currentRoundToolSteps.length === 0) return 0;
    if (phase === 'idle' && !currentRoundToolSteps.some((s) => s.status === 'error')) return PIPELINE_STEPS.length;
    if (phase === 'error' || (phase === 'idle' && currentRoundToolSteps.some((s) => s.status === 'error'))) {
      if (currentRoundToolSteps.length > 0) {
        const lastTool = currentRoundToolSteps[currentRoundToolSteps.length - 1];
        const idx = PIPELINE_STEPS.findIndex((step) => step.phases.includes(lastTool.phase));
        return idx !== -1 ? idx : 0;
      }
      return 0;
    }
    const idx = PIPELINE_STEPS.findIndex((step) => step.phases.includes(phase));
    return idx !== -1 ? idx : 0;
  }, [currentRoundToolSteps, phase]);

  const visibleSteps = useMemo(() => PIPELINE_STEPS.slice(0, currentStepIndex + 1), [currentStepIndex]);

  const stepsByPipeline = useMemo(() => {
    const grouped: Record<string, AgentToolStep[]> = {};
    currentRoundToolSteps.forEach((step) => {
      const pipelineStep = PIPELINE_STEPS.find((item) => item.phases.includes(step.phase));
      const key = pipelineStep?.key || 'planning';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(step);
    });
    return grouped;
  }, [currentRoundToolSteps]);

  const generatingPlanStep = useMemo(
    () => plannedDisplayPlanSteps.find((step) => step.phase === 'generating' && step.status === 'running'),
    [plannedDisplayPlanSteps],
  );

  const nonGeneratingPlanSteps = useMemo(
    () => plannedDisplayPlanSteps.filter((step) => step.phase !== 'generating'),
    [plannedDisplayPlanSteps],
  );

  const showGeneratingTimelineStep = useMemo(() => {
    if (phase !== 'generating') return false;
    if (generatingPlanStep) return true;
    if (plannedDisplayPlanSteps.length === 0) return true;

    // Only expose the synthetic "content generating" step after prior plan steps
    // have actually finished, otherwise later stages appear to start too early.
    return nonGeneratingPlanSteps.every((step) => step.status === 'success' || step.status === 'skipped');
  }, [generatingPlanStep, nonGeneratingPlanSteps, phase, plannedDisplayPlanSteps.length]);

  const renderedPlanSteps = useMemo(
    () => (showGeneratingTimelineStep && generatingPlanStep
      ? plannedDisplayPlanSteps.filter((step) => step.planStepId !== generatingPlanStep.planStepId)
      : plannedDisplayPlanSteps),
    [plannedDisplayPlanSteps, generatingPlanStep, showGeneratingTimelineStep],
  );

  const compactRenderedPlanSteps = useMemo(
    () => (compact ? renderedPlanSteps.slice(-COMPACT_MAX_PLAN_STEPS) : renderedPlanSteps),
    [compact, renderedPlanSteps],
  );

  const planItemCount = compactRenderedPlanSteps.length + (showGeneratingTimelineStep ? 1 : 0);
  const shouldUsePlanView = planItemCount > 0;

  const toggleText = (id: string) => {
    setExpandedTexts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStep = (id: string) => {
    setCollapsedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const isStepCollapsed = (id: string, status: TimelineStatus, hasDetails: boolean) => {
    if (collapsedSteps[id] != null) return collapsedSteps[id];
    if (!compact || !hasDetails) return false;
    return status !== 'inProgress' && status !== 'error';
  };

  const renderTextBlock = (
    text: string | undefined,
    id: string,
    variant: 'desc' | 'meta' | 'result' | 'error',
  ) => {
    if (!text) return null;

    const canExpand = shouldShowExpand(text);
    const expanded = expandedTexts[id] ?? false;

    return (
      <div className={styles.textBlock}>
        <div
          className={[
            variant === 'desc' ? styles.timelineDesc : '',
            variant === 'meta' ? styles.planMeta : '',
            variant === 'result' ? styles.subStepResult : '',
            variant === 'error' ? styles.planError : '',
            canExpand && !expanded ? styles.textClamp3 : '',
          ].filter(Boolean).join(' ')}
        >
          {text}
        </div>
        {canExpand && (
          <button type="button" className={styles.textToggle} onClick={() => toggleText(id)}>
            {expanded
              ? t('workflowEditor.alkaid.collapseText', '收起')
              : t('workflowEditor.alkaid.expandText', '展开')}
          </button>
        )}
      </div>
    );
  };

const renderPlanStatusTag = (status: DisplayPlanStep['status']) => {
  const timelineStatus = planStatusToTimelineStatus(status);
  if (timelineStatus === 'skipped') {
    return (
      <span className={[styles.statusTag, styles[timelineStatus]].join(' ')}>
        {t('workflowEditor.alkaid.skipped', '已跳过')}
      </span>
    );
  }
  const label =
      timelineStatus === 'inProgress'
        ? t('workflowEditor.alkaid.generating', '生成中')
        : timelineStatus === 'completed'
          ? t('workflowEditor.alkaid.completed', '已完成')
          : timelineStatus === 'error'
            ? t('workflowEditor.alkaid.failed', '失败')
            : t('workflowEditor.alkaid.pending', '待执行');

    return <span className={[styles.statusTag, styles[timelineStatus]].join(' ')}>{label}</span>;
  };

  const renderingStepCollapsed = collapsedSteps.__content_generating__ ?? compact;
  const renderingStepSummary =
    generatingPlanStep?.resultSummary
    || generatingPlanStep?.reason
    || t(
      'workflowEditor.alkaid.streamingWorkflow',
      '正在流式生成工作流方案，内容会持续更新，不依赖卡片自身的 loading 状态。',
    );

  const executionSection = !compact && syntheticDisplayPlanSteps.length > 0 ? (
    <div className={styles.executionSection}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          {t('workflowEditor.alkaid.executionSteps', '执行过程')}
        </div>
        <span className={styles.sectionTag}>
          {t('workflowEditor.alkaid.executionStepsDesc', '系统补充的执行步骤')}
        </span>
      </div>

      <div className={styles.executionList}>
        {syntheticDisplayPlanSteps.map((step) => {
          const status = planStatusToTimelineStatus(step.status);
          const canCollapse = hasPlanStepDetails(step);
          const isCollapsed = collapsedSteps[step.planStepId] ?? false;

          return (
            <div key={step.planStepId} className={styles.executionCard}>
              <div className={styles.executionTitleRow}>
                <div className={styles.timelineTitleGroup}>
                  <div className={[styles.timelineTitle, styles[status]].join(' ')}>
                    {step.title}
                  </div>
                  <span className={styles.kindTag}>
                    {t('workflowEditor.alkaid.syntheticStep', '执行步')}
                  </span>
                  {renderPlanStatusTag(step.status)}
                </div>
                {canCollapse && (
                  <button
                    type="button"
                    className={[styles.collapseToggle, isCollapsed ? styles.collapsed : styles.expanded].join(' ')}
                    onClick={() => toggleStep(step.planStepId)}
                    aria-label={
                      isCollapsed
                        ? t('workflowEditor.alkaid.expandSubSteps', '灞曞紑璇︽儏')
                        : t('workflowEditor.alkaid.collapseSubSteps', '鏀惰捣璇︽儏')
                    }
                  >
                    <RoundedChevronDown />
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <>
                  {renderTextBlock(step.reason, `synthetic-desc-${step.planStepId}`, 'desc')}
                  {renderTextBlock(step.expectedOutput, `synthetic-expected-${step.planStepId}`, 'meta')}
                  {renderTextBlock(step.resultSummary, `synthetic-summary-${step.planStepId}`, 'meta')}
                  {renderTextBlock(step.errorMessage, `synthetic-error-${step.planStepId}`, 'error')}
                </>
              )}

              {step.toolSteps.length > 0 && !isCollapsed && (
                <div className={styles.subSteps}>
                  {step.toolSteps.map((tool) => (
                    <div key={tool.stepId} className={styles.subStepItem}>
                      <div className={styles.subStepIcon}>
                        {tool.status === 'running' ? (
                          <LoadingOutlined spin style={{ color: '#1677ff' }} />
                        ) : tool.status === 'success' ? (
                          <CheckOutlined style={{ color: '#52c41a' }} />
                        ) : tool.status === 'error' ? (
                          <CloseOutlined style={{ color: '#ff4d4f' }} />
                        ) : (
                          <ClockCircleOutlined style={{ color: '#ccc' }} />
                        )}
                      </div>
                      <div className={styles.subStepContent}>
                        <div className={styles.subStepTitle}>{t(toolNameToI18nKey(tool.toolName), tool.toolName)}</div>
                        {renderTextBlock(tool.resultSummary, `synthetic-tool-result-${tool.stepId}`, 'result')}
                        {tool.errorMessage && renderTextBlock(tool.errorMessage, `synthetic-tool-error-${tool.stepId}`, 'error')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  ) : null;

  return (
    <div className={styles.wrapper}>
      <div className={styles.timeline}>
        {shouldUsePlanView ? (
          <>
            {compactRenderedPlanSteps.map((step, index) => {
              const status = planStatusToTimelineStatus(step.status);
              const hasSubSteps = step.toolSteps.length > 0;
              const canCollapse = hasPlanStepDetails(step);
              const isCollapsed = isStepCollapsed(step.planStepId, status, canCollapse);
              const showNarrative = !compact || status === 'inProgress' || status === 'error';
              const showResultSummary = !compact || status === 'inProgress' || status === 'error';

              return (
                <div key={step.planStepId} className={styles.timelineItem}>
                  {index < planItemCount - 1 && (
                    <div
                      className={[
                        styles.timelineLine,
                        status === 'inProgress' || status === 'completed' ? styles.active : '',
                        status === 'completed' ? styles.completed : '',
                        status === 'error' ? styles.error : '',
                      ].join(' ')}
                    />
                  )}

                  <div className={styles.timelineHeader}>
                    <div className={styles.timelineRail}>
                      <div className={[styles.timelineIcon, styles[status]].join(' ')}>
                        {renderStatusIcon(status)}
                      </div>
                    </div>

                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitleRow}>
                        <div className={styles.timelineTitleGroup}>
                          <div className={[styles.timelineTitle, styles[status]].join(' ')}>{step.title}</div>
                          {renderPlanStatusTag(step.status)}
                        </div>
                        {canCollapse && (
                          <button
                            type="button"
                            className={[styles.collapseToggle, isCollapsed ? styles.collapsed : styles.expanded].join(' ')}
                            onClick={() => toggleStep(step.planStepId)}
                            aria-label={
                              isCollapsed
                                ? t('workflowEditor.alkaid.expandSubSteps', '展开详情')
                                : t('workflowEditor.alkaid.collapseSubSteps', '收起详情')
                            }
                          >
                            <RoundedChevronDown />
                          </button>
                        )}
                      </div>

                      {!isCollapsed && (
                        <>
                          {showNarrative && renderTextBlock(step.reason, `desc-${step.planStepId}`, 'desc')}
                          {!compact && renderTextBlock(step.expectedOutput, `expected-${step.planStepId}`, 'meta')}
                          {showResultSummary && renderTextBlock(step.resultSummary, `summary-${step.planStepId}`, 'meta')}
                          {renderTextBlock(step.errorMessage, `error-${step.planStepId}`, 'error')}
                        </>
                      )}
                    </div>
                  </div>

                  {hasSubSteps && !isCollapsed && (
                    <div className={styles.subSteps}>
                      {step.toolSteps.map((tool) => (
                        <div key={tool.stepId} className={styles.subStepItem}>
                          <div className={styles.subStepIcon}>
                            {tool.status === 'running' ? (
                              <LoadingOutlined spin style={{ color: '#1677ff' }} />
                            ) : tool.status === 'success' ? (
                              <CheckOutlined style={{ color: '#52c41a' }} />
                            ) : tool.status === 'error' ? (
                              <CloseOutlined style={{ color: '#ff4d4f' }} />
                            ) : (
                              <ClockCircleOutlined style={{ color: '#ccc' }} />
                            )}
                          </div>
                          <div className={styles.subStepContent}>
                            <div className={styles.subStepTitle}>{t(toolNameToI18nKey(tool.toolName), tool.toolName)}</div>
                            {renderTextBlock(tool.resultSummary, `tool-result-${tool.stepId}`, 'result')}
                            {tool.errorMessage && renderTextBlock(tool.errorMessage, `tool-error-${tool.stepId}`, 'error')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {showGeneratingTimelineStep && (
              <div key="content-generating" className={styles.timelineItem}>
                <div className={styles.timelineHeader}>
                  <div className={styles.timelineRail}>
                    <div className={[styles.timelineIcon, styles.inProgress].join(' ')}>
                      {renderStatusIcon('inProgress', <FileTextOutlined />)}
                    </div>
                  </div>

                  <div className={styles.timelineContent}>
                    <div className={styles.timelineTitleRow}>
                      <div className={styles.timelineTitleGroup}>
                        <div className={[styles.timelineTitle, styles.inProgress].join(' ')}>
                          {t('workflowEditor.alkaid.contentGeneratingStep', '内容生成')}
                        </div>
                        <span className={[styles.statusTag, styles.inProgress].join(' ')}>
                          {t('workflowEditor.alkaid.generating', '生成中')}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={[styles.collapseToggle, renderingStepCollapsed ? styles.collapsed : styles.expanded].join(' ')}
                        onClick={() => toggleStep('__content_generating__')}
                        aria-label={
                          renderingStepCollapsed
                            ? t('workflowEditor.alkaid.expandSubSteps', '展开详情')
                            : t('workflowEditor.alkaid.collapseSubSteps', '收起详情')
                        }
                      >
                        <RoundedChevronDown />
                      </button>
                    </div>

                    {!renderingStepCollapsed && renderTextBlock(renderingStepSummary, 'content-generating-desc', 'desc')}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          visibleSteps.map((step, index) => {
            let status: TimelineStatus = 'pending';
            const stepTools = stepsByPipeline[step.key] || [];
            const stepHasError = stepTools.some((tool) => tool.status === 'error');
            const hasSubSteps = stepTools.length > 0;

            if (stepHasError) status = 'error';
            else if (phase === 'idle' && !currentRoundToolSteps.some((tool) => tool.status === 'error')) status = 'completed';
            else if (index < currentStepIndex) status = 'completed';
            else if (index === currentStepIndex) status = phase === 'error' ? 'error' : 'inProgress';

            const shouldShowDescription = status === 'pending' || status === 'inProgress' || status === 'error';
            const canCollapse = shouldShowDescription || hasSubSteps;
            const isCollapsed = collapsedSteps[step.key] ?? false;

            return (
              <div key={step.key} className={styles.timelineItem}>
                {index < visibleSteps.length - 1 && (
                  <div
                    className={[
                      styles.timelineLine,
                      status === 'inProgress' || status === 'completed' ? styles.active : '',
                      status === 'completed' ? styles.completed : '',
                      status === 'error' ? styles.error : '',
                    ].join(' ')}
                  />
                )}

                <div className={styles.timelineHeader}>
                  <div className={styles.timelineRail}>
                    <div className={[styles.timelineIcon, styles[status]].join(' ')}>
                      {renderStatusIcon(status, step.icon)}
                    </div>
                  </div>

                  <div className={styles.timelineContent}>
                    <div className={styles.timelineTitleRow}>
                      <div className={styles.timelineTitleGroup}>
                        <div className={[styles.timelineTitle, styles[status]].join(' ')}>{t(step.labelKey)}</div>
                        <span className={[styles.statusTag, styles[status]].join(' ')}>
                          {status === 'inProgress'
                            ? t('workflowEditor.alkaid.running', '进行中')
                            : status === 'completed'
                              ? t('workflowEditor.alkaid.completed', '已完成')
                              : status === 'error'
                                ? t('workflowEditor.alkaid.failed', '失败')
                                : t('workflowEditor.alkaid.pending', '待执行')}
                        </span>
                      </div>
                      {canCollapse && (
                        <button
                          type="button"
                          className={[styles.collapseToggle, isCollapsed ? styles.collapsed : styles.expanded].join(' ')}
                          onClick={() => toggleStep(step.key)}
                          aria-label={
                            isCollapsed
                              ? t('workflowEditor.alkaid.expandSubSteps', '展开详情')
                              : t('workflowEditor.alkaid.collapseSubSteps', '收起详情')
                          }
                        >
                          <RoundedChevronDown />
                        </button>
                      )}
                    </div>

                    {!isCollapsed && shouldShowDescription && renderTextBlock(t(step.descriptionKey), `pipeline-desc-${step.key}`, 'desc')}
                  </div>
                </div>

                {hasSubSteps && !isCollapsed && (
                  <div className={styles.subSteps}>
                    {messageIds.map((messageId, msgIndex) => {
                      const messageTools = stepTools.filter((tool) => tool.userMessageId === messageId);
                      if (messageTools.length === 0) return null;

                      const messageContent = messageTools[0]?.userMessageContent || '';
                      const truncatedContent = messageContent.length > 36 ? `${messageContent.slice(0, 36)}...` : messageContent;

                      return (
                        <div key={messageId} className={styles.messageGroup}>
                          {msgIndex > 0 && messageIds.length > 1 && (
                            <div className={styles.messageDivider}>
                              <div className={styles.dividerLine} />
                            </div>
                          )}

                          {messageIds.length > 1 && (
                            <div className={styles.messageHeader}>
                              <span className={styles.messageIcon}><CommentOutlined /></span>
                              <span className={styles.messageContent}>{truncatedContent}</span>
                            </div>
                          )}

                          {messageTools.map((tool) => (
                            <div key={tool.stepId} className={styles.subStepItem}>
                              <div className={styles.subStepIcon}>
                                {tool.status === 'running' ? (
                                  <LoadingOutlined spin style={{ color: '#1677ff' }} />
                                ) : tool.status === 'success' ? (
                                  <CheckOutlined style={{ color: '#52c41a' }} />
                                ) : tool.status === 'error' ? (
                                  <CloseOutlined style={{ color: '#ff4d4f' }} />
                                ) : (
                                  <ClockCircleOutlined style={{ color: '#ccc' }} />
                                )}
                              </div>
                              <div className={styles.subStepContent}>
                                <div className={styles.subStepTitle}>{t(toolNameToI18nKey(tool.toolName), tool.toolName)}</div>
                                {renderTextBlock(tool.resultSummary, `legacy-tool-result-${tool.stepId}`, 'result')}
                                {tool.errorMessage && renderTextBlock(tool.errorMessage, `legacy-tool-error-${tool.stepId}`, 'error')}
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {executionSection}
    </div>
  );
};

export default AlkaidProgress;

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  RocketOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import type { Phase, AgentToolStep } from '../types';
import styles from './AlkaidProgress.module.scss';

/** 圆角折叠箭头：向下，用 CSS 旋转表示收起时朝右 */
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

const PIPELINE_STEPS: PipelineStep[] = [
  {
    key: 'planning',
    labelKey: 'workflowEditor.alkaid.progressPlanning',
    descriptionKey: 'workflowEditor.alkaid.progressPlanningDesc',
    phases: ['planning'],
    icon: <CodeOutlined />
  },
  {
    key: 'generating',
    labelKey: 'workflowEditor.alkaid.progressGenerating',
    descriptionKey: 'workflowEditor.alkaid.progressGeneratingDesc',
    phases: ['generating'],
    icon: <FileTextOutlined />
  },
  {
    key: 'validating',
    labelKey: 'workflowEditor.alkaid.progressValidating',
    descriptionKey: 'workflowEditor.alkaid.progressValidatingDesc',
    phases: ['validating', 'repairing', 'running_trial'],
    icon: <SafetyCertificateOutlined />
  },
  {
    key: 'finishing',
    labelKey: 'workflowEditor.alkaid.progressFinishing',
    descriptionKey: 'workflowEditor.alkaid.progressFinishingDesc',
    phases: ['waiting_approval', 'summarizing'],
    icon: <RocketOutlined />
  }
];

interface AlkaidProgressProps {
  phase: Phase;
  toolSteps: AgentToolStep[];
  maxSteps?: number;
  collapsed?: boolean;
}

const AlkaidProgress: React.FC<AlkaidProgressProps> = ({
  phase,
  toolSteps,
}) => {
  const { t } = useTranslation();
  const [collapsedSteps, setCollapsedSteps] = useState<Record<string, boolean>>({});
  
  // 按 userMessageId 分组工具步
  const toolStepsByMessage = useMemo(() => {
    const groups: Record<number, AgentToolStep[]> = {};
    toolSteps.forEach(step => {
      if (!groups[step.userMessageId]) {
        groups[step.userMessageId] = [];
      }
      groups[step.userMessageId].push(step);
    });
    return groups;
  }, [toolSteps]);
  
  // 获取所有唯一的 userMessageId，按顺序排列
  const messageIds = useMemo(() => {
    return Object.keys(toolStepsByMessage).map(Number).sort((a, b) => a - b);
  }, [toolStepsByMessage]);
  
  // Determine the index of the current phase in our simplified pipeline
  const currentStepIndex = useMemo(() => {
    if (phase === 'idle') {
      // If idle and we have steps, usually means finished
      // But check if last tool failed
      const hasError = toolSteps.some(s => s.status === 'error');
      if (hasError) {
         // Fallback to error logic
      } else {
         return PIPELINE_STEPS.length; 
      }
    }
    
    if (phase === 'error' || (phase === 'idle' && toolSteps.some(s => s.status === 'error'))) {
       // If error, find the step where it happened
       if (toolSteps.length > 0) {
          const lastTool = toolSteps[toolSteps.length - 1];
          // Find pipeline step for this tool
          const idx = PIPELINE_STEPS.findIndex(step => step.phases.includes(lastTool.phase));
          return idx !== -1 ? idx : 0;
       }
       return 0;
    }

    // Find which pipeline step contains the current phase
    const idx = PIPELINE_STEPS.findIndex(step => step.phases.includes(phase));
    if (idx !== -1) return idx;

    // Fallback
    return 0; 
  }, [phase, toolSteps]);

  // Group tool steps by pipeline step key
  const stepsByPipeline = useMemo(() => {
    const grouped: Record<string, AgentToolStep[]> = {};
    toolSteps.forEach(step => {
      // Find which pipeline step this tool step belongs to
      const pStep = PIPELINE_STEPS.find(ps => ps.phases.includes(step.phase));
      if (pStep) {
        if (!grouped[pStep.key]) grouped[pStep.key] = [];
        grouped[pStep.key].push(step);
      } else {
        // Fallback: put in 'planning' or ignore? 
        if (!grouped['planning']) grouped['planning'] = [];
        grouped['planning'].push(step);
      }
    });
    return grouped;
  }, [toolSteps]);

  const renderStatusIcon = (status: 'pending' | 'inProgress' | 'completed' | 'skipped' | 'error', customIcon?: React.ReactNode) => {
    if (status === 'completed') {
      return <CheckOutlined style={{ fontSize: 10 }} />;
    }
    if (status === 'inProgress') {
      return <LoadingOutlined style={{ fontSize: 10 }} />;
    }
    if (status === 'error') {
      return <CloseOutlined style={{ fontSize: 10 }} />;
    }
    // Pending
    return customIcon ? React.cloneElement(customIcon as React.ReactElement, { style: { fontSize: 10 } }) : <ClockCircleOutlined style={{ fontSize: 10 }} />;
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.timeline}>
        {PIPELINE_STEPS.map((step, index) => {
          let status: 'pending' | 'inProgress' | 'completed' | 'skipped' | 'error' = 'pending';
          const stepTools = stepsByPipeline[step.key] || [];
          const stepHasError = stepTools.some(t => t.status === 'error');
          const hasSubSteps = stepTools.length > 0;
          const isCollapsed = collapsedSteps[step.key] ?? false;
          
          if (stepHasError) {
             status = 'error';
          } else if (phase === 'idle' && !toolSteps.some(s => s.status === 'error')) {
             status = 'completed';
          } else if (index < currentStepIndex) {
            status = 'completed';
          } else if (index === currentStepIndex) {
            // If global phase is error or idle-with-error, but this step didn't have tool error (maybe phase changed before tool ran?)
            // If currentStepIndex points here, it's InProgress or Error
            if (phase === 'error' || (phase === 'idle' && toolSteps.some(s => s.status === 'error'))) {
                status = 'error'; // Mark as error if we stopped here
            } else {
                status = 'inProgress';
            }
          } else {
            status = 'pending';
          }

          const isActive = status === 'inProgress';
          const isCompleted = status === 'completed';
          const isError = status === 'error';

          const toggleCollapse = () => {
            if (!hasSubSteps) return;
            setCollapsedSteps(prev => ({
              ...prev,
              [step.key]: !isCollapsed,
            }));
          };

          return (
            <div key={step.key} className={styles.timelineItem}>
              {/* Vertical Line */}
              {index < PIPELINE_STEPS.length - 1 && (
                <div 
                  className={`${styles.timelineLine} ${isActive || isCompleted ? styles.active : ''} ${isCompleted ? styles.completed : ''} ${isError ? styles.error : ''}`} 
                />
              )}

              <div
                className={styles.timelineHeader}
              >
                {/* Icon */}
                <div className={`${styles.timelineIcon} ${styles[status]}`}>
                  {renderStatusIcon(status, step.icon)}
                </div>

                {/* Text Content */}
                <div className={styles.timelineContent}>
                  <div className={styles.timelineTitleRow}>
                    <div className={`${styles.timelineTitle} ${styles[status]}`}>
                      {t(step.labelKey)}
                    </div>
                    {hasSubSteps && (
                    <button
                      type="button"
                      className={`${styles.collapseToggle} ${isCollapsed ? styles.collapsed : styles.expanded}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCollapse();
                      }}
                      aria-label={isCollapsed
                        ? t('workflowEditor.alkaid.expandSubSteps', '展开工具步骤')
                        : t('workflowEditor.alkaid.collapseSubSteps', '收起工具步骤')}
                    >
                      <RoundedChevronDown />
                    </button>
                    )}
                  </div>
                  {(status === 'pending' || isActive || isError) && (
                    <div className={styles.timelineDesc}>
                      {t(step.descriptionKey)}
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-steps (Tool Executions) - 按消息分组显示 */}
              {hasSubSteps && (
                <div
                  className={`${styles.subSteps} ${
                    isCollapsed ? styles.subStepsCollapsed : styles.subStepsExpanded
                  }`}
                >
                  {messageIds.map((messageId, msgIndex) => {
                    const messageTools = stepTools.filter(t => t.userMessageId === messageId);
                    if (messageTools.length === 0) return null;
                    
                    const messageContent = messageTools[0]?.userMessageContent || '';
                    const truncatedContent = messageContent.length > 30 
                      ? messageContent.slice(0, 30) + '...' 
                      : messageContent;
                    
                    return (
                      <div key={messageId} className={styles.messageGroup}>
                        {/* 消息分组标题 */}
                        {msgIndex > 0 && messageIds.length > 1 && (
                          <div className={styles.messageDivider}>
                            <div className={styles.dividerLine} />
                          </div>
                        )}
                        {messageIds.length > 1 && (
                          <div className={styles.messageHeader}>
                            <span className={styles.messageIcon}>💬</span>
                            <span className={styles.messageContent}>{truncatedContent}</span>
                          </div>
                        )}
                        
                        {/* 该消息的工具步 */}
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
                              <div className={styles.subStepTitle}>
                                <span>{tool.toolName}</span>
                              </div>
                              {tool.resultSummary && (
                                <div className={styles.subStepResult}>
                                  {tool.resultSummary}
                                </div>
                              )}
                              {tool.errorMessage && (
                                <div className={styles.subStepResult} style={{ color: '#ff4d4f' }}>
                                  {tool.errorMessage}
                                </div>
                              )}
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
        })}
      </div>
    </div>
  );
};

export default AlkaidProgress;

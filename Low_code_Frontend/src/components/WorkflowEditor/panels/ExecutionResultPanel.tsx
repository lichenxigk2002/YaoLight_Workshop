import React, { useMemo, useState, useEffect } from 'react';
import { Collapse, Empty, Tag, Typography, Button, Space, Modal, App } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
  CloseOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '../utils/MarkdownRenderer';
import { ProviderIcon, MessageIcon, CollapseIcon } from '@/components/Icons';
import { AIPreviewModal } from './components/AIPreviewModal';
import { CrawlerPreviewModal } from './components/CrawlerPreviewModal';
import styles from './ExecutionResultPanel.module.scss';

const { Text, Paragraph } = Typography;

interface NodeExecutionResult {
  node_id: string;
  type: string;
  success: boolean;
  data: any;
  error?: string;
}

interface ExecutionResult {
  success: boolean;
  results: NodeExecutionResult[];
  error?: string;
}

interface ExecutionResultPanelProps {
  visible: boolean;
  onClose: () => void;
  result: ExecutionResult | null;
  nodes: any[];
  onCancel?: () => void; // 取消执行的回调函数
  isExecuting?: boolean; // 是否正在执行中
}

const ExecutionResultPanel: React.FC<ExecutionResultPanelProps> = ({
  onClose,
  result,
  nodes,
  onCancel,
  isExecuting = false,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, { reasoning: boolean; content: boolean }>>({});
  const [previewTarget, setPreviewTarget] = useState<NodeExecutionResult | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // 当结果更新时，自动展开AI节点（如果正在流式输出）
  useEffect(() => {
    if (result && result.results) {
      const aiNodes = result.results.filter((r: any) => r.type === 'ai' && r.success);
      if (aiNodes.length > 0) {
        // 自动展开AI节点，方便查看流式内容
        const aiNodeIds = aiNodes.map((r: any) => r.node_id);
        setActiveKeys((prev) => {
          const newKeys = [...prev];
          aiNodeIds.forEach((id: string) => {
            if (!newKeys.includes(id)) {
              newKeys.push(id);
            }
          });
          return newKeys;
        });
      }
    }
  }, [result]);

  // 获取节点名称
  const getNodeLabel = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId);
    return node?.data?.label || nodeId;
  };

  const previewNodeConfig = useMemo(() => {
    if (!previewTarget) return undefined;
    const node = nodes.find((n) => n.id === previewTarget.node_id);
    return node?.data?.config;
  }, [nodes, previewTarget]);

  const aiPreview = useMemo(() => {
    if (!result || !previewTarget || previewTarget.type !== 'ai') return null;
    const ai = previewTarget;
    const previewData = { ai, raw: result, isStreaming: false };
    return {
      open: previewOpen,
      onClose: () => {
        setPreviewOpen(false);
        setPreviewTarget(null);
      },
      aiTest: {
        previewOpen,
        setPreviewOpen: (open: boolean) => {
          setPreviewOpen(open);
          if (!open) setPreviewTarget(null);
        },
        previewData,
        streamingContent: '',
        streamingReasoningContent: '',
        isStreaming: false,
        isReasoningStreaming: false,
        cancelStream: () => {},
      },
    };
  }, [previewOpen, previewTarget, result]);

  const crawlerPreview = useMemo(() => {
    if (!result || !previewTarget || previewTarget.type !== 'crawler') return null;
    const crawler = previewTarget;
    const previewData = { crawler, raw: result };
    return {
      open: previewOpen,
      onClose: () => {
        setPreviewOpen(false);
        setPreviewTarget(null);
      },
      crawlerTest: {
        previewOpen,
        setPreviewOpen: (open: boolean) => {
          setPreviewOpen(open);
          if (!open) setPreviewTarget(null);
        },
        previewData,
      },
    };
  }, [previewOpen, previewTarget, result]);

  const rawPreview = useMemo(() => {
    if (!previewTarget) return null;
    if (previewTarget.type === 'ai' || previewTarget.type === 'crawler') return null;
    return {
      open: previewOpen,
      onClose: () => {
        setPreviewOpen(false);
        setPreviewTarget(null);
      },
      title: `${getNodeLabel(previewTarget.node_id)} 预览`,
      data: previewTarget.data,
      success: previewTarget.success,
      error: previewTarget.error,
    };
  }, [previewOpen, previewTarget]);

  // 获取节点类型标签
  const getNodeTypeLabel = (type: string): string => {
    return t(`node.shortLabels.${type}`, type);
  };

  // 复制数据到剪贴板
  const copyToClipboard = (data: any) => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      message.success(t('node.execution.copied'));
    });
  };

  // 下载数据为JSON文件
  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 渲染数据预览
  const renderDataPreview = (data: any, nodeType: string, nodeId?: string) => {
    if (!data) {
      return <Empty description={t('node.execution.noData')} image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    }

    // 如果是爬虫节点，特殊处理
    if (nodeType === 'crawler') {
      return (
        <div className={styles.dataPreview}>
          <div className={styles.dataStats}>
            {data.count !== undefined && (
              <Tag color="blue">{t('node.execution.extractedItems')}: {data.count}</Tag>
            )}
            {data.mode && (
              <Tag color="green">{t('node.execution.mode')}: {data.mode}</Tag>
            )}
            {data.selector_used && (
              <Tag color="purple">{t('node.execution.selector')}: {data.selector_used}</Tag>
            )}
          </div>

          {/* 文本预览 */}
          {data.text && (
            <div className={styles.textPreview}>
              <Text strong>{t('node.execution.textContent')}：</Text>
              <Paragraph ellipsis={{ rows: 5, expandable: true, symbol: t('node.execution.expand') }}>
                {typeof data.text === 'string' ? data.text : JSON.stringify(data.text)}
              </Paragraph>
            </div>
          )}

          {/* 数据列表 */}
          {data.data && Array.isArray(data.data) && (
            <div className={styles.listPreview}>
              <Text strong>{t('node.execution.extractedData', { count: data.data.length })}：</Text>
              <div className={styles.listItems}>
                {data.data.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className={styles.listItem}>
                    <Text type="secondary">#{index + 1}</Text>
                    <Paragraph ellipsis={{ rows: 2 }}>
                      {typeof item === 'string' ? item : JSON.stringify(item)}
                    </Paragraph>
                  </div>
                ))}
                {data.data.length > 5 && (
                  <Text type="secondary">... {t('node.execution.moreItems', { count: data.data.length - 5 })}</Text>
                )}
              </div>
            </div>
          )}

          {/* 链接列表 */}
          {data.links && Array.isArray(data.links) && (
            <div className={styles.linksPreview}>
              <Text strong>{t('node.execution.linkList', { count: data.links.length })}：</Text>
              <div className={styles.linkItems}>
                {data.links.slice(0, 10).map((link: any, index: number) => (
                  <div key={index} className={styles.linkItem}>
                    <a href={link.link} target="_blank" rel="noopener noreferrer">
                      {link.text || link.link}
                    </a>
                  </div>
                ))}
                {data.links.length > 10 && (
                  <Text type="secondary">... {t('node.execution.moreLinks', { count: data.links.length - 10 })}</Text>
                )}
              </div>
            </div>
          )}

          {/* 图片列表 */}
          {data.images && Array.isArray(data.images) && (
            <div className={styles.imagesPreview}>
              <Text strong>{t('node.execution.imageList', { count: data.images.length })}：</Text>
              <div className={styles.imageItems}>
                {data.images.slice(0, 6).map((img: any, index: number) => (
                  <div key={index} className={styles.imageItem}>
                    <img src={img.src} alt={img.alt || `Image ${index + 1}`} />
                    {img.alt && <Text type="secondary">{img.alt}</Text>}
                  </div>
                ))}
                {data.images.length > 6 && (
                  <Text type="secondary">... {t('node.execution.moreImages', { count: data.images.length - 6 })}</Text>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // AI节点，支持流式内容显示
    if (nodeType === 'ai') {
      const content = data.content || data.result || '';
      // 确保 reasoningContent 是字符串类型
      const reasoningContent = typeof data.reasoningContent === 'string' 
        ? data.reasoningContent 
        : (data.reasoningContent ? String(data.reasoningContent) : '');
      const hasReasoning = reasoningContent && typeof reasoningContent === 'string' && reasoningContent.trim() !== '';

      // 获取当前节点的展开状态（默认都展开）
      const currentNodeId = nodeId || (data as any).node_id || '';
      const sectionState = expandedSections[currentNodeId] || { reasoning: true, content: true };

      const toggleSection = (section: 'reasoning' | 'content') => {
        setExpandedSections(prev => ({
          ...prev,
          [currentNodeId]: {
            ...prev[currentNodeId],
            [section]: !(prev[currentNodeId]?.[section] ?? true),
          },
        }));
      };

      return (
        <div className={styles.dataPreview}>
          {/* 如果有思考内容，显示思考过程 */}
          {hasReasoning && (
            <div className={styles.reasoningSection}>
              <div
                className={styles.sectionHeader}
                onClick={() => toggleSection('reasoning')}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <Text strong className={styles.sectionTitle}>
                  <svg
                    className="icon"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 6 }}
                  >
                    <path d="M377.75872 215.00928c27.29472-79.90784 137.69728-82.304 170.05056-7.26528l2.74944 7.296 36.83328 107.74528a182.62016 182.62016 0 0 0 103.90528 110.08l9.91744 3.68128L808.96 473.344c79.872 27.29472 82.304 137.69728 7.296 170.08128L808.96 646.144l-107.74528 36.83328a182.50752 182.50752 0 0 0-110.11072 103.90528l-3.712 9.88672-36.80256 107.776c-27.29472 79.90272-137.66144 82.304-170.01472 7.296l-2.816-7.296-36.79744-107.74528A182.54848 182.54848 0 0 0 237.056 686.68928l-9.856-3.712-107.74528-36.80256c-79.93344-27.29472-82.36544-137.66144-7.296-169.984l7.296-2.84672 107.74528-36.80256a182.5792 182.5792 0 0 0 110.08-103.90016l3.68128-9.856 36.79744-107.776z m86.4 29.50144L427.3664 352.22528a273.92 273.92 0 0 1-159.29856 166.58944l-11.42272 4.16256-107.74528 36.79744 107.74528 36.80256a273.87392 273.87392 0 0 1 166.58944 159.32416l4.16256 11.42784 36.79744 107.70944 36.80256-107.70944a273.95072 273.95072 0 0 1 159.32928-166.59456l11.392-4.12672 107.74016-36.83328-107.74016-36.79744a273.94048 273.94048 0 0 1-166.59456-159.32928l-4.096-11.42272-36.83328-107.71456h-0.03072zM829.44 57.6a45.6704 45.6704 0 0 1 40.99072 25.56928l2.20672 5.34528 15.96928 46.81216 46.87872 16a45.6448 45.6448 0 0 1 30.848 40.31488 45.70112 45.70112 0 0 1-25.472 43.90912l-5.376 2.176-46.848 16-15.96416 46.88384a45.62944 45.62944 0 0 1-84.224 5.34016l-2.21184-5.34528-15.96416-46.848-46.88384-15.99488a45.6704 45.6704 0 0 1-5.40672-84.19328l5.40672-2.20672 46.848-16 15.96928-46.848a45.6704 45.6704 0 0 1 43.20256-30.91456H829.44z" fill="currentColor"></path>
                  </svg>
                  思考过程：
                </Text>
                <CollapseIcon expanded={sectionState.reasoning} size={16} />
              </div>
              {sectionState.reasoning && (
                <div className={styles.reasoningContent}>
                  <MarkdownRenderer content={reasoningContent} />
                </div>
              )}
            </div>
          )}

          {/* 显示正式回答 */}
          <div className={styles.contentSection}>
            <div
              className={styles.sectionHeader}
              onClick={() => toggleSection('content')}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <Text strong className={styles.sectionTitle}>
                <MessageIcon size={16} style={{ marginRight: 6 }} />
                {hasReasoning ? '正式回答：' : '回答：'}
              </Text>
              <CollapseIcon expanded={sectionState.content} size={16} />
            </div>
            {sectionState.content && (
              <div className={styles.contentArea}>
                {content ? (
                  <MarkdownRenderer content={content} />
                ) : null}
              </div>
            )}
          </div>

          {/* 显示元数据 */}
          {(data.model || data.tokensUsed) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {data.model && (
                <Tag color="blue">模型: {data.model}</Tag>
              )}
              {data.tokensUsed && (
                <Tag color="green">Token数: {data.tokensUsed}</Tag>
              )}
            </div>
          )}
        </div>
      );
    }

    // 数据清洗节点
    if (nodeType === 'dataclean') {
      return (
        <div className={styles.dataPreview}>
          {/* 显示清洗后的数据 */}
          {typeof data === 'string' ? (
            <Paragraph ellipsis={{ rows: 10, expandable: true, symbol: '展开' }}>
              {data}
            </Paragraph>
          ) : (
            <pre className={styles.jsonDisplay}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    // 其他节点，使用代码块展示JSON
    return (
      <pre className={styles.jsonDisplay}>
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  if (!result) {
    return null;
  }

  return (
    <div
      className={styles.panelContainer}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      {/* 头部 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{t('node.execution.result')}</span>
          {isExecuting ? (
            <Tag color="processing">执行中</Tag>
          ) : result.success ? (
            <Tag color="success">{t('node.execution.success')}</Tag>
          ) : (
            <Tag color="error">{t('node.execution.failed')}</Tag>
          )}
        </div>
        <Space>
          {isExecuting && onCancel && (
            <Button
              type="default"
              danger
              size="small"
              icon={<StopOutlined />}
              onClick={() => {
                onCancel();
                message.info('正在中止执行...');
              }}
            >
              中止
            </Button>
          )}
          <Button
            type="text"
            icon={<CloseOutlined style={{ color: 'var(--text-primary)' }} />}
            onClick={onClose}
          />
        </Space>
      </div>

      {/* 内容区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      }} className={styles.panelScroll}>
        {result.results.length === 0 ? (
          <Empty description={t('node.execution.noResult')} />
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            className={styles.resultCollapse}
            items={result.results.map((nodeResult) => {
              const nodeLabel = getNodeLabel(nodeResult.node_id);
              const header = (
                <div className={styles.panelHeader}>
                  <div className={styles.headerLeft}>
                    {nodeResult.success ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: '#f5222d' }} />
                    )}
                    <span className={styles.nodeLabel} title={nodeLabel}>
                      {nodeLabel}
                    </span>
                    <span className={styles.typeBadge}>
                      {nodeResult.type === 'ai'
                        ? (() => {
                            const node = nodes.find((n) => n.id === nodeResult.node_id);
                            const modelName =
                              nodeResult.data?.model || node?.data?.config?.modelName || '';
                            let provider = '';
                            if (modelName.toLowerCase().includes('deepseek')) {
                              provider = 'deepseek';
                            } else if (
                              modelName.toLowerCase().includes('doubao') ||
                              modelName.toLowerCase().includes('seed')
                            ) {
                              provider = 'doubao';
                            } else if (modelName.toLowerCase().includes('qwen')) {
                              provider = 'qianwen';
                            }
                            if (!provider && node?.data?.config?.provider) {
                              provider = node.data.config.provider.toLowerCase();
                            }
                            return provider ? (
                              <ProviderIcon provider={provider} size={14} />
                            ) : (
                              <Tag color={nodeResult.success ? 'success' : 'error'}>
                                {getNodeTypeLabel(nodeResult.type)}
                              </Tag>
                            );
                          })()
                        : (
                          <Tag color={nodeResult.success ? 'success' : 'error'}>
                            {getNodeTypeLabel(nodeResult.type)}
                          </Tag>
                        )}
                    </span>
                  </div>
                </div>
              );

              const extra = (
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      setPreviewTarget(nodeResult);
                      setPreviewOpen(true);
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(nodeResult.data)}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      downloadAsJson(
                        nodeResult.data,
                        `${getNodeLabel(nodeResult.node_id)}_result.json`
                      )
                    }
                  />
                </Space>
              );

              const children = nodeResult.success ? (
                renderDataPreview(nodeResult.data, nodeResult.type, nodeResult.node_id)
              ) : (
                <div className={styles.errorMessage}>
                  <Text type="danger">{nodeResult.error || t('node.execution.execFailed')}</Text>
                </div>
              );

              return {
                key: nodeResult.node_id,
                label: header,
                extra,
                children,
              };
            })}
          />
        )}
      </div>

      {aiPreview && (
        <AIPreviewModal
          open={aiPreview.open}
          onClose={aiPreview.onClose}
          aiTest={aiPreview.aiTest}
          nodeConfig={previewNodeConfig}
        />
      )}

      {crawlerPreview && (
        <CrawlerPreviewModal
          open={crawlerPreview.open}
          onClose={crawlerPreview.onClose}
          crawlerTest={crawlerPreview.crawlerTest}
        />
      )}

      {rawPreview && (
        <Modal
          title={rawPreview.title}
          open={rawPreview.open}
          onCancel={rawPreview.onClose}
          footer={null}
          width={700}
          centered
          maskClosable={false}
          styles={{ body: { padding: '12px 24px 24px' } }}
        >
          {!rawPreview.success && rawPreview.error ? (
            <div style={{ marginBottom: 12 }}>
              <Text type="danger">{rawPreview.error}</Text>
            </div>
          ) : null}
          <pre className={styles.jsonDisplay}>
            {JSON.stringify(rawPreview.data, null, 2)}
          </pre>
        </Modal>
      )}
    </div>
  );
};

export default ExecutionResultPanel;


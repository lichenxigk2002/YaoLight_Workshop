import React, { useState, useEffect } from 'react';
import { Collapse, Empty, Tag, Typography, Button, Space, message } from 'antd';
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
import { ProviderIcon } from '@/components/Icons';
import styles from './ExecutionResultPanel.module.scss';

const { Panel } = Collapse;
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
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

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
  const renderDataPreview = (data: any, nodeType: string) => {
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
      const reasoningContent = data.reasoningContent || '';
      const hasReasoning = reasoningContent && reasoningContent.trim() !== '';

      return (
        <div className={styles.dataPreview}>
          {/* 如果有思考内容，显示思考过程 */}
          {hasReasoning && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                思考过程：
              </Text>
              <div style={{
                padding: 12,
                background: 'var(--bg-tertiary)',
                borderRadius: 4,
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                <MarkdownRenderer content={reasoningContent} />
              </div>
            </div>
          )}

          {/* 显示正式回答 */}
          <div>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              {hasReasoning ? '正式回答：' : '回答：'}
            </Text>
            <div style={{
              padding: 12,
              background: 'var(--bg-secondary)',
              borderRadius: 4,
              minHeight: '100px'
            }}>
              {content ? (
                <MarkdownRenderer content={content} />
              ) : (
                <Text type="secondary">等待AI响应...</Text>
              )}
            </div>
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
      }}>
        {result.results.length === 0 ? (
          <Empty description={t('node.execution.noResult')} />
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            className={styles.resultCollapse}
          >
            {result.results.map((nodeResult) => (
              <Panel
                key={nodeResult.node_id}
                header={
                  <div className={styles.panelHeader}>
                    <Space>
                      {nodeResult.success ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: '#f5222d' }} />
                      )}
                      <span className={styles.nodeLabel}>
                        {getNodeLabel(nodeResult.node_id)}
                      </span>
                      {nodeResult.type === 'ai' ? (
                        // AI节点只显示图标，不显示文字，不使用 Tag 背景
                        (() => {
                          // 从节点数据中获取模型信息，推断提供商
                          const node = nodes.find((n) => n.id === nodeResult.node_id);
                          const modelName = nodeResult.data?.model || node?.data?.config?.modelName || '';
                          let provider = '';
                          if (modelName.toLowerCase().includes('deepseek')) {
                            provider = 'deepseek';
                          } else if (modelName.toLowerCase().includes('doubao') || modelName.toLowerCase().includes('seed')) {
                            provider = 'doubao';
                          }
                          // 如果无法从模型名称推断，尝试从配置中获取
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
                      ) : (
                        <Tag color={nodeResult.success ? 'success' : 'error'}>
                          {getNodeTypeLabel(nodeResult.type)}
                        </Tag>
                      )}
                    </Space>
                  </div>
                }
                extra={
                  <Space onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="text"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => {
                        if (activeKeys.includes(nodeResult.node_id)) {
                          setActiveKeys(activeKeys.filter((k) => k !== nodeResult.node_id));
                        } else {
                          setActiveKeys([...activeKeys, nodeResult.node_id]);
                        }
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
                }
              >
                {nodeResult.success ? (
                  renderDataPreview(nodeResult.data, nodeResult.type)
                ) : (
                  <div className={styles.errorMessage}>
                    <Text type="danger">{nodeResult.error || t('node.execution.execFailed')}</Text>
                  </div>
                )}
              </Panel>
            ))}
          </Collapse>
        )}
      </div>
    </div>
  );
};

export default ExecutionResultPanel;


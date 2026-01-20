import React from 'react';
import { Modal, Tabs, Typography, Tag, Button } from 'antd';
import { MarkdownRenderer } from '../../utils/MarkdownRenderer';
import { StreamingLoader } from './StreamingLoader';
import { ProviderIcon } from '@/components/Icons';
import { CodeBlock } from '@/components/CodeBlock';
import styles from './AIPreviewModal.module.scss';

const { Text } = Typography;

// 思考内容组件（支持流式输出和自动滚动）
const ThinkingContentDetails: React.FC<{
  displayReasoningContent: string;
  isStreaming: boolean;
  isReasoningStreaming: boolean; // 思考内容是否正在流式输出
  styles: any;
}> = ({ displayReasoningContent, isStreaming, isReasoningStreaming, styles }) => {
  const contentRef = React.useRef<HTMLDivElement>(null);

  // 当内容更新时自动滚动到底部
  React.useEffect(() => {
    if (contentRef.current && isReasoningStreaming) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [displayReasoningContent, isReasoningStreaming]);

  // 确定状态文本：等待中 -> 正在思考 -> 已思考
  let statusText = '已思考';
  if (isReasoningStreaming) {
    // 正在输出思考内容
    statusText = '正在思考';
  } else if (isStreaming && !displayReasoningContent) {
    // 流式输出中，但还没有收到思考内容
    statusText = '等待中';
  } else if (displayReasoningContent) {
    // 有思考内容，但不在流式输出状态
    statusText = '已思考';
  }

  // 只有"正在思考"状态时才应用流光动画（必须同时满足：isReasoningStreaming === true）
  const shouldAnimate = isReasoningStreaming === true;

  return (
    <details style={{ marginBottom: 16 }} open={isReasoningStreaming || isStreaming}>
      <summary className={styles.thoughtStatus}>
        <svg className={`${styles.thinkingIcon} ${shouldAnimate ? styles.shimmer : ''}`} viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
          <path d="M346.197333 634.453333C267.605333 518.997333 209.92 402.773333 180.736 307.370667c-14.421333-47.445333-22.613333-91.989333-21.333333-129.962667 1.109333-36.949333 11.690667-76.117333 43.861333-99.328C235.946667 54.613333 275.882667 58.197333 310.613333 70.058667c35.413333 12.288 73.984 36.181333 113.152 67.242666a40.106667 40.106667 0 0 1 15.274667 26.965334 41.642667 41.642667 0 0 1-7.936 30.208 39.68 39.68 0 0 1-26.453333 15.36 38.4 38.4 0 0 1-29.184-8.533334c-35.413333-28.16-66.133333-46.08-90.026667-54.442666-24.746667-8.533333-34.304-4.266667-37.034667-2.389334-2.56 1.877333-9.472 9.386667-10.24 35.669334-0.853333 25.173333 4.693333 60.074667 17.834667 102.997333 26.026667 85.589333 79.36 194.304 154.709333 304.810667 75.178667 110.506667 156.245333 199.338667 225.536 253.781333 34.816 27.306667 64.682667 44.714667 88.064 52.650667 24.149333 8.106667 33.536 3.925333 36.010667 2.048 2.048-1.450667 6.570667-5.973333 9.045333-20.48 2.56-14.592 2.133333-35.584-2.901333-63.232-9.813333-54.954667-35.925333-127.146667-77.312-207.530667a41.386667 41.386667 0 0 1 16.469333-54.698667 38.570667 38.570667 0 0 1 53.248 16.896c43.349333 84.48 73.216 164.778667 85.077334 230.656 5.888 32.938667 7.68 64.341333 2.986666 91.904-4.778667 27.733333-16.725333 55.04-41.386666 72.874667-32.256 23.210667-71.68 19.968-105.813334 8.448-34.986667-11.861333-72.96-34.986667-111.445333-65.194667-77.141333-60.757333-163.584-156.16-242.090667-271.616z" />
          <path d="M357.973333 410.624c66.730667-118.954667 143.701333-218.88 215.04-284.074667 35.669333-32.426667 71.509333-57.685333 105.557334-71.68C712.192 41.130667 750.933333 35.84 784.725333 55.978667c36.693333 21.845333 51.2 63.658667 55.125334 104.277333 4.010667 41.813333-1.792 92.16-14.762667 146.176a40.533333 40.533333 0 0 1-16.213333 23.893333 38.485333 38.485333 0 0 1-52.053334-7.509333 41.216 41.216 0 0 1-9.301333-27.477333l1.109333-8.106667 7.424-35.413333c5.888-33.536 7.424-61.696 5.376-83.541334-2.901333-30.208-11.776-39.68-16.128-42.154666-3.925333-2.389333-14.506667-5.461333-37.546666 4.010666-22.357333 9.216-50.602667 28.074667-82.517334 57.173334-63.488 57.941333-135.253333 150.357333-198.997333 263.850666-63.829333 113.493333-105.642667 223.573333-122.624 309.248-8.533333 42.922667-10.325333 77.482667-6.826667 102.058667 3.413333 25.173333 11.349333 33.109333 15.36 35.413333 3.669333 2.218667 12.8 4.949333 32.426667-2.048 19.456-6.997333 44.202667-22.101333 72.789333-46.250666a38.570667 38.570667 0 0 1 54.784 6.229333 41.301333 41.301333 0 0 1-4.778666 56.405333l-24.490667 19.370667a287.744 287.744 0 0 1-72.448 40.704c-31.317333 11.264-66.56 14.250667-97.621333-4.266667-33.877333-19.968-48.896-57.088-54.016-93.866666-5.290667-37.376-1.877333-82.090667 7.594666-129.962667 19.114667-96.170667 64.853333-214.613333 131.584-333.568z" />
          <path d="M512 386.133333c132.778667 0 254.293333 13.824 343.893333 37.205334 44.373333 11.52 83.2 25.941333 111.786667 43.52 26.112 16.042667 56.32 42.666667 56.32 82.517333 0 36.266667-25.088 61.610667-48.042667 77.226667-24.405333 16.725333-57.258667 30.634667-94.72 41.813333a38.4 38.4 0 0 1-30.037333-3.328 40.277333 40.277333 0 0 1-18.773333-24.149333 41.557333 41.557333 0 0 1 3.242666-30.805334 39.594667 39.594667 0 0 1 23.466667-19.456c33.877333-10.24 58.197333-21.162667 73.130667-31.488a55.978667 55.978667 0 0 0 11.349333-9.728 66.816 66.816 0 0 0-16.213333-12.970666c-19.370667-11.946667-49.749333-23.893333-90.88-34.645334-81.493333-21.162667-196.266667-34.645333-324.522667-34.645333-128.256 0-243.029333 13.568-324.522667 34.730667-41.130667 10.666667-71.509333 22.784-90.709333 34.56a66.048 66.048 0 0 0-16.384 12.970666 64.853333 64.853333 0 0 0 15.274667 12.458667c18.261333 11.52 47.445333 23.381333 87.04 33.877333l-10.069334 39.253334-9.898666 39.253333C119.808 662.613333 82.432 648.192 54.613333 630.869333 29.184 614.997333 0 588.8 0 549.546667c0-39.850667 30.208-66.474667 56.32-82.517334 28.586667-17.578667 67.413333-32.085333 111.786667-43.52 89.6-23.381333 211.2-37.290667 343.893333-37.290666zM210.858667 645.12a40.96 40.96 0 0 1-18.176 24.746667 38.656 38.656 0 0 1-29.866667 4.266666l19.882667-78.336a38.741333 38.741333 0 0 1 24.064 18.602667 41.301333 41.301333 0 0 1 4.096 30.72z" />
        </svg>
        <span>{statusText}</span>
      </summary>
      <div ref={contentRef} className={styles.reasoningContentContainer}>
        {displayReasoningContent ? (
          <MarkdownRenderer
            key={`reasoning-stream-${displayReasoningContent.length}`}
            content={displayReasoningContent}
          />
        ) : (
          <div style={{ padding: 8, color: 'var(--text-tertiary)', fontSize: 12 }}>
            等待思考内容...
          </div>
        )}
      </div>
    </details>
  );
};

interface AIPreviewModalProps {
  open: boolean;
  onClose: () => void;
  aiTest: {
    previewOpen: boolean;
    setPreviewOpen: (open: boolean) => void;
    previewData: any;
    streamingContent: string;
    streamingReasoningContent: string;
    isStreaming: boolean;
    isReasoningStreaming?: boolean; // 思考内容流式状态
    cancelStream: () => void;
  };
  nodeConfig?: {
    thinking?: boolean; // 深度思考开关状态
    thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high'; // 豆包思考长度
    provider?: string; // 提供商名称
  };
}

/**
 * AI节点预览模态框组件
 */
export const AIPreviewModal: React.FC<AIPreviewModalProps> = ({
  open,
  onClose,
  aiTest,
  nodeConfig,
}) => {
  // 检查是否启用了深度思考
  // 对于豆包，默认开启思考，所以如果有思考内容或者配置中有 thinkingLevel，就显示思考面板
  // 对于其他模型（如 DeepSeek），需要明确开启 thinking 才显示
  const hasThinkingConfig = nodeConfig?.thinking === true || nodeConfig?.thinkingLevel !== undefined;
  const hasReasoningContent = aiTest.streamingReasoningContent || aiTest.previewData?.streamingReasoningContent ||
    (aiTest.previewData?.ai?.data?.reasoningContent);
  const isThinkingEnabled = hasThinkingConfig || hasReasoningContent;
  // 跟踪当前激活的标签页
  const [activeTab, setActiveTab] = React.useState<string>('result');

  // 所有 hooks 必须在早期返回之前调用
  const aiData = aiTest.previewData?.ai;
  const aiResult = aiData?.data || aiData?.value || aiData;

  // 使用 useMemo 确保 displayContent 正确计算并响应 streamingContent 的变化
  const displayContent = React.useMemo(() => {
    // 如果没有 previewData，返回空字符串
    if (!aiTest.previewData) {
      return '';
    }
    // 优先使用 streamingContent（流式输出时实时显示）
    // 同时检查 aiTest.streamingContent 和 previewData.streamingContent
    const streamingContent = aiTest.streamingContent || aiTest.previewData?.streamingContent || '';
    if (streamingContent) {
      return streamingContent;
    }
    // 如果 streamingContent 为空，再从 aiResult 中提取
    if (aiResult) {
      if (typeof aiResult === 'object' && aiResult !== null && 'content' in aiResult) {
        return String(aiResult.content || '');
      } else if (typeof aiResult === 'string') {
        return aiResult;
      } else {
        return JSON.stringify(aiResult, null, 2);
      }
    }
    return '';
  }, [aiTest.previewData, aiTest.streamingContent, aiTest.previewData?.streamingContent, aiResult]);

  const displayReasoningContent = React.useMemo(() => {
    // 如果没有 previewData，返回空字符串
    if (!aiTest.previewData) {
      return '';
    }
    if (aiTest.isStreaming) {
      return aiTest.streamingReasoningContent || '';
    } else {
      if (aiTest.streamingReasoningContent) {
        return aiTest.streamingReasoningContent;
      }
      if (aiResult && typeof aiResult === 'object' && aiResult !== null && 'reasoningContent' in aiResult) {
        return String(aiResult.reasoningContent || '');
      }
    }
    return '';
  }, [aiTest.previewData, aiTest.isStreaming, aiTest.streamingReasoningContent, aiResult]);

  const metadata = React.useMemo(() => {
    if (aiResult && typeof aiResult === 'object' && aiResult !== null) {
      return {
        model: aiResult.model,
        tokensUsed: aiResult.tokensUsed,
      };
    }
    return null;
  }, [aiResult]);


  // 早期返回必须在所有 hooks 之后
  if (!aiTest.previewData) {
    return (
      <Modal
        title="AI节点测试结果"
        open={open}
        onCancel={onClose}
        footer={null}
        width={700}
        centered
        maskClosable={false}
        styles={{ body: { padding: '0 24px 24px' } }}
      >
        <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
          暂无测试数据
        </div>
      </Modal>
    );
  }

  // 构建标签页列表，只有启用深度思考时才包含"思考过程"标签页
  const items = [
    {
      key: 'result',
      label: '正式回答',
      children: (
        <div style={{ maxHeight: '60vh', overflow: 'hidden' }}>
          <div className={styles.statusContainer}>
            <Text type="secondary" className={styles.statusTitle}>
              执行状态
            </Text>
            <div className={styles.statusContent}>
              <div>
                <Text style={{ marginRight: 8, fontSize: 13 }}>AI节点</Text>
                {aiTest.isStreaming ? (
                  <Tag color="processing">流式输出中...</Tag>
                ) : (
                  <Tag color={aiData?.success ? 'success' : 'error'}>
                    {aiData?.success ? '成功' : '失败'}
                  </Tag>
                )}
              </div>
              {metadata && metadata.model && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    模型:
                  </Text>
                  {/* 从模型名称或节点配置推断提供商 */}
                  {(() => {
                    const modelName = metadata.model || '';
                    // 优先从节点配置获取提供商
                    let provider = nodeConfig?.provider?.toLowerCase() || '';
                    // 如果配置中没有，从模型名称推断
                    if (!provider) {
                      if (modelName.toLowerCase().includes('deepseek')) {
                        provider = 'deepseek';
                      } else if (modelName.toLowerCase().includes('doubao') || modelName.toLowerCase().includes('seed')) {
                        provider = 'doubao';
                      } else if (modelName.toLowerCase().includes('qwen')) {
                        provider = 'qianwen';
                      } else if (modelName.toLowerCase().includes('glm') || modelName.toLowerCase().includes('zhipuai')) {
                        provider = 'zhipuai';
                      } else if (modelName.toLowerCase().includes('spark')) {
                        provider = 'spark';
                      } else if (modelName.toLowerCase().includes('hunyuan')) {
                        provider = 'hunyuan';
                      }
                    }
                    return provider ? (
                      <>
                        <ProviderIcon provider={provider} size={14} />
                        <Text style={{ fontSize: 12 }}>{metadata.model}</Text>
                      </>
                    ) : (
                      <Text style={{ fontSize: 12 }}>{metadata.model}</Text>
                    );
                  })()}
                </div>
              )}
              {metadata && metadata.tokensUsed && (
                <div>
                  <Text type="secondary" style={{ marginRight: 8, fontSize: 12 }}>
                    Token数:
                  </Text>
                  <Text style={{ fontSize: 12 }}>{metadata.tokensUsed}</Text>
                </div>
              )}
              {aiTest.isStreaming && (
                <Button
                  size="small"
                  danger
                  onClick={aiTest.cancelStream}
                  style={{ marginLeft: 'auto' }}
                >
                  取消
                </Button>
              )}
            </div>
            {aiData?.error && (
              <div className={styles.errorContainer}>
                <Text type="danger" style={{ fontSize: 12 }}>
                  {aiData.error}
                </Text>
              </div>
            )}
          </div>
          <div className={styles.contentBox}>
            {/* 正式回答中的思考过程展示 - 只有启用深度思考时才显示 */}
            {isThinkingEnabled && (displayReasoningContent || aiTest.isStreaming) && (
              <ThinkingContentDetails
                displayReasoningContent={displayReasoningContent}
                isStreaming={aiTest.isStreaming} // 整体流式状态
                isReasoningStreaming={aiTest.isReasoningStreaming ?? false} // 思考内容的流式状态
                styles={styles}
              />
            )}

            {/* 实时显示AI正式回答 */}
            <div
              className={`${styles.contentArea} ${displayContent ? styles.hasContent : ''}`}
            >
              {displayContent && displayContent.trim() ? (
                <>
                  <MarkdownRenderer
                    key={`content-${displayContent.length}`}
                    content={displayContent}
                  />
                  {/* 在内容底部添加三行空行 */}
                  <div className={styles.emptySpacer}></div>
                </>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                  {aiTest.isStreaming ? '' : '暂无内容'}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    },
    // 只有启用深度思考时才显示"思考过程"标签页
    ...(isThinkingEnabled ? [{
      key: 'reasoning',
      label: '思考过程',
      children: (
        <div style={{ maxHeight: '60vh', overflow: 'hidden' }}>
          {/* 深度思考标识 - 有思考内容或正在流式输出时显示 */}
          {(displayReasoningContent || (aiTest.isStreaming && aiTest.previewData?.isStreaming)) && (
            <div className={styles.deepThinkingBadge}>
              <svg className={`${styles.thinkingIcon} ${(aiTest.isReasoningStreaming ?? false) ? styles.shimmer : ''}`} viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                <path d="M346.197333 634.453333C267.605333 518.997333 209.92 402.773333 180.736 307.370667c-14.421333-47.445333-22.613333-91.989333-21.333333-129.962667 1.109333-36.949333 11.690667-76.117333 43.861333-99.328C235.946667 54.613333 275.882667 58.197333 310.613333 70.058667c35.413333 12.288 73.984 36.181333 113.152 67.242666a40.106667 40.106667 0 0 1 15.274667 26.965334 41.642667 41.642667 0 0 1-7.936 30.208 39.68 39.68 0 0 1-26.453333 15.36 38.4 38.4 0 0 1-29.184-8.533334c-35.413333-28.16-66.133333-46.08-90.026667-54.442666-24.746667-8.533333-34.304-4.266667-37.034667-2.389334-2.56 1.877333-9.472 9.386667-10.24 35.669334-0.853333 25.173333 4.693333 60.074667 17.834667 102.997333 26.026667 85.589333 79.36 194.304 154.709333 304.810667 75.178667 110.506667 156.245333 199.338667 225.536 253.781333 34.816 27.306667 64.682667 44.714667 88.064 52.650667 24.149333 8.106667 33.536 3.925333 36.010667 2.048 2.048-1.450667 6.570667-5.973333 9.045333-20.48 2.56-14.592 2.133333-35.584-2.901333-63.232-9.813333-54.954667-35.925333-127.146667-77.312-207.530667a41.386667 41.386667 0 0 1 16.469333-54.698667 38.570667 38.570667 0 0 1 53.248 16.896c43.349333 84.48 73.216 164.778667 85.077334 230.656 5.888 32.938667 7.68 64.341333 2.986666 91.904-4.778667 27.733333-16.725333 55.04-41.386666 72.874667-32.256 23.210667-71.68 19.968-105.813334 8.448-34.986667-11.861333-72.96-34.986667-111.445333-65.194667-77.141333-60.757333-163.584-156.16-242.090667-271.616z" />
                <path d="M357.973333 410.624c66.730667-118.954667 143.701333-218.88 215.04-284.074667 35.669333-32.426667 71.509333-57.685333 105.557334-71.68C712.192 41.130667 750.933333 35.84 784.725333 55.978667c36.693333 21.845333 51.2 63.658667 55.125334 104.277333 4.010667 41.813333-1.792 92.16-14.762667 146.176a40.533333 40.533333 0 0 1-16.213333 23.893333 38.485333 38.485333 0 0 1-52.053334-7.509333 41.216 41.216 0 0 1-9.301333-27.477333l1.109333-8.106667 7.424-35.413333c5.888-33.536 7.424-61.696 5.376-83.541334-2.901333-30.208-11.776-39.68-16.128-42.154666-3.925333-2.389333-14.506667-5.461333-37.546666 4.010666-22.357333 9.216-50.602667 28.074667-82.517334 57.173334-63.488 57.941333-135.253333 150.357333-198.997333 263.850666-63.829333 113.493333-105.642667 223.573333-122.624 309.248-8.533333 42.922667-10.325333 77.482667-6.826667 102.058667 3.413333 25.173333 11.349333 33.109333 15.36 35.413333 3.669333 2.218667 12.8 4.949333 32.426667-2.048 19.456-6.997333 44.202667-22.101333 72.789333-46.250666a38.570667 38.570667 0 0 1 54.784 6.229333 41.301333 41.301333 0 0 1-4.778666 56.405333l-24.490667 19.370667a287.744 287.744 0 0 1-72.448 40.704c-31.317333 11.264-66.56 14.250667-97.621333-4.266667-33.877333-19.968-48.896-57.088-54.016-93.866666-5.290667-37.376-1.877333-82.090667 7.594666-129.962667 19.114667-96.170667 64.853333-214.613333 131.584-333.568z" />
                <path d="M512 386.133333c132.778667 0 254.293333 13.824 343.893333 37.205334 44.373333 11.52 83.2 25.941333 111.786667 43.52 26.112 16.042667 56.32 42.666667 56.32 82.517333 0 36.266667-25.088 61.610667-48.042667 77.226667-24.405333 16.725333-57.258667 30.634667-94.72 41.813333a38.4 38.4 0 0 1-30.037333-3.328 40.277333 40.277333 0 0 1-18.773333-24.149333 41.557333 41.557333 0 0 1 3.242666-30.805334 39.594667 39.594667 0 0 1 23.466667-19.456c33.877333-10.24 58.197333-21.162667 73.130667-31.488a55.978667 55.978667 0 0 0 11.349333-9.728 66.816 66.816 0 0 0-16.213333-12.970666c-19.370667-11.946667-49.749333-23.893333-90.88-34.645334-81.493333-21.162667-196.266667-34.645333-324.522667-34.645333-128.256 0-243.029333 13.568-324.522667 34.730667-41.130667 10.666667-71.509333 22.784-90.709333 34.56a66.048 66.048 0 0 0-16.384 12.970666 64.853333 64.853333 0 0 0 15.274667 12.458667c18.261333 11.52 47.445333 23.381333 87.04 33.877333l-10.069334 39.253334-9.898666 39.253333C119.808 662.613333 82.432 648.192 54.613333 630.869333 29.184 614.997333 0 588.8 0 549.546667c0-39.850667 30.208-66.474667 56.32-82.517334 28.586667-17.578667 67.413333-32.085333 111.786667-43.52 89.6-23.381333 211.2-37.290667 343.893333-37.290666zM210.858667 645.12a40.96 40.96 0 0 1-18.176 24.746667 38.656 38.656 0 0 1-29.866667 4.266666l19.882667-78.336a38.741333 38.741333 0 0 1 24.064 18.602667 41.301333 41.301333 0 0 1 4.096 30.72z" />
              </svg>
              <span>深度思考</span>
            </div>
          )}

          <div className={styles.contentBox}>
            {/* 实时显示AI思考过程 */}
            <div
              className={`${styles.contentArea} ${displayReasoningContent ? styles.hasContent : ''}`}
            >
              {displayReasoningContent ? (
                <>
                  <MarkdownRenderer
                    key={`reasoning-${displayReasoningContent.length}`}
                    content={displayReasoningContent}
                  />
                  {/* 在内容底部添加三行空行 */}
                  <div className={styles.emptySpacer}></div>
                </>
              ) : (
                <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                  {aiTest.isStreaming ? '等待思考内容...' : '无思考内容（可能未启用深度思考模式）'}
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    }] : []),
    {
      key: 'raw',
      label: '原始数据',
      children: (
        <div className={styles.rawDataViewer}>
          {aiTest.previewData?.raw ? (
            <CodeBlock
              value={aiTest.previewData.raw}
              language="json"
              defaultExpanded={false}
            />
          ) : (
            <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
              暂无原始数据
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <Modal
      title="AI节点测试结果"
      open={open}
      onCancel={onClose}
      footer={null}
      width={700}
      centered
      maskClosable={false}
      styles={{ body: { padding: '0 24px 24px' } }}
    >
      <div style={{ position: 'relative', minHeight: '400px' }}>
        <Tabs
          defaultActiveKey="result"
          size="small"
          items={items}
          onChange={(key) => setActiveTab(key)}
        />
        {/* 加载组件：根据状态显示不同的提示，但不在原始数据标签页显示 */}
        {aiTest.isStreaming && activeTab !== 'raw' && (
          <StreamingLoader
            isStreaming={true}
            hasContent={!!displayReasoningContent || !!displayContent}
            text={
              displayReasoningContent && !displayContent
                ? '正在思考'
                : displayContent
                  ? '正在流式输出'
                  : ''
            }
          />
        )}
      </div>
    </Modal>
  );
};


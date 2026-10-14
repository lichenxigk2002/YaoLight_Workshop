import React, { useEffect, useRef } from 'react';
import { Form, Input, Button, Tag, Space, App } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { Node, Edge } from 'reactflow';
import { getNodeInputFormats, getNodeOutputFormat, nodeFormats } from '../utils/nodeFormats';
import { useCrawlerTest } from '../hooks/useCrawlerTest';
import { useAITest } from '../hooks/useAITest';
import { useCodeTest } from '../hooks/useCodeTest';
import { useTranslation } from 'react-i18next';
import {
  StartNodeConfig,
  ConditionNodeConfig,
  DataCleanNodeConfig,
  CrawlerNodeConfig,
  AINodeConfig,
  TransformNodeConfig,
  CodeNodeConfig,
  LoopNodeConfig,
  MergeNodeConfig,
  DelayNodeConfig,
  OutputNodeConfig,
} from '../configs';
import { useNodeConfigForm } from './hooks/useNodeConfigForm';
import { AIPreviewModal } from './components/AIPreviewModal';
import { providerRegistry } from '../providers';
import { CrawlerPreviewModal } from './components/CrawlerPreviewModal';
import { CodePreviewModal } from './components/CodePreviewModal';
import styles from './NodeConfigPanel.module.scss';

interface NodeConfigPanelProps {
  visible: boolean;
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onSave: (nodeId: string, config: any) => void;
  autoTest?: boolean;
  executionResult?: any;
  workflowId?: string;
  onSaveToBackend?: () => Promise<boolean>;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  node,
  nodes,
  edges,
  onClose,
  onSave,
  autoTest = false,
  executionResult,
  workflowId,
  onSaveToBackend,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [form] = Form.useForm();

  // 节点类型判断
  const nodeType = node?.data?.type || node?.type;
  const isCrawlerNode = nodeType === 'crawler';
  const isAINode = nodeType === 'ai';
  const isCodeNode = nodeType === 'code';

  // 表单管理 Hook（必须先定义，因为测试函数需要用到 buildNodeConfig）
  const { handleSave: handleSaveForm, buildNodeConfig } = useNodeConfigForm({
    node,
    form,
    autoTest,
    onAutoTest: undefined, // 先设为 undefined，后面再设置
  });

  // 测试功能（使用 buildNodeConfig 和 handleSaveForm）
  const crawlerTest = useCrawlerTest(isCrawlerNode ? node : null, form, nodes, edges, buildNodeConfig, handleSaveForm, onSave);
  const aiTest = useAITest(isAINode ? node : null, form, nodes, edges, buildNodeConfig, handleSaveForm, onSave);
  const codeTest = useCodeTest(isCodeNode ? node : null, form, nodes, edges, buildNodeConfig, handleSaveForm, onSave);

  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveInFlightRef = useRef(false);

  const scheduleAutoSave = () => {
    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (autoSaveInFlightRef.current) return;
      autoSaveInFlightRef.current = true;
      try {
        await handleSaveForm(onSave, onSaveToBackend, workflowId, false);
      } finally {
        autoSaveInFlightRef.current = false;
      }
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  const handleSave = async () => {
    const success = await handleSaveForm(onSave, onSaveToBackend, workflowId);
    if (success) {
      message.success(t('node.config.configSaved'));
      // 保存后不关闭配置面板，保持打开状态
    }
  };

  // 渲染配置组件
  const renderConfigComponent = () => {
    if (!node) return null;

    const nodeType = node.data.type || node.type;
    const commonProps = {
      node,
      nodes,
      edges,
      executionResult,
    };

    switch (nodeType) {
      case 'start':
        return <StartNodeConfig node={node} />;
      case 'crawler':
        return <CrawlerNodeConfig {...commonProps} />;
      case 'dataclean':
        return <DataCleanNodeConfig {...commonProps} />;
      case 'ai':
        return <AINodeConfig {...commonProps} />;
      case 'condition':
        return <ConditionNodeConfig {...commonProps} />;
      case 'transform':
        return <TransformNodeConfig />;
      case 'code':
        return <CodeNodeConfig lastTestResult={codeTest.previewData?.code} />;
      case 'loop':
        return <LoopNodeConfig />;
      case 'delay':
        return <DelayNodeConfig />;
      case 'output':
        return <OutputNodeConfig />;
      case 'merge':
        return <MergeNodeConfig />;
      case 'end':
        return <div>{t('node.config.endNoConfig')}</div>;
      default:
        return <div>{t('node.config.unknownType')}</div>;
    }
  };

  if (!node) return null;

  // 获取节点格式信息
  const inputFormats = getNodeInputFormats(nodeType);
  const outputFormat = getNodeOutputFormat(nodeType);
  const formatInfo = nodeFormats[nodeType];

  // 格式化标签显示
  const formatLabels: Record<string, string> = {
    any: t('node.formats.any'),
    json: t('node.formats.json'),
    array: t('node.formats.array'),
    text: t('node.formats.text'),
    html: t('node.formats.html'),
    url: t('node.formats.url'),
    number: t('node.formats.number'),
    boolean: t('node.formats.boolean'),
    null: t('node.formats.null'),
  };

  return (
    <div className={styles.container}>
      {/* 头部 */}
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          {t('node.config.title')}: {node.data.label || node.id}
        </div>
        <Button
          type="text"
          icon={<CloseOutlined style={{ color: 'var(--text-primary)' }} />}
          onClick={onClose}
          className={styles.closeButton}
        />
      </div>

      {/* 内容区域 */}
      <div className={styles.content}>
        {/* 数据格式信息 */}
        <div className={styles.dataFormatInfo}>
          <div className={styles.dataFormatTitle}>
            {t('node.config.dataFormat')}
          </div>
          <div className={styles.dataFormatItem}>
            <span className={styles.dataFormatLabel}>
              {t('node.config.inputFormat')}：
            </span>
            <Space size={4} wrap>
              {inputFormats.map((format) => (
                <Tag key={format} bordered={false} className={styles.semanticTag}>
                  {formatLabels[format] || format}
                </Tag>
              ))}
            </Space>
          </div>
          <div>
            <span className={styles.dataFormatLabel}>
              {t('node.config.outputFormat')}：
            </span>
            <Tag bordered={false} className={`${styles.semanticTag} ${styles.semanticTagEmphasis}`}>
              {formatLabels[outputFormat] || outputFormat}
            </Tag>
          </div>
          {formatInfo?.description && (
            <div className={styles.dataFormatDescription}>
              {formatInfo.description}
            </div>
          )}
        </div>

        <Form
          form={form}
          layout="vertical"
          onValuesChange={(_, changedValues) => {
            const keys = Object.keys(changedValues || {});
            if (keys.some((k) => typeof (changedValues as any)[k] === 'boolean')) {
              scheduleAutoSave();
            }
          }}
        >
          <Form.Item
            label={t('node.config.nodeName')}
            name="label"
            rules={[{ required: true, message: t('node.config.nodeNameRequired') }]}
          >
            <Input />
          </Form.Item>
          {renderConfigComponent()}
        </Form>
      </div>

      {/* 底部按钮 */}
      <div className={styles.footer}>
        <Button onClick={onClose} className={styles.footerButton}>{t('common.cancel')}</Button>
        {isCrawlerNode && (
          <Button onClick={crawlerTest.handleTestCrawl} className={styles.footerButton}>
            {t('node.config.crawler.testCrawl')}
          </Button>
        )}
        {isAINode && (
          <Button onClick={aiTest.handleTestAI} className={styles.footerButton}>测试AI节点</Button>
        )}
        {isCodeNode && (
          <Button loading={codeTest.isTesting} onClick={codeTest.handleTestCode} className={styles.footerButton}>
            {t('node.config.code.testRun')}
          </Button>
        )}
        <Button type="primary" onClick={handleSave} className={styles.footerPrimaryButton}>
          {t('workflowEditor.save')}
        </Button>
      </div>

      {/* 爬虫节点预览模态框 */}
      {isCrawlerNode && (
        <>
          <CrawlerPreviewModal
            open={crawlerTest.previewOpen}
            onClose={() => {
              crawlerTest.setPreviewOpen(false);
            }}
            crawlerTest={crawlerTest}
          />
        </>
      )}

      {/* AI节点预览模态框 - 使用提供商专属预览组件 */}
      {isAINode && (() => {
        const provider = node?.data?.config?.provider;
        if (provider) {
          const providerReg = providerRegistry.get(provider);
          if (providerReg && providerReg.PreviewComponent) {
            const PreviewComponent = providerReg.PreviewComponent;
            return (
              <PreviewComponent
                open={aiTest.previewOpen}
                onClose={() => aiTest.setPreviewOpen(false)}
                aiTest={aiTest}
                nodeConfig={node?.data?.config}
              />
            );
          }
        }
        // 如果没有注册的提供商，使用通用预览组件
        return (
          <AIPreviewModal
            open={aiTest.previewOpen}
            onClose={() => aiTest.setPreviewOpen(false)}
            aiTest={aiTest}
            nodeConfig={node?.data?.config}
          />
        );
      })()}

      {isCodeNode && (
        <CodePreviewModal
          open={codeTest.previewOpen}
          onClose={() => codeTest.setPreviewOpen(false)}
          codeTest={codeTest}
        />
      )}
    </div>
  );
};

export default NodeConfigPanel;

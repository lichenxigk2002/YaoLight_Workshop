import React, { useState, useEffect } from 'react';
import {
  Modal,
  Collapse,
  Empty,
  Tag,
  Typography,
  Space,
  Button,
  App,
  Descriptions,
  Divider,
  Card,
  Tabs,
  Form,
  Input,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  RightOutlined,
  StopOutlined,
  FileTextOutlined,
  CodeOutlined,
  MailOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { Task, TaskNodeExecution, NodeExecutionStatus } from '@/types/task';
import { workflowApi } from '@/api/workflow';
import { taskApi } from '@/api/task';
import http from '@/http';
import { MarkdownRenderer } from '../utils/MarkdownRenderer';
import { MermaidRenderer, looksLikeMermaid } from '../utils/MermaidRenderer';
import { ProviderIcon } from '@/components/Icons';
import styles from './TaskExecutionDetailModal.module.scss';

const { Text } = Typography;

interface TaskExecutionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  task: Task | null;
  executions: TaskNodeExecution[];
}

const normalizeDownloadPathForHttp = (p: string) => {
  if (typeof p !== 'string') return '';
  return p.startsWith('/api/') ? p.replace(/^\/api/, '') : p;
};

const getTokenForFetch = () => {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const authData = JSON.parse(authStorage);
      return authData.state?.token || null;
    }
  } catch { }
  return null;
};

type TimelineExecution = TaskNodeExecution & {
  timelineStart: number;
  timelineEnd: number;
  lane: number;
  offsetPercent: number;
  widthPercent: number;
};

const getExecutionWindow = (execution: TaskNodeExecution) => {
  const startedAt = execution.startedAt ? new Date(execution.startedAt).getTime() : null;
  const completedAt = execution.completedAt ? new Date(execution.completedAt).getTime() : null;
  const createdAt = new Date(execution.createdAt).getTime();
  const start = startedAt ?? createdAt;
  let end = completedAt ?? null;
  if (end == null && execution.executionTime != null) {
    end = start + execution.executionTime;
  }
  if (end == null || end < start) {
    end = start + 1;
  }
  return { start, end };
};

const buildExecutionTimeline = (executions: TaskNodeExecution[]) => {
  if (executions.length === 0) {
    return {
      executions: [] as TimelineExecution[],
      peakConcurrency: 0,
      laneCount: 0,
      totalDuration: 0,
    };
  }

  const sorted = [...executions].sort((a, b) => {
    const windowA = getExecutionWindow(a);
    const windowB = getExecutionWindow(b);
    if (windowA.start !== windowB.start) {
      return windowA.start - windowB.start;
    }
    return windowA.end - windowB.end;
  });

  let globalStart = Number.POSITIVE_INFINITY;
  let globalEnd = Number.NEGATIVE_INFINITY;
  const laneEndTimes: number[] = [];
  const mapped: TimelineExecution[] = [];

  sorted.forEach((execution) => {
    const { start, end } = getExecutionWindow(execution);
    globalStart = Math.min(globalStart, start);
    globalEnd = Math.max(globalEnd, end);

    let lane = laneEndTimes.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEndTimes.length;
      laneEndTimes.push(end);
    } else {
      laneEndTimes[lane] = end;
    }

    mapped.push({
      ...execution,
      timelineStart: start,
      timelineEnd: end,
      lane,
      offsetPercent: 0,
      widthPercent: 0,
    });
  });

  const totalDuration = Math.max(globalEnd - globalStart, 1);
  const timelineExecutions = mapped.map((execution) => ({
    ...execution,
    offsetPercent: ((execution.timelineStart - globalStart) / totalDuration) * 100,
    widthPercent: Math.max(((execution.timelineEnd - execution.timelineStart) / totalDuration) * 100, 3),
  }));

  const events: Array<{ time: number; delta: number }> = [];
  timelineExecutions.forEach((execution) => {
    events.push({ time: execution.timelineStart, delta: 1 });
    events.push({ time: execution.timelineEnd, delta: -1 });
  });
  events.sort((a, b) => (a.time === b.time ? a.delta - b.delta : a.time - b.time));

  let active = 0;
  let peakConcurrency = 0;
  events.forEach((event) => {
    active += event.delta;
    peakConcurrency = Math.max(peakConcurrency, active);
  });

  return {
    executions: timelineExecutions,
    peakConcurrency,
    laneCount: laneEndTimes.length,
    totalDuration,
  };
};

const formatMs = (value?: number | null) => {
  if (value == null) return '-';
  if (value < 1000) return `${value}ms`;
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}s`;
};

/**
 * 数据展示组件
 */
const DataViewer: React.FC<{
  title: string;
  data: any;
  filename?: string;
  nodeType?: string;
  taskId?: number;
}> = ({ title, data, filename, nodeType, taskId }) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'preview' | 'json' | 'artifacts'>('preview');
  const [sendEmailModalOpen, setSendEmailModalOpen] = useState(false);
  const [sendEmailForm] = Form.useForm();
  const [artifactPreviewOpen, setArtifactPreviewOpen] = useState(false);
  const [artifactPreviewContent, setArtifactPreviewContent] = useState('');
  const [artifactPreviewTitle, setArtifactPreviewTitle] = useState('');
  const [artifactPreviewMeta, setArtifactPreviewMeta] = useState<{ name?: string; kind?: string } | null>(null);

  const isAI = nodeType === 'ai';
  const isOutput = nodeType === 'output';

  let contentText = '';
  if (data && typeof data === 'object') {
    if (data.content || data.result) {
      contentText = data.content || data.result || '';
    } else if (
      isOutput &&
      data.data &&
      typeof data.data === 'object' &&
      (data.data.content || data.data.result)
    ) {
      contentText = data.data.content || data.data.result || '';
    }
  }
  const hasContent = !!contentText;

  if (typeof contentText === 'object') {
    contentText = JSON.stringify(contentText);
  }

  // 智能处理 reasoningContent，避免显示 [object Object]
  let reasoningText = '';
  if (data && typeof data === 'object' && data.reasoningContent) {
    if (typeof data.reasoningContent === 'string') {
      reasoningText = data.reasoningContent;
    } else if (Array.isArray(data.reasoningContent)) {
      const stringItems = data.reasoningContent
        .filter((item: any) => typeof item === 'string')
        .join('\n');
      reasoningText = stringItems;
    } else if (typeof data.reasoningContent === 'object') {
      const obj = data.reasoningContent as any;
      if (obj.text) {
        reasoningText = String(obj.text);
      } else if (obj.content) {
        reasoningText = String(obj.content);
      } else if (obj.message) {
        reasoningText = String(obj.message);
      }
    }
  }

  // 尝试解析 contentText 为 JSON
  let parsedContent: any = null;
  try {
      if (contentText && typeof contentText === 'string') {
          // 检查是否看起来像 JSON
          const trimmed = contentText.trim();
          if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || 
              (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
              parsedContent = JSON.parse(trimmed);
          }
      }
  } catch (e) {
      // 忽略解析错误，视为普通文本
  }

  // 如果解析成功且包含 content 字段，尝试提取真正的 markdown 内容
  let finalMarkdown = contentText;
  if (parsedContent && typeof parsedContent === 'object') {
      if (parsedContent.content && typeof parsedContent.content === 'string') {
          finalMarkdown = parsedContent.content;
      } else if (parsedContent.result && typeof parsedContent.result === 'string') {
          finalMarkdown = parsedContent.result;
      }
  }
  
  const cleanIntro = (text: string) => {
      if (!text || typeof text !== 'string') return text;
      
      // 匹配常见的 AI 开场白
      const patterns = [
        /^好的[，,。！!]?.*?\n\n/s,     // "好的，这是一个..." + 双换行
        /^Sure[.,!].*?\n\n/s,
        /^Okay[.,!].*?\n\n/s,
        /^Here is.*?\n\n/s,
        /^这是.*?\n\n/s
      ];
      
      for (const p of patterns) {
          if (p.test(text)) {
              return text.replace(p, '');
          }
      }
      return text;
  };

  const unwrapFencedMarkdown = (text: string) => {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    if (!trimmed.startsWith('```')) return text;
    const nl = trimmed.indexOf('\n');
    if (nl <= 0) return text;
    const firstLine = trimmed.slice(0, nl).toLowerCase();
    if (!firstLine.startsWith('```')) return text;
    let body = trimmed.slice(nl + 1);
    const end = body.lastIndexOf('```');
    if (end >= 0) {
      body = body.slice(0, end);
    }
    return body.trim();
  };

  const finalMarkdownText = unwrapFencedMarkdown(cleanIntro(finalMarkdown));

  // 检查是否有有效的思考内容（排除 [object Object] 等无效字符串）
  const invalidStrings = ['[object Object]', '[object Array]', 'null', 'undefined'];
  const hasReasoning = reasoningText &&
    reasoningText.trim() !== '' &&
    !invalidStrings.includes(reasoningText.trim());

  // 获取AI模型信息
  const getModelInfo = () => {
    if (!data || typeof data !== 'object') return null;

    const modelName = data.model || '';
    if (!modelName) return null;

    // 从模型名称推断提供商
    const lowerModelName = modelName.toLowerCase();
    let provider: string | null = null;

    if (lowerModelName.includes('deepseek')) {
      provider = 'deepseek';
    } else if (lowerModelName.includes('doubao') || lowerModelName.includes('seed')) {
      provider = 'doubao';
    } else if (lowerModelName.includes('qwen')) {
      provider = 'qwen';
    } else if (lowerModelName.includes('zhipuai') || lowerModelName.includes('glm')) {
      provider = 'zhipuai';
    } else if (lowerModelName.includes('spark')) {
      provider = 'spark';
    } else if (lowerModelName.includes('hunyuan')) {
      provider = 'hunyuan';
    } else if (lowerModelName.includes('gpt') || lowerModelName.includes('openai')) {
      provider = 'gpt';
    } else if (lowerModelName.includes('gemini')) {
      provider = 'gemini';
    } else if (lowerModelName.includes('grok')) {
      provider = 'grok';
    }

    return { modelName, provider };
  };

  const modelInfo = getModelInfo();

  const handleCopy = () => {
    try {
      let copyText = '';

      if ((isAI || isOutput) && hasContent) {
        if (activeTab === 'preview') {
          copyText = finalMarkdownText || contentText;
        } else {
          copyText = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
        }
      } else {
        copyText = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      }

      navigator.clipboard.writeText(copyText);
      message.success(t('taskHistory.executionDetail.copiedToClipboard'));
    } catch (error) {
      message.error(t('taskHistory.executionDetail.copyFailed'));
    }
  };

  const handleDownload = () => {
    try {
      if ((isAI || isOutput) && hasContent) {
        if (
          isOutput &&
          data &&
          typeof data === 'object' &&
          Array.isArray((data as any).artifacts) &&
          (data as any).artifacts.length > 0
        ) {
          const artifacts = (data as any).artifacts as any[];
          const mdArtifact = artifacts.find((a) =>
            String(a.mimeType || '').toLowerCase().includes('text/markdown') ||
            String(a.kind || '').toLowerCase() === 'markdown'
          ) || artifacts[0];
          const p = normalizeDownloadPathForHttp(mdArtifact.downloadUrl || '');
          if (p) {
            http.download(p, undefined, mdArtifact.name);
            message.success(t('taskHistory.executionDetail.downloadSuccess'));
            return;
          }
        }

        const baseName = filename ? filename.replace(/\.[^/.]+$/, '') : 'output';
        const blob = new Blob([finalMarkdownText || contentText], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${baseName}.md`;
        a.click();
        URL.revokeObjectURL(url);
        message.success(t('taskHistory.executionDetail.downloadSuccess'));
        return;
      }

      if (!filename) return;
      const blob = new Blob(
        [typeof data === 'string' ? data : JSON.stringify(data, null, 2)],
        { type: 'application/json' },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      message.success(t('taskHistory.executionDetail.downloadSuccess'));
    } catch (error) {
      message.error(t('taskHistory.executionDetail.downloadFailed'));
    }
  };

  const jsonContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

  const artifacts = data &&
    typeof data === 'object' &&
    Array.isArray((data as any).artifacts)
    ? ((data as any).artifacts as any[])
    : [];

  const handleSendEmail = () => {
    if (!isOutput || !taskId) {
      return;
    }
    if (!artifacts || artifacts.length === 0) {
      message.error('当前输出没有可发送的附件');
      return;
    }
    const defaultSubject = filename || '工作流输出结果';
    const defaultBody = finalMarkdownText || contentText || '';
    sendEmailForm.setFieldsValue({
      to: '',
      subject: defaultSubject,
      body: defaultBody,
    });
    setSendEmailModalOpen(true);
  };

  const handleSendEmailSubmit = async () => {
    try {
      const values = await sendEmailForm.validateFields();
      if (!taskId) {
        message.error('缺少任务ID，无法发送邮件');
        return;
      }
      const artifactIds = artifacts.map((a) => a.id).filter((id) => typeof id === 'number');
      if (artifactIds.length === 0) {
        message.error('当前输出没有可发送的附件');
        return;
      }
      await taskApi.sendArtifactsEmail(taskId, {
        to: values.to,
        subject: values.subject || '工作流输出结果',
        artifactIds,
        body: values.body || (finalMarkdownText || contentText || ''),
      });
      message.success('邮件已发送');
      setSendEmailModalOpen(false);
    } catch (error: any) {
      if (error?.errorFields) {
        return;
      }
      message.error(error?.message || '发送邮件失败');
    }
  };

  const isMermaidArtifact = (a: { name?: string; kind?: string }, content: string) => {
    const name = (a?.name || '').toLowerCase();
    const kind = (a?.kind || '').toLowerCase();
    return name.endsWith('.mmd') || kind === 'mermaid' || (!!content && looksLikeMermaid(content));
  };

  const handlePreviewArtifact = async (a: any) => {
    const downloadUrl = normalizeDownloadPathForHttp(a.downloadUrl || '');
    if (!downloadUrl) return;
    const baseURL = import.meta.env.VITE_BASE_URL || '/api';
    const base = baseURL.replace(/\/$/, '');
    const fullUrl = base.startsWith('http') ? `${base}${downloadUrl}` : `${base}${downloadUrl}`;
    try {
      const resp = await fetch(fullUrl, {
        headers: { ...(getTokenForFetch() ? { Authorization: `Bearer ${getTokenForFetch()}` } : {}) },
      });
      if (!resp.ok) return;
      const text = await resp.text();
      setArtifactPreviewTitle(a.name || '预览');
      setArtifactPreviewContent(text);
      setArtifactPreviewMeta({ name: a.name, kind: a.kind });
      setArtifactPreviewOpen(true);
    } catch {
      message.error('加载制品失败');
    }
  };

  if ((isAI || isOutput) && hasContent) {
    const tabItems: { key: string; label: React.ReactNode; children: React.ReactNode }[] = [
      {
        key: 'preview',
        label: (
          <Space>
            <FileTextOutlined />
            <span>文本预览</span>
          </Space>
        ),
        children: (
          <div className={styles.markdownPreview}>
            {isAI && hasReasoning && reasoningText && (
              <div style={{ marginBottom: 24 }}>
                <Text strong style={{ display: 'block', marginBottom: 12, fontSize: '13px' }}>思考过程：</Text>
                <MarkdownRenderer content={reasoningText} />
              </div>
            )}
            {contentText && (
              <div>
                {isAI && modelInfo && (
                  <Space size={6} align="center" style={{ marginBottom: 12, display: 'flex' }}>
                    {modelInfo.provider && (
                      <ProviderIcon provider={modelInfo.provider} size={16} />
                    )}
                    <Text strong style={{ fontSize: '13px' }}>
                      {modelInfo.modelName}
                    </Text>
                  </Space>
                )}
                <MarkdownRenderer content={finalMarkdownText} />
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'json',
        label: (
          <Space>
            <CodeOutlined />
            <span>JSON数据</span>
          </Space>
        ),
        children: (
          <div className={styles.dataContent}>
            <SyntaxHighlighter
              language="json"
              style={oneDark}
              wrapLongLines={true}
              customStyle={{
                margin: 0,
                padding: '12px',
                borderRadius: '6px',
                fontSize: '12px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              {jsonContent}
            </SyntaxHighlighter>
          </div>
        ),
      },
    ];

    if (isOutput && artifacts.length > 0) {
      tabItems.push({
        key: 'artifacts',
        label: (
          <Space>
            <FileTextOutlined />
            <span>导出制品</span>
            <Tag>{artifacts.length}</Tag>
          </Space>
        ),
        children: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {artifacts.map((a: any) => (
              <div
                key={String(a.id || a.name)}
                style={{
                  border: '1px solid var(--border-secondary, #e8e8e8)',
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <Text strong>{a.name || `#${a.id}`}</Text>
                  <div style={{ marginTop: 4 }}>
                    {a.kind && <Tag>{a.kind}</Tag>}
                    {a.mimeType && <Tag color="geekblue">{a.mimeType}</Tag>}
                  </div>
                </div>
                <Space>
                  {(a.mimeType || '').toLowerCase().includes('text/') || (a.mimeType || '').toLowerCase().includes('markdown') ? (
                    <Button size="small" icon={<EyeOutlined />} onClick={() => handlePreviewArtifact(a)}>
                      预览
                    </Button>
                  ) : null}
                  <Button
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const p = normalizeDownloadPathForHttp(a.downloadUrl || '');
                      if (!p) return;
                      http.download(p, undefined, a.name);
                    }}
                  >
                    下载
                  </Button>
                </Space>
              </div>
            ))}
          </div>
        ),
      });
    }

    return (
      <div className={styles.dataViewer}>
        <div className={styles.dataHeader}>
          <Text strong>{title}</Text>
          <Space size="small">
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => handleCopy()}
              title={t('taskHistory.executionDetail.copy')}
            />
            {filename && (
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                title={t('taskHistory.executionDetail.download')}
              />
            )}
            {isOutput && taskId && (
              <Button
                type="text"
                size="small"
                icon={<MailOutlined />}
                onClick={handleSendEmail}
                title="发送邮件"
              />
            )}
          </Space>
        </div>
        <Tabs
          items={tabItems}
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'preview' | 'json' | 'artifacts')}
          size="small"
        />
        {artifactPreviewOpen && (
          <Modal
            title={artifactPreviewTitle}
            open={artifactPreviewOpen}
            onCancel={() => {
              setArtifactPreviewOpen(false);
              setArtifactPreviewMeta(null);
            }}
            footer={null}
            width={720}
            centered
            destroyOnClose
          >
            {artifactPreviewContent && artifactPreviewMeta && isMermaidArtifact(artifactPreviewMeta, artifactPreviewContent) ? (
              <MermaidRenderer
                content={artifactPreviewContent}
                showSavePng={true}
                downloadName={artifactPreviewTitle ? artifactPreviewTitle.replace(/\.[^/.]+$/, '') : 'diagram'}
              />
            ) : (
              <MarkdownRenderer content={artifactPreviewContent} />
            )}
          </Modal>
        )}
        {isOutput && taskId && (
          <Modal
            open={sendEmailModalOpen}
            title="发送邮件"
            onCancel={() => setSendEmailModalOpen(false)}
            onOk={handleSendEmailSubmit}
            okText="发送"
            cancelText="取消"
            destroyOnClose
          >
            <Form form={sendEmailForm} layout="vertical">
              <Form.Item
                label="收件邮箱"
                name="to"
                rules={[{ required: true, message: '请输入收件邮箱' }, { type: 'email', message: '请输入有效的邮箱地址' }]}
              >
                <Input placeholder="example@example.com" />
              </Form.Item>
              <Form.Item label="邮件主题" name="subject">
                <Input />
              </Form.Item>
              <Form.Item label="正文预览" name="body">
                <Input.TextArea rows={4} />
              </Form.Item>
            </Form>
          </Modal>
        )}
      </div>
    );
  }

  // 默认显示JSON格式
  return (
    <div className={styles.dataViewer}>
      <div className={styles.dataHeader}>
        <Text strong>{title}</Text>
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => handleCopy()}
            title={t('taskHistory.executionDetail.copy')}
          />
          {filename && (
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={handleDownload}
              title={t('taskHistory.executionDetail.download')}
            />
          )}
        </Space>
      </div>
      <div className={styles.dataContent}>
        <SyntaxHighlighter
          language="json"
          style={oneDark}
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            padding: '12px',
            borderRadius: '0 0 6px 6px',
            fontSize: '12px',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {jsonContent}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

/**
 * 任务执行详情弹窗（历史记录查看）
 */
const TaskExecutionDetailModal: React.FC<TaskExecutionDetailModalProps> = ({
  visible,
  onClose,
  task,
  executions,
}) => {
  const { t } = useTranslation();
  const [activeKeys, setActiveKeys] = useState<string[]>([]);
  const [nodeLabels, setNodeLabels] = useState<Record<string, string>>({});

  // 获取工作流节点信息，建立 nodeId -> label 的映射
  useEffect(() => {
    if (!task?.workflowId || !visible) return;

    const fetchNodeLabels = async () => {
      try {
        const response = await workflowApi.getWorkflowNodes(task.workflowId);
        const labels: Record<string, string> = {};

        if (response.nodes && Array.isArray(response.nodes)) {
          response.nodes.forEach((node: any) => {
            const nodeId = node.id || node.ID;
            const label = node.data?.label || node.label || nodeId;
            if (nodeId) {
              labels[nodeId] = label;
            }
          });
        }

        setNodeLabels(labels);
      } catch (error) {
        console.error('获取节点信息失败:', error);
        // 失败时不影响显示，只是没有节点名称
      }
    };

    fetchNodeLabels();
  }, [task?.workflowId, visible]);

  if (!task) return null;

  const timelineSummary = buildExecutionTimeline(executions);
  const timelineExecutions = timelineSummary.executions;

  // 构建折叠面板项
  const collapseItems = timelineExecutions.map((execution) => {
    const nodeLabel = nodeLabels[execution.nodeId] || execution.nodeId;
    const showNodeName = nodeLabels[execution.nodeId] && nodeLabels[execution.nodeId] !== execution.nodeId;

    return {
      key: execution.nodeId,
      label: (
        <div className={styles.collapseHeader}>
          <Space>
            <NodeStatusTag status={execution.status} task={task} execution={execution} />
            {showNodeName ? (
              <Space size="small">
                <Text strong>{nodeLabel}</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>({execution.nodeId})</Text>
              </Space>
            ) : (
              <Text strong>{execution.nodeId}</Text>
            )}
            <Tag bordered={false}>{execution.nodeType}</Tag>
          </Space>
          <Space>
            <Tag bordered={false} color="cyan">
              Lane {execution.lane + 1}
            </Tag>
            {execution.executionTime && (
              <Tag icon={<ClockCircleOutlined />} color="default">
                {formatMs(execution.executionTime)}
              </Tag>
            )}
          </Space>
        </div>
      ),
      children: (
        <div className={styles.executionDetail}>
          {/* 执行时间信息 */}
          <Descriptions column={2} size="small" className={styles.nodeMetaInfo}>
            <Descriptions.Item label={t('taskHistory.executionDetail.startTime')}>
              {execution.startedAt ? new Date(execution.startedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label={t('taskHistory.executionDetail.completionTime')}>
              {execution.completedAt ? new Date(execution.completedAt).toLocaleString('zh-CN') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="并发泳道">Lane {execution.lane + 1}</Descriptions.Item>
            <Descriptions.Item label="墙钟耗时">{formatMs(execution.timelineEnd - execution.timelineStart)}</Descriptions.Item>
            <Descriptions.Item label={t('taskHistory.executionDetail.retryCount')}>{execution.retryCount}</Descriptions.Item>
          </Descriptions>

          {/* 错误信息 - 放在最前面醒目显示 */}
          {execution.errorMessage && (
            <div className={styles.errorSection}>
              <Text strong type="danger">{t('taskHistory.executionDetail.errorInfo')}</Text>
              <div className={styles.errorMessage}>
                {execution.errorMessage}
              </div>
              {execution.errorStack && (
                <Collapse ghost size="small">
                  <Collapse.Panel header={t('taskHistory.executionDetail.errorStack')} key="stack">
                    <pre className={styles.errorStack}>{execution.errorStack}</pre>
                  </Collapse.Panel>
                </Collapse>
              )}
            </div>
          )}

          <Divider style={{ margin: '12px 0' }} />

          {/* 输入输出数据 */}
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {execution.inputData && (
              <DataViewer
                title={t('taskHistory.executionDetail.inputData')}
                data={execution.inputData}
              />
            )}

            {execution.outputData && (
              <DataViewer
                title={t('taskHistory.executionDetail.outputData')}
                data={execution.outputData}
                filename={`${execution.nodeId}_output.json`}
                nodeType={execution.nodeType}
                taskId={task.id}
              />
            )}

            {execution.resourceUsage && (
              <DataViewer
                title={t('taskHistory.executionDetail.resourceUsage')}
                data={execution.resourceUsage}
              />
            )}
          </Space>
        </div>
      ),
    };
  });

  return (
    <Modal
      title={
        <Space>
          <Text strong style={{ fontSize: '16px' }}>{t('taskHistory.executionDetail.title')}</Text>
          <Tag color={getTaskStatusColor(task.status)}>{getTaskStatusText(task.status, task, t)}</Tag>
          <Text type="secondary" style={{ fontSize: '12px' }}>ID: {task.id}</Text>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      centered
      mask={false}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('taskHistory.executionDetail.close')}
        </Button>,
      ]}
      className={styles.detailModal}
      styles={{ body: { padding: '20px 24px' } }}
      getContainer={false}
    >
      {/* 任务基本信息卡片 */}
      <Card size="small" className={styles.taskInfoCard} bordered={false}>
        <Descriptions title={t('taskHistory.executionDetail.taskInfo')} column={3} size="small">
          <Descriptions.Item label={t('taskHistory.taskName')}>{task.name || '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.executionDetail.startTime')}>{task.startedAt ? new Date(task.startedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.executionDetail.completionTime')}>{task.completedAt ? new Date(task.completedAt).toLocaleString('zh-CN') : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.executionDetail.executionDuration')}>{task.actualDuration ? `${task.actualDuration}ms` : '-'}</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.progress')}>{task.progress}%</Descriptions.Item>
          <Descriptions.Item label={t('taskHistory.priority')}>{task.priority}</Descriptions.Item>
        </Descriptions>

        {task.errorMessage && (
          <div style={{ marginTop: 12 }}>
            <Text type="danger">{t('taskHistory.executionDetail.taskError', { message: task.errorMessage })}</Text>
          </div>
        )}
      </Card>

      {timelineExecutions.length > 0 && (
        <div className={styles.concurrentPanel}>
          <div className={styles.concurrentStats}>
            <Card size="small" bordered={false} className={styles.concurrentStatCard}>
              <Text type="secondary">峰值并发</Text>
              <div className={styles.concurrentStatValue}>{timelineSummary.peakConcurrency}</div>
            </Card>
            <Card size="small" bordered={false} className={styles.concurrentStatCard}>
              <Text type="secondary">时间泳道</Text>
              <div className={styles.concurrentStatValue}>{timelineSummary.laneCount}</div>
            </Card>
            <Card size="small" bordered={false} className={styles.concurrentStatCard}>
              <Text type="secondary">墙钟耗时</Text>
              <div className={styles.concurrentStatValue}>{formatMs(timelineSummary.totalDuration)}</div>
            </Card>
          </div>

          <Card size="small" bordered={false} className={styles.concurrentTimelineCard} title="并发执行">
            <div className={styles.concurrentTimeline}>
              {timelineExecutions.map((execution) => (
                <div key={`timeline-${execution.id}`} className={styles.concurrentRow}>
                  <div className={styles.concurrentMeta}>
                    <Text strong>{nodeLabels[execution.nodeId] || execution.nodeId}</Text>
                    <Tag bordered={false}>Lane {execution.lane + 1}</Tag>
                  </div>
                  <div className={styles.concurrentTrack}>
                    <div
                      className={styles.concurrentBar}
                      style={{
                        left: `${execution.offsetPercent}%`,
                        width: `${execution.widthPercent}%`,
                      }}
                    >
                      <span>{execution.nodeType}</span>
                    </div>
                  </div>
                  <div className={styles.concurrentDuration}>{formatMs(execution.timelineEnd - execution.timelineStart)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      <div className={styles.nodeListContainer}>
        <div className={styles.sectionTitle}>
          <Text strong>{t('taskHistory.executionDetail.nodeExecutionRecord')}</Text>
        </div>

        {executions.length === 0 ? (
          <Empty description={t('taskHistory.executionDetail.noExecutionRecord')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Collapse
            activeKey={activeKeys}
            onChange={(keys) => setActiveKeys(keys as string[])}
            items={collapseItems}
            expandIcon={({ isActive }) => <RightOutlined rotate={isActive ? 90 : 0} />}
            className={styles.nodeCollapse}
          />
        )}
      </div>
    </Modal>
  );
};

/**
 * 节点执行状态标签
 */
const NodeStatusTag: React.FC<{
  status: NodeExecutionStatus;
  task?: Task | null;
  execution?: TaskNodeExecution;
}> = ({ status, task, execution }) => {
  const { t } = useTranslation();
  // 如果任务被手动中止，需要特殊处理节点状态
  const isTaskCancelled = task?.status === 'cancelled' && task?.cancelledBy;

  // 检查错误信息是否包含 context canceled（手动中止的标志）
  const isContextCanceled = execution?.errorMessage?.toLowerCase().includes('context canceled') ||
    execution?.errorMessage?.toLowerCase().includes('context cancelled');

  // 如果任务被中止，需要特殊处理节点状态
  let displayStatus = status;
  if (isTaskCancelled) {
    if (status === 'pending') {
      // 未执行的节点显示"未执行"
      displayStatus = 'not_executed' as any;
    } else if (status === 'running') {
      // 正在执行的节点应该显示"中止"
      displayStatus = 'cancelled' as any;
    } else if (status === 'failed' && isContextCanceled) {
      // 如果节点失败且错误是 context canceled，说明是手动中止的，应该显示"中止"
      displayStatus = 'cancelled' as any;
    }
  }

  const statusMap: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
    pending: { color: 'default', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.pending') },
    running: { color: 'processing', icon: <ClockCircleOutlined spin={true} />, text: t('taskHistory.nodeStatus.running') },
    completed: { color: 'success', icon: <CheckCircleOutlined />, text: t('taskHistory.nodeStatus.completed') },
    failed: { color: 'error', icon: <CloseCircleOutlined />, text: t('taskHistory.nodeStatus.failed') },
    skipped: { color: 'warning', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.skipped') },
    timeout: { color: 'error', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.timeout') },
    cancelled: { color: 'default', icon: <StopOutlined />, text: t('taskHistory.nodeStatus.cancelled') },
    not_executed: { color: 'default', icon: <ClockCircleOutlined />, text: t('taskHistory.nodeStatus.notExecuted') },
  };

  const config = statusMap[displayStatus] || statusMap.pending;

  return (
    <Tag color={config.color} icon={config.icon}>
      {config.text}
    </Tag>
  );
};

// 辅助函数
const getTaskStatusColor = (status: string) => {
  const colorMap: Record<string, string> = {
    pending: 'default',
    queued: 'processing',
    running: 'processing',
    paused: 'warning',
    completed: 'success',
    failed: 'error',
    cancelled: 'default',
    timeout: 'error',
  };
  return colorMap[status] || 'default';
};

const getTaskStatusText = (status: string, task: Task | null | undefined, t: (key: string) => string) => {
  // 如果是手动中止（cancelledBy 不为空），显示"已终止"
  const isManuallyCancelled = status === 'cancelled' && task?.cancelledBy;

  const textMap: Record<string, string> = {
    pending: t('taskHistory.status.pending'),
    queued: t('taskHistory.status.queued'),
    running: t('taskHistory.status.running'),
    paused: t('taskHistory.status.paused'),
    completed: t('taskHistory.status.completed'),
    failed: t('taskHistory.status.failed'),
    cancelled: isManuallyCancelled ? t('taskHistory.status.terminated') : t('taskHistory.status.cancelled'),
    timeout: t('taskHistory.status.timeout'),
  };
  return textMap[status] || status;
};

export default TaskExecutionDetailModal;

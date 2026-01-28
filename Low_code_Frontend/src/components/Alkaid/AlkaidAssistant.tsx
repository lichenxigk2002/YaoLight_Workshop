import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Card, Space, Typography, Spin, message, List, Empty, Avatar } from 'antd';
import { SendOutlined, CloseOutlined, HistoryOutlined, DeleteOutlined, FileTextOutlined, DownloadOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { AlkaidIcon } from '@/components/Icons';
import AlkaidButton from './AlkaidButton';
import styles from './AlkaidAssistant.module.scss';
import { alkaidApi } from '@/api';
import { extractWorkflowJSON, parseWorkflowJSON, hasWorkflowJSONBlock } from './utils';
import { MarkdownRenderer } from '@/components/WorkflowEditor/utils/MarkdownRenderer';
import ProcessLoader, { ProcessStep } from './ProcessLoader';

const { TextArea } = Input;
const { Text } = Typography;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Session {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface AlkaidAssistantProps {
  workflowId?: string;
  onWorkflowGenerated?: (workflow: any) => void;
  hasExistingNodes?: boolean; // 是否已有工作流节点
}

const AlkaidAssistant: React.FC<AlkaidAssistantProps> = ({
  workflowId,
  onWorkflowGenerated,
  hasExistingNodes = false,
}) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  // 获取用户头像URL，处理不同后端的字段名差异
  const getUserAvatar = () => {
    if (!user) return undefined;
    // 优先使用 avatar_url，其次尝试 avatar (如果是旧数据)，最后尝试构建 URL
    if (user.avatar_url) {
      if (user.avatar_url.startsWith('http')) return user.avatar_url;
      // 如果是相对路径，拼接 API 基础路径
      const baseURL = import.meta.env.VITE_BASE_URL || '/api';
      // 检查 user.avatar_url 是否已经包含 uploads/ 前缀（兼容性处理）
      if (user.avatar_url.startsWith('uploads/') || user.avatar_url.startsWith('/uploads/')) {
        const cleanPath = user.avatar_url.startsWith('/') ? user.avatar_url.substring(1) : user.avatar_url;
        return `${baseURL}/${cleanPath}`;
      }
      return `${baseURL}/uploads/${user.avatar_url}`;
    }
    return undefined;
  };

  const [visible, setVisible] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessionList, setShowSessionList] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [processSteps, setProcessSteps] = useState<ProcessStep[]>([]);
  const [cancelStream, setCancelStream] = useState<(() => void) | null>(null);
  const [currentLoadingMessageId, setCurrentLoadingMessageId] = useState<string | null>(null);
  const [needsWorkflow, setNeedsWorkflow] = useState<boolean | null>(null); // 是否需要生成工作流
  const needsWorkflowRef = useRef<boolean | null>(null); // 使用ref确保在流式输出过程中能实时获取最新值
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const isSendingFirstMessage = useRef(false); // 标记是否正在发送第一条消息
  const accumulatedContentRef = useRef(''); // 用于累积流式内容
  const isSendingMessage = useRef(false); // 标记是否正在发送消息（包括第一条和后续消息）

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (visible) {
      scrollToBottom();
      // 聚焦输入框
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      // 加载会话列表
      loadSessions();
    }
  }, [visible]);

  useEffect(() => {
    // 如果正在发送消息（包括第一条和后续消息），不要加载消息（避免覆盖本地状态）
    if (isSendingMessage.current) {
      return;
    }

    if (visible && sessionId) {
      // 如果切换了会话，加载该会话的消息
      loadMessages(sessionId);
    } else if (visible && !sessionId) {
      // 如果没有会话，清空消息
      setMessages([]);
    }
  }, [visible, sessionId]);

  // 组件卸载时取消流
  useEffect(() => {
    return () => {
      if (cancelStream) {
        cancelStream();
      }
    };
  }, [cancelStream]);

  // 创建会话（在发送第一条消息时调用）
  const createSession = async () => {
    try {
      const session = await alkaidApi.createSession({
        title: '新对话',
        workflowId: workflowId ? parseInt(workflowId) : undefined,
      });
      setSessionId(session.id);
      return session.id;
    } catch (error: any) {
      message.error(t('alkaid.createSessionFailed') || '创建会话失败');
      console.error('Create session error:', error);
      throw error;
    }
  };

  const loadSessions = async () => {
    try {
      setLoadingSessions(true);
      const result = await alkaidApi.getSessions(1, 20);
      setSessions(result.list || []);
    } catch (error) {
      console.error('Load sessions error:', error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadMessages = async (sid: number) => {
    try {
      const msgs = await alkaidApi.getMessages(sid);
      const formattedMessages: Message[] = msgs.map((msg: any) => ({
        id: msg.id.toString(),
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.createdAt),
      }));
      setMessages(formattedMessages);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  };

  const handleSelectSession = async (sid: number) => {
    setSessionId(sid);
    setShowSessionList(false);
    await loadMessages(sid);
  };

  const handleDeleteSession = async (sid: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await alkaidApi.deleteSession(sid);
      message.success(t('alkaid.sessionDeleted') || '会话已删除');
      // 如果删除的是当前会话，清空状态
      if (sessionId === sid) {
        setSessionId(null);
        setMessages([]);
      }
      // 重新加载会话列表
      await loadSessions();
    } catch (error: any) {
      message.error(t('alkaid.deleteSessionFailed') || '删除会话失败');
      console.error('Delete session error:', error);
    }
  };

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setShowSessionList(false);
  };

  const updateProcessStep = (stepId: string, status: 'loading' | 'completed') => {
    setProcessSteps(prev => {
      const newSteps = [...prev];
      const stepIndex = newSteps.findIndex(s => s.id === stepId);

      if (stepIndex !== -1) {
        // 更新当前步骤状态
        newSteps[stepIndex] = { ...newSteps[stepIndex], status };

        // 如果当前步骤完成了，且有下一步，将下一步设为 loading
        if (status === 'completed' && stepIndex < newSteps.length - 1) {
          newSteps[stepIndex + 1] = { ...newSteps[stepIndex + 1], status: 'loading' };
        }
      }
      return newSteps;
    });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    // 标记正在发送消息
    isSendingMessage.current = true;

    // 使用更精确的时间戳和随机数生成唯一ID，避免冲突
    const now = Date.now();
    const userMessage: Message = {
      id: `user-${now}-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageContent = inputValue.trim();
    setInputValue('');
    setLoading(true);

    // 重置工作流需求标志
    setNeedsWorkflow(null);
    needsWorkflowRef.current = null;
    
    // 初始化步骤为空（意图分析阶段不显示，等第二阶段AI开始处理时才显示）
    setProcessSteps([]);

    try {
      // 如果没有会话ID，先创建会话
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        // 标记正在发送第一条消息，防止 useEffect 触发 loadMessages
        isSendingFirstMessage.current = true;

        currentSessionId = await createSession();
        if (!currentSessionId) {
          throw new Error('创建会话失败');
        }
        // 创建新会话后，刷新会话列表
        await loadSessions();
      }

      // 创建助手消息占位（使用不同的ID前缀，确保不会与用户消息ID冲突）
      const assistantMsgId = `assistant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setCurrentLoadingMessageId(assistantMsgId);
      // 重置累积内容
      accumulatedContentRef.current = '';
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      // 使用流式接口发送消息（后端强制启用流式输出）

      const cancel = alkaidApi.sendMessageStream(
        currentSessionId,
        messageContent,
        (content, step, done) => {
          // 根据后端返回的步骤动态初始化步骤显示
          if (step === 'understanding' && processSteps.length === 0) {
            // 第一次收到understanding步骤，初始化步骤列表
            // 此时还不知道是否需要工作流，先显示通用步骤
            setProcessSteps([
              { id: 'understanding', label: '正在努力理解您的需求呢~ ', status: 'loading' },
              { id: 'retrieving', label: '正在知识库里寻找答案呢 ', status: 'pending' },
              { id: 'generating', label: '正在为您精心编织工作流呢 ', status: 'pending' },
              { id: 'completed', label: '完成啦！快来看看吧~ ', status: 'pending' },
            ]);
          }

          // 如果收到replying步骤，说明不需要生成工作流，调整步骤显示
          if (step === 'replying') {
            setNeedsWorkflow(false);
            needsWorkflowRef.current = false; // 同步更新ref
            // 更新步骤为：理解 → 回复 → 完成
            setProcessSteps([
              { id: 'understanding', label: '正在努力理解您的需求呢~ ', status: 'completed' },
              { id: 'replying', label: '正在为您回复呢 ', status: 'loading' },
              { id: 'completed', label: '完成啦！快来看看吧~ ', status: 'pending' },
            ]);
          }

          // 累加流式内容（后端发送的是增量内容）
          if (content) {
            accumulatedContentRef.current += content;
            // 更新消息内容（使用累加后的完整内容）
            // 确保只更新助手消息，并且保持 role 为 'assistant'
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, role: 'assistant' as const, content: accumulatedContentRef.current }
                : msg
            ));
          }

          // 更新步骤状态
          if (step) {
            // 如果收到新的步骤，说明上一步完成了
            if (step === 'understanding') {
              // 已经在初始化时设为 loading
            } else if (step === 'retrieving') {
              updateProcessStep('understanding', 'completed');
              setNeedsWorkflow(true); // 收到retrieving说明需要生成工作流
              needsWorkflowRef.current = true; // 同步更新ref
            } else if (step === 'generating') {
              updateProcessStep('retrieving', 'completed');
            } else if (step === 'replying') {
              // 不需要生成工作流时的回复步骤
              updateProcessStep('understanding', 'completed');
            } else if (step === 'completed') {
              // 根据当前 needsWorkflow 状态更新步骤
              setNeedsWorkflow(prev => {
                if (prev === true) {
                  updateProcessStep('generating', 'completed');
                } else if (prev === false) {
                  updateProcessStep('replying', 'completed');
                } else {
                  // 如果还没有确定，默认按生成工作流处理
                  updateProcessStep('generating', 'completed');
                }
                return prev;
              });
              updateProcessStep('completed', 'completed');
            }
          }

          if (done) {
            setLoading(false);
            setCancelStream(null);
            setCurrentLoadingMessageId(null);
            isSendingFirstMessage.current = false;
            isSendingMessage.current = false; // 标记消息发送完成
            // 重置累积内容
            accumulatedContentRef.current = '';
            // 延迟清除步骤显示和重置工作流标志
            setTimeout(() => {
              setProcessSteps([]);
              setNeedsWorkflow(null);
              needsWorkflowRef.current = null;
            }, 3000);
          }
        },
        (error) => {
          message.error(t('alkaid.sendMessageFailed') || '发送消息失败: ' + error);
          setLoading(false);
          setCancelStream(null);
          setCurrentLoadingMessageId(null);
          isSendingFirstMessage.current = false;
          isSendingMessage.current = false; // 标记消息发送完成（即使失败）
          setProcessSteps([]);
        }
      );

      setCancelStream(() => cancel);

    } catch (error: any) {
      // 如果发送失败，移除刚才添加的用户消息
      setMessages((prev) => prev.filter(msg => msg.id !== userMessage.id));
      message.error(t('alkaid.sendMessageFailed') || '发送消息失败: ' + (error.message || '未知错误'));
      console.error('Send message error:', error);

      // 发送失败也要清除标记
      isSendingFirstMessage.current = false;
      isSendingMessage.current = false; // 标记消息发送完成（即使失败）
      setLoading(false);
      setCurrentLoadingMessageId(null);
      setProcessSteps([]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  // 解析消息内容，将工作流JSON替换为文件图标
  const parseMessageContent = (content: string, isGenerating: boolean = false, shouldCheckWorkflow: boolean = true) => {
    // 如果不需要检测工作流，直接返回原始内容
    if (!shouldCheckWorkflow) {
      return { hasWorkflow: false, text: content, isGenerating: false };
    }

    // 检测是否有工作流JSON代码块（包括未完成的）
    const hasJSONBlock = hasWorkflowJSONBlock(content);
    
    if (hasJSONBlock) {
      // 尝试提取完整的JSON
      const workflowJSON = extractWorkflowJSON(content);
      
      // 只移除工作流JSON代码块（带特殊标记的），保留其他JSON
      let textWithoutJson = content;
      
      // 1. 移除带特殊标记的工作流JSON代码块（新格式）
      // 格式：<!-- workflow-json -->\n```json\n{...}\n```
      textWithoutJson = textWithoutJson.replace(/<!--\s*workflow-json\s*-->[\s\S]*?```json\s*[\s\S]*?```/g, '');
      // 移除未完成的带标记的工作流JSON（到文本末尾）
      textWithoutJson = textWithoutJson.replace(/<!--\s*workflow-json\s*-->[\s\S]*?```json\s*[\s\S]*$/gm, '');
      
      // 2. 兼容旧格式：移除包含工作流关键字段的JSON代码块（如果没有特殊标记）
      // 只处理包含 "version" 和 "nodes" 的JSON（工作流特征）
      const workflowJsonPattern = /```json\s*[\s\S]*?"version"[\s\S]*?"nodes"[\s\S]*?```/g;
      textWithoutJson = textWithoutJson.replace(workflowJsonPattern, '');
      // 移除未完成的（到文本末尾）
      textWithoutJson = textWithoutJson.replace(/```json\s*[\s\S]*?"version"[\s\S]*?"nodes"[\s\S]*$/gm, '');
      
      // 3. 移除不在代码块中的工作流JSON对象（包含 "version" 和 "nodes"）
      const workflowJsonObjectPattern = /\{\s*"version"[\s\S]*?"nodes"[\s\S]*?\}/g;
      textWithoutJson = textWithoutJson.replace(workflowJsonObjectPattern, '');
      // 移除未完成的（到文本末尾）
      textWithoutJson = textWithoutJson.replace(/\{\s*"version"[\s\S]*?"nodes"[\s\S]*$/gm, '');
      
      // 4. 清理多余的换行和空格
      textWithoutJson = textWithoutJson
        .replace(/\n{3,}/g, '\n\n') // 多个换行合并为两个
        .replace(/^\s+|\s+$/g, '') // 移除首尾空白
        .trim();

      return {
        hasWorkflow: true,
        text: textWithoutJson,
        workflowJSON: workflowJSON || null, // 如果提取不到完整JSON，返回null表示还在生成中
        isGenerating: isGenerating && !workflowJSON, // 如果正在生成且提取不到完整JSON，说明还在生成中
      };
    }

    // 如果没有检测到工作流JSON代码块，返回原始内容
    return { hasWorkflow: false, text: content, isGenerating: false };
  };

  // 处理导入工作流
  const handleImportWorkflow = (workflowJSON: string) => {
    // 检查是否已有工作流节点
    if (hasExistingNodes) {
      message.warning(t('alkaid.hasExistingWorkflow') || '工作流编辑器中已有节点，导入将替换现有工作流。请先清空后再导入。');
      return;
    }

    const workflow = parseWorkflowJSON(workflowJSON);
    if (workflow && onWorkflowGenerated) {
      onWorkflowGenerated(workflow);
      message.success(t('alkaid.workflowImported') || '工作流已导入');
    } else {
      message.error(t('alkaid.importFailed') || '导入失败：工作流格式无效');
    }
  };

  // 处理下载工作流
  const handleDownloadWorkflow = (workflowJSON: string) => {
    try {
      const workflow = parseWorkflowJSON(workflowJSON);
      if (!workflow) {
        message.error(t('alkaid.downloadFailed') || '下载失败：工作流格式无效');
        return;
      }

      // 构建导出数据
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        nodes: workflow.nodes || [],
        edges: workflow.edges || [],
      };

      // 转换为JSON字符串
      const jsonString = JSON.stringify(exportData, null, 2);

      // 创建Blob对象
      const blob = new Blob([jsonString], { type: 'application/json' });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;

      // 设置文件名
      const fileName = `workflow_${new Date().toISOString().split('T')[0]}.json`;
      link.download = fileName;

      // 触发下载
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success(t('alkaid.workflowDownloaded') || '工作流已下载');
    } catch (error: any) {
      message.error(t('alkaid.downloadFailed') || '下载失败: ' + (error.message || '未知错误'));
    }
  };

  return (
    <>
      {/* 悬浮按钮 */}
      <div className={styles.floatingButton}>
        <AlkaidButton onClick={() => setVisible(true)} />
      </div>

      {/* 对话窗口 */}
      {visible && (
        <div className={styles.chatWindow}>
          <Card
            className={styles.chatCard}
            title={
              <Space>
                <AlkaidIcon size={18} />
                <span>{t('alkaid.title') || '瑶光星助手'}</span>
              </Space>
            }
            extra={
              <Space>
                <Button
                  type="text"
                  icon={<HistoryOutlined />}
                  onClick={() => setShowSessionList(!showSessionList)}
                  size="small"
                  title={t('alkaid.sessionHistory') || '会话历史'}
                />
                <Button
                  type="text"
                  icon={<CloseOutlined />}
                  onClick={handleClose}
                  size="small"
                />
              </Space>
            }
            bodyStyle={{ padding: 0, height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {/* 会话列表侧边栏 */}
            {showSessionList && (
              <div className={styles.sessionSidebar}>
                <div className={styles.sidebarHeader}>
                  <Typography.Text strong>{t('alkaid.sessionHistory') || '会话历史'}</Typography.Text>
                  <Button
                    type="text"
                    size="small"
                    onClick={handleNewChat}
                    style={{ marginLeft: 'auto' }}
                  >
                    {t('alkaid.newChat') || '新建对话'}
                  </Button>
                </div>
                <div className={styles.sidebarContent}>
                  {loadingSessions ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <Spin size="small" />
                    </div>
                  ) : sessions.length === 0 ? (
                    <Empty
                      description={t('alkaid.noSessions') || '暂无会话'}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      style={{ marginTop: '40px' }}
                    />
                  ) : (
                    <List
                      dataSource={sessions}
                      renderItem={(session) => (
                        <List.Item
                          className={`${styles.sessionItem} ${sessionId === session.id ? styles.active : ''}`}
                          onClick={() => handleSelectSession(session.id)}
                          style={{ cursor: 'pointer', padding: '12px 16px' }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Typography.Text
                              ellipsis
                              style={{
                                display: 'block',
                                fontWeight: sessionId === session.id ? 500 : 400,
                              }}
                            >
                              {session.title}
                            </Typography.Text>
                            <Typography.Text
                              type="secondary"
                              style={{ fontSize: '12px', display: 'block', marginTop: '4px' }}
                            >
                              {new Date(session.updatedAt).toLocaleString('zh-CN', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Typography.Text>
                          </div>
                          <Button
                            type="text"
                            size="small"
                            icon={<DeleteOutlined />}
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            danger
                            style={{ marginLeft: '8px' }}
                          />
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 会话列表遮罩层 */}
            {showSessionList && (
              <div
                className={styles.sessionOverlay}
                onClick={() => setShowSessionList(false)}
              />
            )}

            {/* 消息列表 */}
            <div className={styles.messagesContainer}>
              {messages.length === 0 && (
                <div className={styles.emptyState}>
                  <AlkaidIcon size={48} style={{ color: '#d9d9d9', marginBottom: 16 }} />
                  <Text type="secondary">
                    {t('alkaid.emptyState') || '你好！我是瑶光星助手，可以帮助你生成工作流。试试说："帮我生成一个抓取网页并总结的工作流"'}
                  </Text>
                </div>
              )}

              {messages.map((msg) => {
                // 检查是否是正在加载的助手消息
                const isCurrentLoadingMessage = msg.role === 'assistant' && msg.id === currentLoadingMessageId && loading && processSteps.length > 0;

                return (
                  <div
                    key={msg.id}
                    className={`${styles.message} ${styles[msg.role]}`}
                  >
                    <div className={styles.messageContent}>
                      <div className={styles.messageBubble}>
                        <div className={styles.messageText}>
                          {/* 如果是正在加载的助手消息，显示步骤 */}
                          {isCurrentLoadingMessage && (
                            <div className={styles.processStepsWrapper}>
                              <ProcessLoader steps={processSteps} visible={true} />
                            </div>
                          )}

                          {(() => {
                            // 使用ref获取最新的needsWorkflow值，确保在流式输出过程中能实时获取
                            const currentNeedsWorkflow = needsWorkflowRef.current;
                            // 只有在明确需要生成工作流时才检测和显示工作流
                            const shouldCheckWorkflow = currentNeedsWorkflow === true;
                            // 判断是否正在生成中（当前消息是正在加载的助手消息）
                            const isMsgGenerating = isCurrentLoadingMessage && loading && shouldCheckWorkflow;
                            // 只有在需要生成工作流时才检查JSON代码块
                            const parsed = parseMessageContent(msg.content, isMsgGenerating, shouldCheckWorkflow);
                            // 只有在明确需要生成工作流时才显示工作流卡片
                            const shouldShowWorkflow = parsed.hasWorkflow && currentNeedsWorkflow === true;
                            return (
                              <>
                                {parsed.text && (
                                  <div className={styles.markdownContent}>
                                    <MarkdownRenderer content={parsed.text} />
                                  </div>
                                )}
                                {shouldShowWorkflow && (
                                  <div className={styles.workflowFileCard}>
                                    <div className={styles.workflowFileIcon}>
                                      <FileTextOutlined style={{ fontSize: 16, color: 'var(--primary)' }} />
                                    </div>
                                    <div className={styles.workflowFileInfo}>
                                      <Typography.Text strong style={{ display: 'block', fontSize: '12px', lineHeight: '1.4' }}>
                                        {t('alkaid.workflowFile') || '工作流文件'}
                                      </Typography.Text>
                                      {parsed.isGenerating ? (
                                        <Space size={4} style={{ marginTop: '4px' }}>
                                          <Spin size="small" />
                                          <Typography.Text type="secondary" style={{ fontSize: '10px', lineHeight: '1.4' }}>
                                            {t('alkaid.generating') || '生成中...'}
                                          </Typography.Text>
                                        </Space>
                                      ) : parsed.workflowJSON ? (
                                        <>
                                          <Typography.Text type="secondary" style={{ fontSize: '10px', display: 'block', lineHeight: '1.4' }}>
                                            {t('alkaid.clickToImport') || '点击导入到工作流编辑器'}
                                          </Typography.Text>
                                          <Space size={4} style={{ marginTop: '4px' }}>
                                            <Button
                                              type="primary"
                                              size="small"
                                              icon={<UploadOutlined />}
                                              onClick={() => handleImportWorkflow(parsed.workflowJSON!)}
                                              style={{ fontSize: '11px', height: '22px', padding: '0 6px' }}
                                            >
                                              {t('alkaid.import') || '导入'}
                                            </Button>
                                            <Button
                                              size="small"
                                              icon={<DownloadOutlined />}
                                              onClick={() => handleDownloadWorkflow(parsed.workflowJSON!)}
                                              style={{ fontSize: '11px', height: '22px', padding: '0 6px' }}
                                            >
                                              {t('alkaid.download') || '下载'}
                                            </Button>
                                          </Space>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>

                      {/* 用户头像 - 右侧 */}
                      {msg.role === 'user' && (
                        <div className={styles.avatarWrapper}>
                          <Avatar
                            src={getUserAvatar()}
                            icon={<UserOutlined />}
                            className={styles.userAvatar}
                            size={28}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </div>

            {/* 输入框 */}
            <div className={styles.inputContainer}>
              <div className={styles.inputWrapper}>
                <TextArea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('alkaid.inputPlaceholder') || '输入你的需求...'}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={loading}
                  className={styles.input}
                />
                <button
                  className={styles.sendButton}
                  onClick={handleSend}
                  disabled={!inputValue.trim() || loading}
                  type="button"
                  aria-label={t('alkaid.send') || '发送'}
                >
                  {loading ? (
                    <Spin size="small" />
                  ) : (
                    <SendOutlined />
                  )}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};

export default AlkaidAssistant;

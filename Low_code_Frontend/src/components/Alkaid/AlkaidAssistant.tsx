import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, Card, Space, Typography, Spin, message, List, Empty, Avatar } from 'antd';
import { SendOutlined, CloseOutlined, HistoryOutlined, DeleteOutlined, FileTextOutlined, DownloadOutlined, UploadOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';
import { AlkaidIcon } from '@/components/Icons';
import AlkaidButton from './AlkaidButton';
import styles from './AlkaidAssistant.module.scss';
import { alkaidApi } from '@/api';
import { extractWorkflowJSON, parseWorkflowJSON } from './utils';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<any>(null);
  const isSendingFirstMessage = useRef(false); // 标记是否正在发送第一条消息

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
    // 如果正在发送第一条消息，不要加载消息（避免覆盖本地状态）
    if (isSendingFirstMessage.current) {
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

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageContent = inputValue.trim();
    setInputValue('');
    setLoading(true);

    // 初始化步骤
    setProcessSteps([
      { id: 'understanding', label: '正在努力理解您的需求呢~ 💭', status: 'loading' },
      { id: 'retrieving', label: '正在知识库里寻找答案呢 📖', status: 'pending' },
      { id: 'generating', label: '正在为您精心编织工作流呢 ✨', status: 'pending' },
      { id: 'completed', label: '完成啦！快来看看吧~ 🎉', status: 'pending' },
    ]);

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

      // 创建助手消息占位
      const assistantMsgId = Date.now().toString();
      setCurrentLoadingMessageId(assistantMsgId);
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

      // 使用流式接口发送消息
      const cancel = alkaidApi.sendMessageStream(
        currentSessionId,
        messageContent,
        (content, step, done) => {
          // 更新消息内容
          if (content) {
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMsgId
                ? { ...msg, content }
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
            } else if (step === 'generating') {
              updateProcessStep('retrieving', 'completed');
            } else if (step === 'completed') {
              updateProcessStep('generating', 'completed');
              updateProcessStep('completed', 'completed');
            }
          }

          if (done) {
            setLoading(false);
            setCancelStream(null);
            setCurrentLoadingMessageId(null);
            isSendingFirstMessage.current = false;
            // 延迟清除步骤显示
            setTimeout(() => setProcessSteps([]), 3000);
          }
        },
        (error) => {
          message.error(t('alkaid.sendMessageFailed') || '发送消息失败: ' + error);
          setLoading(false);
          setCancelStream(null);
          setCurrentLoadingMessageId(null);
          isSendingFirstMessage.current = false;
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
  const parseMessageContent = (content: string) => {
    const workflowJSON = extractWorkflowJSON(content);
    if (!workflowJSON) {
      return { hasWorkflow: false, text: content };
    }

    // 移除JSON代码块，保留其他文本
    const textWithoutJson = content
      .replace(/```json\s*[\s\S]*?```/g, '')
      .replace(/```\s*[\s\S]*?```/g, '')
      .trim();

    return {
      hasWorkflow: true,
      text: textWithoutJson,
      workflowJSON,
    };
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
                            const parsed = parseMessageContent(msg.content);
                            return (
                              <>
                                {parsed.text && (
                                  <div className={styles.markdownContent}>
                                    <MarkdownRenderer content={parsed.text} />
                                  </div>
                                )}
                                {parsed.hasWorkflow && (
                                  <div className={styles.workflowFileCard}>
                                    <div className={styles.workflowFileIcon}>
                                      <FileTextOutlined style={{ fontSize: 16, color: 'var(--primary)' }} />
                                    </div>
                                    <div className={styles.workflowFileInfo}>
                                      <Typography.Text strong style={{ display: 'block', fontSize: '12px', lineHeight: '1.4' }}>
                                        {t('alkaid.workflowFile') || '工作流文件'}
                                      </Typography.Text>
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

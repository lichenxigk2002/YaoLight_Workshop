import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Avatar, Button, Empty, Input, Popconfirm, Popover, Spin, Tooltip } from 'antd';
import {
  AndroidOutlined,
  AppleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EnvironmentOutlined,
  LinuxOutlined,
  MessageOutlined,
  SendOutlined,
  WindowsOutlined,
} from '@ant-design/icons';
import { FluentEmoji } from '@lobehub/fluent-emoji';
import { useAuthStore } from '@/store/auth';
import { interactionApi } from '@/api/interactions';
import type { CommentItem, CommentsResponse, InteractionResourceType } from '@/types/interactions';
import styles from './CommentPanel.module.scss';

const emojiGroups = [
  { key: 'recent', label: '常用', items: ['👍', '❤️', '😂', '🎉', '🤔', '👏', '🙏', '🔥', '💯', '🙌', '✅', '👀'] },
  { key: 'face', label: '表情', items: ['😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍', '😘', '😎', '🤩', '🥳', '😅', '😂', '🤣', '😭', '🥹', '😢', '😡', '😤', '😴', '🤔', '🤨', '😐'] },
  { key: 'gesture', label: '手势', items: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '👏', '🙌', '🙏', '💪', '👊', '🤝', '👋', '☝️', '👇', '👈', '👉', '🫶', '🤲', '✍️', '🫰', '🫵', '🖖'] },
  { key: 'work', label: '反馈', items: ['✅', '❌', '⚠️', '💡', '🚀', '⭐', '🌟', '🔥', '💯', '📌', '🔍', '📝', '📎', '💬', '📣', '🎯', '🏆', '⏰', '🧩', '🛠️', '📈', '📉', '🔒', '🔓'] },
  { key: 'object', label: '物品', items: ['🎁', '🎈', '🎊', '🎉', '💎', '💰', '📚', '📖', '💻', '⌨️', '🖱️', '📱', '🎧', '📷', '☕', '🍵', '🍰', '🍔', '🍕', '🍻', '🌈', '☀️', '🌙', '⚡'] },
];

const timezoneLocationMap: Record<string, string> = {
  'Asia/Shanghai': '中国上海',
  'Asia/Chongqing': '中国重庆',
  'Asia/Urumqi': '中国乌鲁木齐',
  'Asia/Hong_Kong': '中国香港',
  'Asia/Macau': '中国澳门',
  'Asia/Taipei': '中国台北',
  'Asia/Tokyo': '日本东京',
  'Asia/Seoul': '韩国首尔',
  'America/New_York': '美国纽约',
  'America/Los_Angeles': '美国洛杉矶',
  'Europe/London': '英国伦敦',
  'Europe/Paris': '法国巴黎',
};

const SmileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 14.2c.8 1.2 2 1.8 3.5 1.8s2.7-.6 3.5-1.8" />
    <path d="M9 9.5h.01" />
    <path d="M15 9.5h.01" />
  </svg>
);

interface CommentPanelProps {
  resourceType: InteractionResourceType;
  resourceId: number;
  title?: string;
  compact?: boolean;
}

function detectDeviceModel() {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Browser';
}

function detectLocation() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone ? formatLocationLabel(timezone) : '';
  } catch {
    return '';
  }
}

function formatLocationLabel(value?: string | null) {
  if (!value) return '';
  const normalized = value.trim();
  if (!normalized) return '';
  if (timezoneLocationMap[normalized]) return timezoneLocationMap[normalized];
  const parts = normalized.split('/');
  const city = parts[parts.length - 1]?.replace(/_/g, ' ');
  return city || normalized.replace(/_/g, ' ');
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDeviceIcon(deviceModel?: string | null) {
  const normalized = (deviceModel || '').toLowerCase();
  if (!normalized) return <DesktopOutlined />;
  if (normalized.includes('mac') || normalized.includes('iphone') || normalized.includes('ipad') || normalized.includes('ios')) {
    return <AppleOutlined />;
  }
  if (normalized.includes('windows')) return <WindowsOutlined />;
  if (normalized.includes('android')) return <AndroidOutlined />;
  if (normalized.includes('linux')) return <LinuxOutlined />;
  return <DesktopOutlined />;
}

const CommentPanel: React.FC<CommentPanelProps> = ({ resourceType, resourceId, title = '评论', compact = false }) => {
  const { message } = App.useApp();
  const currentUser = useAuthStore((state) => state.user);
  const [data, setData] = useState<CommentsResponse>({ items: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState('');
  const [replyTarget, setReplyTarget] = useState<CommentItem | null>(null);
  const [replyParentId, setReplyParentId] = useState<number | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiGroup, setEmojiGroup] = useState(emojiGroups[0].key);

  const metaPayload = useMemo(() => ({
    location: detectLocation(),
    deviceModel: detectDeviceModel(),
  }), []);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await interactionApi.listComments(resourceType, resourceId);
      setData(response);
    } finally {
      setLoading(false);
    }
  }, [resourceType, resourceId]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  const submitComment = async (text: string, parentId?: number) => {
    const normalized = text.trim();
    if (!normalized) {
      message.warning('评论内容不能为空');
      return;
    }
    try {
      setSubmitting(true);
      const response = await interactionApi.createComment(resourceType, resourceId, {
        parentId,
        content: normalized,
        ...metaPayload,
      });
      setData(response);
      setContent('');
      setReplyTarget(null);
      setReplyParentId(undefined);
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId: number) => {
    await interactionApi.deleteComment(commentId);
    await loadComments();
  };

  const flattenReplies = (items: CommentItem[]): CommentItem[] => {
    return items.flatMap((item) => [
      item,
      ...(Array.isArray(item.replies) ? flattenReplies(item.replies) : []),
    ]);
  };

  const startReply = (target: CommentItem, parentId: number) => {
    setReplyTarget(target);
    setReplyParentId(parentId);
  };

  const renderComment = (item: CommentItem, depth = 0, threadParentId = item.id): React.ReactNode => {
    const replies = depth === 0 && Array.isArray(item.replies) ? flattenReplies(item.replies) : [];
    const hasReplies = replies.length > 0;
    const displayName = item.user.username || '用户';
    const hasMeta = Boolean(item.location || item.deviceModel);
    const locationLabel = formatLocationLabel(item.location);
    return (
      <div
        key={item.id}
        className={`${styles.comment} ${depth > 0 ? styles.nestedComment : ''}`}
        data-depth={Math.min(depth, 3)}
      >
        <Avatar className={styles.avatar} size={compact || depth > 0 ? 24 : 30} src={item.user.avatarUrl || undefined}>
          {displayName.slice(0, 1).toUpperCase()}
        </Avatar>
        <div className={styles.body}>
          <div className={styles.commentHead}>
            <div className={styles.commentTop}>
              <span className={styles.name}>{displayName}</span>
              <span className={styles.dot} />
              <span className={styles.meta}>{formatTime(item.createdAt)}</span>
            </div>
            <div className={styles.actions}>
              <Button size="small" type="text" className={styles.textAction} disabled={!currentUser} onClick={() => startReply(item, threadParentId)}>
                回复
              </Button>
              {item.canDelete ? (
                <Popconfirm title="删除这条评论？" onConfirm={() => void deleteComment(item.id)}>
                  <Tooltip title="删除">
                    <Button size="small" type="text" danger className={styles.iconAction} icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              ) : null}
            </div>
          </div>
          {hasMeta ? (
            <div className={styles.metaRow}>
              {locationLabel ? (
                <span className={styles.metaItem}>
                  <EnvironmentOutlined />
                  {locationLabel}
                </span>
              ) : null}
              {item.deviceModel ? (
                <span className={styles.metaItem}>
                  {getDeviceIcon(item.deviceModel)}
                  {item.deviceModel}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className={styles.content}>{item.content}</div>
          {hasReplies ? (
            <div className={styles.replies}>
              {replies.map((reply) => renderComment(reply, 1, threadParentId))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.panel} ${compact ? styles.compact : ''}`}>
      <div className={styles.header}>
        <div className={styles.title}><MessageOutlined /> {title}</div>
        <div className={styles.count}>{data.total} 条</div>
      </div>
      <div className={styles.scrollArea}>
        <Spin spinning={loading}>
          <div className={styles.list}>
            {data.items.length ? data.items.map((item) => renderComment(item)) : (
              <Empty className={styles.empty} image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无评论" />
            )}
          </div>
        </Spin>
      </div>
      <div className={styles.composer}>
        <div className={`${styles.inputShell} ${replyTarget ? styles.replying : ''}`}>
          <Input.TextArea
            value={content}
            autoSize={compact ? { minRows: 1, maxRows: 3 } : { minRows: 1, maxRows: 4 }}
            placeholder={currentUser ? (replyTarget ? `回复：${replyTarget.user.username || '用户'}` : '写下你的评论…') : '登录后可评论'}
            disabled={!currentUser}
            onChange={(event) => setContent(event.target.value)}
          />
          <div className={styles.inputActions}>
            {replyTarget ? (
              <Tooltip title="取消回复">
                <Button type="text" className={styles.inlineAction} icon={<CloseOutlined />} onClick={() => {
                  setReplyTarget(null);
                  setReplyParentId(undefined);
                }} />
              </Tooltip>
            ) : null}
            <Popover
              trigger="click"
              open={emojiOpen}
              onOpenChange={setEmojiOpen}
              placement="topRight"
              content={(
                <div className={styles.emojiPopover}>
                  <div className={styles.emojiTabs}>
                    {emojiGroups.map((group) => (
                      <button
                        key={group.key}
                        type="button"
                        className={`${styles.emojiTab} ${emojiGroup === group.key ? styles.emojiTabActive : ''}`}
                        onClick={() => setEmojiGroup(group.key)}
                      >
                        {group.label}
                      </button>
                    ))}
                  </div>
                  <div className={styles.emojiGrid}>
                    {(emojiGroups.find((group) => group.key === emojiGroup) || emojiGroups[0]).items.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={styles.emojiChoice}
                        onClick={() => {
                          setContent((value) => `${value}${emoji}`);
                          setEmojiOpen(false);
                        }}
                      >
                        <FluentEmoji emoji={emoji} size={22} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            >
              <Button type="text" className={styles.inlineAction} icon={<SmileIcon />} disabled={!currentUser} />
            </Popover>
          </div>
        </div>
        <Button className={styles.sendButton} icon={<SendOutlined />} loading={submitting} disabled={!currentUser} onClick={() => void submitComment(content, replyParentId)} />
      </div>
    </div>
  );
};

export default CommentPanel;

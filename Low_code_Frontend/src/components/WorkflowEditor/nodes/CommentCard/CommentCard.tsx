import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { Input, Popover } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './CommentCard.module.scss';

// 预设颜色列表
const PRESET_COLORS = [
  '#fffacd', // 柠檬黄
  '#ffe4e1', // 淡粉
  '#e0f2f1', // 淡青
  '#f3e5f5', // 淡紫
  '#fff9c4', // 淡黄
  '#e8f5e9', // 淡绿
  '#e1f5fe', // 淡蓝
  '#fce4ec', // 淡玫瑰
];

const CommentCard: React.FC<NodeProps> = ({ data, selected, id }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data?.text || '');
  const [color, setColor] = useState(data?.color || '#fffacd');
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const inputRef = useRef<any>(null);

  // 同步外部数据变化
  useEffect(() => {
    if (data?.text !== undefined && data.text !== text) {
      setText(data.text);
    }
    if (data?.color !== undefined && data.color !== color) {
      setColor(data.color);
    }
  }, [data?.text, data?.color]);

  // 当节点被选中时，如果文本为空，自动进入编辑模式
  useEffect(() => {
    if (selected && !text && !isEditing) {
      setIsEditing(true);
    }
  }, [selected, text, isEditing]);

  // 当进入编辑模式时，聚焦输入框
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // 保存文本
  const handleTextChange = useCallback((value: string) => {
    setText(value);
    // 更新节点数据
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                text: value,
              },
            }
          : node
      )
    );
  }, [id, setNodes]);

  // 处理颜色变化
  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
    // 更新节点数据
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id
          ? {
              ...node,
              data: {
                ...node.data,
                color: newColor,
              },
            }
          : node
      )
    );
  }, [id, setNodes]);

  // 点击卡片进入编辑模式
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.ant-input')) {
      return;
    }
    setIsEditing(true);
  }, []);

  // 失去焦点时退出编辑模式
  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const diffMark = (data as any).diffMark;
  const getBorderColor = () => {
      if (diffMark === 'add') return '#52c41a';
      if (diffMark === 'remove') return '#ff4d4f';
      if (diffMark === 'update') return '#faad14';
      if (selected) return 'var(--primary)';
      return 'transparent';
  };

  return (
    <div
      className={`${styles.commentCard} ${selected ? styles.selected : ''}`}
      style={{
        backgroundColor: color,
        border: `2px solid ${getBorderColor()}`,
        opacity: diffMark === 'remove' ? 0.7 : 1,
      }}
      onClick={handleCardClick}
    >
      <div className={styles.commentHeader}>
        <FileTextOutlined className={styles.commentIcon} />
        <Popover
          content={
            <div className={styles.colorPicker}>
              {PRESET_COLORS.map((presetColor) => (
                <div
                  key={presetColor}
                  className={`${styles.colorOption} ${color === presetColor ? styles.colorOptionActive : ''}`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => {
                    handleColorChange(presetColor);
                    setColorPickerOpen(false);
                  }}
                />
              ))}
            </div>
          }
          trigger="click"
          open={colorPickerOpen}
          onOpenChange={setColorPickerOpen}
          placement="bottomRight"
        >
          <div
            className={styles.colorTrigger}
            style={{ backgroundColor: color }}
            onClick={(e) => {
              e.stopPropagation();
              setColorPickerOpen(true);
            }}
          />
        </Popover>
      </div>
      <div className={styles.commentContent}>
        {isEditing ? (
          <Input.TextArea
            ref={inputRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onBlur={handleBlur}
            placeholder={t('commentCard.placeholder')}
            autoSize={{ minRows: 2, maxRows: 10 }}
            className={styles.commentInput}
            bordered={false}
            onPressEnter={(e) => {
              if (e.shiftKey) {
                return; // Shift+Enter 换行
              }
              handleBlur(); // Enter 保存
            }}
          />
        ) : (
          <div
            className={styles.commentText}
            onClick={() => setIsEditing(true)}
            style={{ minHeight: text ? 'auto' : '40px' }}
          >
            {text || (
              <span className={styles.placeholder}>{t('commentCard.placeholder')}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentCard;


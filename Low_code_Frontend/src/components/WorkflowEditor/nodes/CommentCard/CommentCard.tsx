import React, { useState, useCallback, useEffect, useRef } from 'react';
import { NodeProps, useReactFlow } from 'reactflow';
import { Input, Popover } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import styles from './CommentCard.module.scss';

const PRESET_COLORS = [
  'rgba(255, 248, 234, 0.96)',
  'rgba(252, 239, 229, 0.96)',
  'rgba(242, 233, 228, 0.96)',
  'rgba(234, 241, 236, 0.96)',
  'rgba(234, 238, 245, 0.96)',
  'rgba(243, 236, 246, 0.96)',
  'rgba(245, 242, 232, 0.96)',
  'rgba(238, 235, 230, 0.96)',
];

const CommentCard: React.FC<NodeProps> = ({ data, selected, id }) => {
  const { t } = useTranslation();
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data?.text || '');
  const [color, setColor] = useState(data?.color || PRESET_COLORS[0]);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const inputRef = useRef<any>(null);

  useEffect(() => {
    if (data?.text !== undefined && data.text !== text) {
      setText(data.text);
    }
    if (data?.color !== undefined && data.color !== color) {
      setColor(data.color);
    }
  }, [data?.text, data?.color, text, color]);

  useEffect(() => {
    if (selected && !text && !isEditing) {
      setIsEditing(true);
    }
  }, [selected, text, isEditing]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleTextChange = useCallback((value: string) => {
    setText(value);
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

  const handleColorChange = useCallback((newColor: string) => {
    setColor(newColor);
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

  const handleCardClick = useCallback((event: React.MouseEvent) => {
    if (event.target === event.currentTarget || (event.target as HTMLElement).closest('.ant-input')) {
      return;
    }
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
  }, []);

  const diffMark = (data as any).diffMark;
  const getBorderColor = () => {
    if (diffMark === 'add') return 'rgba(82, 196, 26, 0.22)';
    if (diffMark === 'remove') return 'rgba(255, 77, 79, 0.22)';
    if (diffMark === 'update') return 'rgba(250, 173, 20, 0.24)';
    if (selected) return 'rgba(17, 17, 17, 0.16)';
    return 'var(--editor-border-soft, rgba(0, 0, 0, 0.06))';
  };

  return (
    <div
      className={`${styles.commentCard} ${selected ? styles.selected : ''}`}
      style={{
        ['--comment-card-bg' as string]: color,
        backgroundColor: color,
        borderColor: getBorderColor(),
        opacity: diffMark === 'remove' ? 0.72 : 1,
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
            onClick={(event) => {
              event.stopPropagation();
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
            onChange={(event) => handleTextChange(event.target.value)}
            onBlur={handleBlur}
            placeholder={t('commentCard.placeholder')}
            autoSize={{ minRows: 2, maxRows: 10 }}
            className={styles.commentInput}
            bordered={false}
            onPressEnter={(event) => {
              if (event.shiftKey) {
                return;
              }
              handleBlur();
            }}
          />
        ) : (
          <div
            className={styles.commentText}
            onClick={() => setIsEditing(true)}
            style={{ minHeight: text ? 'auto' : '40px' }}
          >
            {text || <span className={styles.placeholder}>{t('commentCard.placeholder')}</span>}
          </div>
        )}
      </div>
    </div>
  );
};

export default CommentCard;

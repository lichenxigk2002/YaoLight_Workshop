import React from 'react';
import styles from './StreamingLoader.module.scss';

interface StreamingLoaderProps {
  isStreaming: boolean;
  hasContent: boolean;
  text?: string;
}

/**
 * 流式加载组件
 * 四个原点转圈动画，支持位置切换和大小变化
 */
export const StreamingLoader: React.FC<StreamingLoaderProps> = ({
  isStreaming,
  hasContent,
  text,
}) => {
  if (!isStreaming) return null;

  const displayText = text || (hasContent ? '正在流式输出' : '等待AI响应');
  const sizeClass = hasContent ? 'small' : 'large';
  const positionClass = hasContent ? 'bottomRight' : 'centered';

  return (
    <div className={`${styles.loader} ${styles[positionClass]}`}>
      {/* 四个原点转圈的加载动画 */}
      <div className={`${styles.animationContainer} ${styles[sizeClass]}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`${styles.dot} ${styles[`dot${i}`]} ${styles[sizeClass]}`}
          />
        ))}
      </div>
      <span>{displayText}</span>
    </div>
  );
};


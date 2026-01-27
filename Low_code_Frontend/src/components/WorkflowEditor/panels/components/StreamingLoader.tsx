import React from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import styles from './StreamingLoader.module.scss';

interface StreamingLoaderProps {
  isStreaming: boolean;
  hasContent: boolean;
  text?: string;
}

/**
 * 流式加载组件
 * 使用 Lottie 动画，支持位置切换和大小变化
 */
export const StreamingLoader: React.FC<StreamingLoaderProps> = ({
  isStreaming,
  hasContent,
  text,
}) => {
  if (!isStreaming) return null;

  const displayText = text || (hasContent ? '正在流式输出' : '');
  const sizeClass = hasContent ? 'small' : 'large';
  const positionClass = hasContent ? 'bottomRight' : 'centered';

  return (
    <div className={`${styles.loader} ${styles[positionClass]}`}>
      {/* Lottie 加载动画 */}
      <div className={`${styles.animationContainer} ${styles[sizeClass]}`}>
        <DotLottieReact
          src="https://lottie.host/b1611882-6abe-4dc0-af25-ce47f9666c9b/mAQSgJPLVf.lottie"
          loop
          autoplay
        />
      </div>
      {/* 原来的四个原点转圈动画（已注释） */}
      {/* <div className={`${styles.animationContainer} ${styles[sizeClass]}`}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`${styles.dot} ${styles[`dot${i}`]} ${styles[sizeClass]}`}
          />
        ))}
      </div> */}
      <span>{displayText}</span>
    </div>
  );
};


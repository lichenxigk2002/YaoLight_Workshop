import React, { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import styles from './index.module.scss';

interface CircularTextProps {
  text: string;
  spinDuration?: number;
  onHover?: 'slowDown' | 'speedUp' | 'pause' | 'goBonkers';
  className?: string;
  radius?: number; // 圆形半径
}

const CircularText: React.FC<CircularTextProps> = ({
  text,
  spinDuration = 20,
  onHover = 'speedUp',
  className = '',
  radius = 100,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rotationRef = useRef<number>(0);
  const animationRef = useRef<gsap.core.Tween | null>(null);
  const isHoveringRef = useRef<boolean>(false);

  const letters = Array.from(text);

  // 启动旋转动画
  const startRotation = (duration: number, scale: number = 1) => {
    if (!containerRef.current) return;

    // 停止当前动画
    if (animationRef.current) {
      animationRef.current.kill();
    }

    // 更新scale
    gsap.set(containerRef.current, { scale });

    // 获取当前旋转值
    const currentRotation = gsap.getProperty(containerRef.current, 'rotation') as number || 0;
    rotationRef.current = currentRotation;

    // 创建新的旋转动画，使用相对旋转实现无限循环
    animationRef.current = gsap.to(containerRef.current, {
      rotation: `+=360`,
      duration,
      ease: 'none', // 线性旋转
      repeat: -1, // 无限循环
      onUpdate: () => {
        if (containerRef.current) {
          rotationRef.current = gsap.getProperty(containerRef.current, 'rotation') as number;
        }
      },
    });
  };

  // 暂停动画
  const pauseAnimation = () => {
    if (animationRef.current) {
      animationRef.current.pause();
    }
  };

  // 恢复动画
  const resumeAnimation = (duration: number) => {
    if (animationRef.current) {
      animationRef.current.resume();
    } else {
      startRotation(duration);
    }
  };

  // 初始化动画
  useEffect(() => {
    if (!containerRef.current) return;

    // 设置初始旋转
    gsap.set(containerRef.current, { rotation: 0, transformOrigin: 'center center' });

    // 启动初始动画
    startRotation(spinDuration);

    return () => {
      if (animationRef.current) {
        animationRef.current.kill();
      }
    };
  }, [spinDuration, text]);

  // 处理悬停开始
  const handleHoverStart = () => {
    if (!onHover || !containerRef.current) return;

    isHoveringRef.current = true;

    switch (onHover) {
      case 'slowDown':
        startRotation(spinDuration * 2, 1);
        break;
      case 'speedUp':
        startRotation(spinDuration / 4, 1);
        break;
      case 'pause':
        pauseAnimation();
        break;
      case 'goBonkers':
        startRotation(spinDuration / 20, 0.8);
        break;
      default:
        startRotation(spinDuration, 1);
    }
  };

  // 处理悬停结束
  const handleHoverEnd = () => {
    if (!onHover) return;

    isHoveringRef.current = false;

    if (onHover === 'pause') {
      resumeAnimation(spinDuration);
    } else {
      startRotation(spinDuration, 1);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.circularText} ${className}`}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
      style={{
        width: radius * 2,
        height: radius * 2,
      }}
    >
      {letters.map((letter, i) => {
        const angle = (360 / letters.length) * i;
        const radian = (angle * Math.PI) / 180;
        const x = Math.cos(radian) * radius;
        const y = Math.sin(radian) * radius;
        // 旋转角度：字母底部指向圆心，需要加上90度
        const rotation = angle + 90;

        return (
          <span
            key={i}
            className={styles.letter}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
              transformOrigin: 'center center',
            }}
          >
            {letter === ' ' ? '\u00A0' : letter}
          </span>
        );
      })}
    </div>
  );
};

export default CircularText;


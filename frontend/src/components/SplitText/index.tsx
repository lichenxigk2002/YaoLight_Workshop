import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// 注册ScrollTrigger插件
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number; // 每个字符之间的延迟（毫秒）
  duration?: number; // 动画持续时间（秒）
  ease?: string; // 缓动函数
  splitType?: 'chars' | 'words' | 'lines'; // 分割类型
  from?: gsap.TweenVars; // 起始状态
  to?: gsap.TweenVars; // 结束状态
  threshold?: number; // IntersectionObserver阈值
  rootMargin?: string; // IntersectionObserver的rootMargin
  textAlign?: 'left' | 'center' | 'right';
  onLetterAnimationComplete?: () => void;
  showCallback?: boolean; // 是否显示回调日志
}

const SplitText: React.FC<SplitTextProps> = ({
  text,
  className = '',
  delay = 50,
  duration = 1.25,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  textAlign = 'center',
  onLetterAnimationComplete,
  showCallback = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!containerRef.current || hasAnimated.current) return;

    const container = containerRef.current;
    
    // 等待DOM更新后再检查字符
    const checkChars = () => {
      const chars = container.querySelectorAll('.split-char');
      if (chars.length === 0) {
        // 如果还没有字符，稍后再试
        setTimeout(checkChars, 50);
        return;
      }

      // 检查元素是否已经在视口中
      const rect = container.getBoundingClientRect();
      const isInViewport = rect.top < window.innerHeight + parseInt(rootMargin) && 
                          rect.bottom > -parseInt(rootMargin);

      if (isInViewport && !hasAnimated.current) {
        setIsVisible(true);
        hasAnimated.current = true;
        return;
      }

      // 使用IntersectionObserver检测元素是否进入视口
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !hasAnimated.current) {
              setIsVisible(true);
              hasAnimated.current = true;
              observer.disconnect();
            }
          });
        },
        {
          threshold,
          rootMargin,
        }
      );

      observer.observe(container);

      return () => {
        observer.disconnect();
      };
    };

    checkChars();
  }, [threshold, rootMargin]);

  useEffect(() => {
    if (!isVisible || !containerRef.current) return;

    // 等待DOM更新完成
    const timer = setTimeout(() => {
      const chars = containerRef.current?.querySelectorAll('.split-char');
      if (!chars || chars.length === 0) return;

      const timeline = gsap.timeline({
        onComplete: () => {
          if (onLetterAnimationComplete) {
            onLetterAnimationComplete();
          }
          if (showCallback) {
            console.log('All letters have animated!');
          }
        },
      });

      // 为每个字符创建动画
      chars.forEach((char, index) => {
        const charElement = char as HTMLElement;
        
        // 设置初始状态
        gsap.set(charElement, from);

        // 添加到时间轴
        timeline.to(
          charElement,
          {
            ...to,
            duration,
            ease,
          },
          index * (delay / 1000) // 延迟时间（转换为秒）
        );
      });
    }, 0);

    return () => {
      clearTimeout(timer);
    };
  }, [isVisible, delay, duration, ease, from, to, onLetterAnimationComplete, showCallback]);

  // 分割文本
  const splitText = (text: string, type: 'chars' | 'words' | 'lines') => {
    if (type === 'chars') {
      const result: React.ReactNode[] = [];
      const lines = text.split('\n');
      
      lines.forEach((line, lineIdx) => {
        // 为每一行包裹一个span，添加行索引类名和缩进样式
        const lineChars = line.split('').map((char, charIdx) => (
          <span key={`${lineIdx}-${charIdx}`} className="split-char" style={{ display: 'inline-block' }}>
            {char === ' ' ? '\u00A0' : char}
          </span>
        ));
        
        // 根据行索引设置不同的缩进：第二行1em，第三行2em
        const paddingLeft = lineIdx === 0 ? '0' : lineIdx === 1 ? '1em' : '2em';
        
        result.push(
          <span 
            key={`line-${lineIdx}`} 
            className={`split-line-wrapper split-line-${lineIdx}`} 
            style={{ display: 'block', paddingLeft }}
          >
            {lineChars}
          </span>
        );
      });
      
      return result;
    } else if (type === 'words') {
      return text.split(' ').map((word, index, array) => (
        <span key={index} className="split-word" style={{ display: 'inline-block', marginRight: '0.25em' }}>
          {word}
          {index < array.length - 1 && '\u00A0'}
        </span>
      ));
    } else {
      // lines
      return text.split('\n').map((line, index) => (
        <div key={index} className="split-line" style={{ display: 'block' }}>
          {line}
        </div>
      ));
    }
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ textAlign }}
    >
      {splitText(text, splitType)}
    </div>
  );
};

export default SplitText;


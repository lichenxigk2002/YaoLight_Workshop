import React from 'react';
import ReactMarkdown from 'react-markdown';
import styles from './MarkdownRenderer.module.scss';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Markdown渲染组件
 * 用于渲染AI返回的Markdown格式文本
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className }) => {
  // 如果内容为空，返回空div
  if (!content || content.trim() === '') {
    return <div className={`${styles.markdownContainer} ${className || ''}`}></div>;
  }

  return (
    <div className={`${styles.markdownContainer} ${className || ''}`}>
      <ReactMarkdown
        components={{
          // 自定义标题样式
          h1: ({ node, ...props }) => <h1 className={styles.heading1} {...props} />,
          h2: ({ node, ...props }) => <h2 className={styles.heading2} {...props} />,
          h3: ({ node, ...props }) => <h3 className={styles.heading3} {...props} />,
          h4: ({ node, ...props }) => <h4 className={styles.heading4} {...props} />,
          h5: ({ node, ...props }) => <h5 className={styles.heading5} {...props} />,
          h6: ({ node, ...props }) => <h6 className={styles.heading6} {...props} />,
          // 段落
          p: ({ node, ...props }) => <p className={styles.paragraph} {...props} />,
          // 列表
          ul: ({ node, ...props }) => <ul className={styles.unorderedList} {...props} />,
          ol: ({ node, ...props }) => <ol className={styles.orderedList} {...props} />,
          li: ({ node, ...props }) => <li className={styles.listItem} {...props} />,
          // 强调
          strong: ({ node, ...props }) => <strong className={styles.strong} {...props} />,
          em: ({ node, ...props }) => <em className={styles.em} {...props} />,
          // 代码
          code: ({ node, inline, ...props }: any) => {
            if (inline) {
              return <code className={styles.inlineCode} {...props} />;
            }
            return <code className={styles.codeBlock} {...props} />;
          },
          pre: ({ node, ...props }) => <pre className={styles.pre} {...props} />,
          // 引用
          blockquote: ({ node, ...props }) => <blockquote className={styles.blockquote} {...props} />,
          // 链接
          a: ({ node, ...props }) => <a className={styles.link} target="_blank" rel="noopener noreferrer" {...props} />,
          // 水平线
          hr: ({ node, ...props }) => <hr className={styles.hr} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};


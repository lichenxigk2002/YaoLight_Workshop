import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/CodeBlock';
import type { CodeBlockAppearance } from '@/components/CodeBlock';
import { MermaidRenderer } from './MermaidRenderer';
import styles from './MarkdownRenderer.module.scss';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  codeBlockAppearance?: CodeBlockAppearance;
  codeBlockShowHeader?: boolean;
  codeBlockShowLineNumbers?: boolean;
}

/**
 * Markdown渲染组件
 * 用于渲染AI返回的Markdown格式文本
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className,
  codeBlockAppearance = 'default',
  codeBlockShowHeader = true,
  codeBlockShowLineNumbers = true,
}) => {
  // 如果内容为空，返回空div
  if (!content || content.trim() === '') {
    return <div className={`${styles.markdownContainer} ${className || ''}`}></div>;
  }

  return (
    <div className={`${styles.markdownContainer} ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义标题样式
          h1: (props) => <h1 className={styles.heading1} {...props} />,
          h2: (props) => <h2 className={styles.heading2} {...props} />,
          h3: (props) => <h3 className={styles.heading3} {...props} />,
          h4: (props) => <h4 className={styles.heading4} {...props} />,
          h5: (props) => <h5 className={styles.heading5} {...props} />,
          h6: (props) => <h6 className={styles.heading6} {...props} />,
          // 段落
          p: (props) => <p className={styles.paragraph} {...props} />,
          // 列表
          ul: (props) => <ul className={styles.unorderedList} {...props} />,
          ol: (props) => <ol className={styles.orderedList} {...props} />,
          li: (props) => <li className={styles.listItem} {...props} />,
          // 强调
          strong: (props) => <strong className={styles.strong} {...props} />,
          em: (props) => <em className={styles.em} {...props} />,
          // 代码：单反引号走行内样式，三反引号代码块才走 CodeBlock。
          code: ({ className, children, ...props }: any) => {
            const rawText = String(children ?? '');
            const hasLanguage = typeof className === 'string' && className.startsWith('language-');
            const isBlockCode = hasLanguage || rawText.includes('\n');
            if (!isBlockCode) {
              return <code className={styles.inlineCode} {...props}>{children}</code>;
            }
            const isMermaid = typeof className === 'string' && className.includes('language-mermaid');
            if (isMermaid) {
              return (
                <div className={styles.mermaidWrap}>
                  <MermaidRenderer
                    content={rawText.replace(/\n$/, '')}
                    showSavePng={true}
                    downloadName="mermaid-diagram"
                  />
                </div>
              );
            }
            const language = typeof className === 'string'
              ? className.replace(/^language-/, '')
              : 'text';
            return (
              <CodeBlock
                value={rawText.replace(/\n$/, '')}
                language={language || 'text'}
                appearance={codeBlockAppearance}
                showHeader={codeBlockShowHeader}
                showLineNumbers={codeBlockShowLineNumbers}
                className={styles.markdownCodeBlock}
                defaultExpanded
                collapsedLines={999}
              />
            );
          },
          pre: ({ children }) => <>{children}</>,
          // 引用
          blockquote: (props) => <blockquote className={styles.blockquote} {...props} />,
          // 链接
          a: (props) => <a className={styles.link} target="_blank" rel="noopener noreferrer" {...props} />,
          // 水平线
          hr: (props) => <hr className={styles.hr} {...props} />,
          // 表格
          table: ({ children, ...props }) => (
            <div className={styles.tableWrapper}>
              <table className={styles.table} {...props}>
                {children}
              </table>
            </div>
          ),
          thead: (props) => <thead className={styles.tableHead} {...props} />,
          tbody: (props) => <tbody className={styles.tableBody} {...props} />,
          tr: (props) => <tr className={styles.tableRow} {...props} />,
          th: (props) => <th className={styles.tableHeaderCell} {...props} />,
          td: (props) => <td className={styles.tableCell} {...props} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

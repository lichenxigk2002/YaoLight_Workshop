import React, { useMemo, useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useThemeStore } from '@/store/theme';
import styles from './CodeBlock.module.scss';

export type CodeBlockThemeMode = 'light' | 'dark' | 'auto';

export interface CodeBlockProps {
  value: string | object;
  language?: string;
  themeMode?: CodeBlockThemeMode;
  collapsedLines?: number;
  defaultExpanded?: boolean;
  className?: string;
}

const joinClassName = (...parts: Array<string | undefined | false>) =>
  parts.filter(Boolean).join(' ');

export const CodeBlock: React.FC<CodeBlockProps> = ({
  value,
  language = 'json',
  themeMode = 'auto',
  collapsedLines = 16,
  defaultExpanded = true,
  className,
}) => {
  const { theme } = useThemeStore();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  const codeText = useMemo(() => {
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }, [value]);

  const lines = useMemo(() => codeText.split('\n'), [codeText]);
  const lineCount = lines.length;

  const displayText = expanded ? codeText : lines.slice(0, collapsedLines).join('\n');

  const isDark =
    themeMode === 'auto' ? theme === 'dark' : themeMode === 'dark';

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      return;
    }
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
    }
  };

  const toggleExpand = () => {
    setExpanded((prev) => !prev);
  };

  const headerLanguage = language.toUpperCase();
  const syntaxTheme = isDark ? oneDark : oneLight;

  return (
    <div className={joinClassName(styles.wrapper, className)}>
      <div className={styles.header}>
        <div className={styles.left}>
          <span className={styles.language}>{headerLanguage}</span>
          <span className={styles.lineCount}>Ln {lineCount}</span>
        </div>
        <div className={styles.actions}>
          {copied && <span className={styles.copied}>已复制</span>}
          <button type="button" className={styles.actionButton} onClick={handleCopy}>
            复制
          </button>
          {lineCount > collapsedLines && (
            <button
              type="button"
              className={styles.actionButton}
              onClick={toggleExpand}
            >
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      </div>
      <div className={styles.body} data-expanded={expanded}>
        <SyntaxHighlighter
          language={language}
          style={syntaxTheme}
          showLineNumbers
          wrapLongLines
          customStyle={{
            margin: 0,
            background: 'transparent',
          }}
        >
          {displayText}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};


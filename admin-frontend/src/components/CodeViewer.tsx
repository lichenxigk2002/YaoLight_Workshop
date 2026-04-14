import { Typography } from 'antd';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useAdminTheme } from '@/theme';
import styles from './CodeViewer.module.scss';

type CodeViewerProps = {
  value: unknown;
  language?: 'json' | 'text';
  emptyText?: string;
  maxHeight?: number;
};

SyntaxHighlighter.registerLanguage('json', json);

function stringifyValue(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function CodeViewer({
  value,
  language = 'json',
  emptyText = '-',
  maxHeight = 560,
}: CodeViewerProps) {
  const { mode } = useAdminTheme();
  const content = stringifyValue(value);

  if (!content) {
    return <Typography.Text className={styles.empty}>{emptyText}</Typography.Text>;
  }

  return (
    <div
      className={styles.viewer}
      data-mode={mode}
      style={{ ['--code-max-height' as string]: `${maxHeight}px` }}
    >
      <SyntaxHighlighter
        language={language === 'json' ? 'json' : undefined}
        style={mode === 'dark' ? oneDark : oneLight}
        wrapLongLines
        showLineNumbers={content.includes('\n')}
        customStyle={{
          margin: 0,
          padding: 0,
          background: 'transparent',
          fontSize: '12px',
          lineHeight: '1.7',
          minWidth: '100%',
        }}
        codeTagProps={{
          style: {
            fontFamily: '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          },
        }}
        lineNumberStyle={{
          minWidth: '2.5em',
          paddingRight: '1em',
          opacity: 0.4,
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  );
}

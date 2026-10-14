import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { OnMount } from '@monaco-editor/react';
import { App, Segmented } from 'antd';
import type * as Monaco from 'monaco-editor';
import { useTranslation } from 'react-i18next';
import { CodeBlock } from '@/components/CodeBlock';
import { useThemeStore } from '@/store/theme';
import styles from './ScriptCodeEditor.module.scss';

interface ScriptCodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  language?: 'javascript' | 'python';
  onLanguageChange?: (language: 'javascript' | 'python') => void;
  onAiRepair?: () => void;
  aiRepairLoading?: boolean;
}

const MonacoEditor = React.lazy(async () => {
  const mod = await import('@monaco-editor/react');
  return { default: mod.default };
});

const CODE_EDITOR_FOCUS_EVENT = 'workflow-code-editor-focus-change';

let editorBootstrapped = false;

const javascriptRuntimeLib = `
declare const input: any;
declare const vars: Record<string, any>;
declare const node: {
  id: string;
  language: string;
};
declare const console: {
  log: (...args: any[]) => void;
};
`;

const completionDocs = {
  input: '当前节点输入数据。',
  vars: '工作流变量映射，可读取上游节点输出和上下文变量。',
  node: '当前节点元信息，例如 node.id、node.language。',
  console: 'JavaScript 运行时日志输出，结果会进入 stdout。',
};

function bootstrapMonaco(monaco: typeof Monaco) {
  if (editorBootstrapped) return;
  editorBootstrapped = true;

  monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
    allowJs: true,
    allowNonTsExtensions: true,
    target: monaco.languages.typescript.ScriptTarget.ES2020,
    module: monaco.languages.typescript.ModuleKind.ESNext,
    noEmit: true,
  });
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    javascriptRuntimeLib,
    'file:///workflow-code-runtime.d.ts',
  );

  const createItem = (
    label: string,
    insertText: string,
    documentation: string,
    kind: Monaco.languages.CompletionItemKind,
    language: 'javascript' | 'python',
  ): Monaco.languages.CompletionItem => ({
    label,
    kind,
    insertText,
    documentation: {
      value: documentation,
    },
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
    range: undefined,
    detail: language === 'javascript' ? 'Workflow Runtime' : 'Workflow Runtime Preview',
  });

  const jsProvider = monaco.languages.registerCompletionItemProvider('javascript', {
    triggerCharacters: ['.', '[', "'", '"'],
    provideCompletionItems: () => ({
      suggestions: [
        createItem('input', 'input', completionDocs.input, monaco.languages.CompletionItemKind.Variable, 'javascript'),
        createItem('vars', 'vars', completionDocs.vars, monaco.languages.CompletionItemKind.Variable, 'javascript'),
        createItem('node', 'node', completionDocs.node, monaco.languages.CompletionItemKind.Variable, 'javascript'),
        createItem('console.log', "console.log('${1:label}', ${2:input});", completionDocs.console, monaco.languages.CompletionItemKind.Function, 'javascript'),
        createItem('return input', 'return input;', '直接返回当前输入。', monaco.languages.CompletionItemKind.Snippet, 'javascript'),
        createItem('return object', 'return {\n  ok: true,\n  data: ${1:input},\n};', '返回对象结果。', monaco.languages.CompletionItemKind.Snippet, 'javascript'),
        createItem('read vars', "const source = vars['${1:start.data}'];\nreturn source;", '读取指定变量路径。', monaco.languages.CompletionItemKind.Snippet, 'javascript'),
      ],
    }),
  });

  const pyProvider = monaco.languages.registerCompletionItemProvider('python', {
    triggerCharacters: ['.', '[', "'", '"'],
    provideCompletionItems: () => ({
      suggestions: [
        createItem('input', 'input', completionDocs.input, monaco.languages.CompletionItemKind.Variable, 'python'),
        createItem('vars', 'vars', completionDocs.vars, monaco.languages.CompletionItemKind.Variable, 'python'),
        createItem('node', 'node', completionDocs.node, monaco.languages.CompletionItemKind.Variable, 'python'),
        createItem('return input', 'return input', '直接返回当前输入。', monaco.languages.CompletionItemKind.Snippet, 'python'),
        createItem('dict result', "return {\n    'ok': True,\n    'data': input,\n}", '返回字典结果。', monaco.languages.CompletionItemKind.Snippet, 'python'),
        createItem('read vars', "source = vars.get('${1:start.data}')\nreturn source", '读取指定变量路径。', monaco.languages.CompletionItemKind.Snippet, 'python'),
      ],
    }),
  });

  const hoverProvider = monaco.languages.registerHoverProvider('javascript', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)?.word as keyof typeof completionDocs | undefined;
      if (!word || !(word in completionDocs)) return null;
      return {
        contents: [{ value: `**${word}**\n\n${completionDocs[word]}` }],
      };
    },
  });

  const pyHoverProvider = monaco.languages.registerHoverProvider('python', {
    provideHover(model, position) {
      const word = model.getWordAtPosition(position)?.word as keyof typeof completionDocs | undefined;
      if (!word || !(word in completionDocs)) return null;
      return {
        contents: [{ value: `**${word}**\n\n${completionDocs[word]}` }],
      };
    },
  });

  void [jsProvider, pyProvider, hoverProvider, pyHoverProvider];
}

export const ScriptCodeEditor: React.FC<ScriptCodeEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  rows = 12,
  disabled = false,
  language = 'javascript',
  onLanguageChange,
  onAiRepair,
  aiRepairLoading = false,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [editing, setEditing] = useState(!value);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const blurTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!value) {
      setEditing(true);
    }
  }, [value]);

  useEffect(() => () => {
    if (blurTimerRef.current) {
      window.clearTimeout(blurTimerRef.current);
    }
    window.dispatchEvent(new CustomEvent(CODE_EDITOR_FOCUS_EVENT, { detail: { focused: false } }));
  }, []);

  const previewValue = useMemo(() => value || '', [value]);
  const editorHeight = Math.max(260, rows * 22 + 28);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    message.success(t('scriptCodeEditor.copySuccess'));
  };

  const handleFormat = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    await editor.getAction('editor.action.formatDocument')?.run();
    if (language === 'python') {
      message.info(t('scriptCodeEditor.formatLimited'));
    }
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    bootstrapMonaco(monaco);

    editor.addCommand(monaco.KeyCode.Backspace, () => {
      const model = editor.getModel();
      const selection = editor.getSelection();
      if (!model || !selection) return;

      if (!selection.isEmpty()) {
        editor.trigger('keyboard', 'deleteLeft', null);
        return;
      }

      if (selection.startColumn === 1 && selection.startLineNumber > 1) {
        const previousLineNumber = selection.startLineNumber - 1;
        const previousLineMaxColumn = model.getLineMaxColumn(previousLineNumber);
        editor.executeEdits('workflow-code-editor-backspace', [
          {
            range: new monaco.Range(
              previousLineNumber,
              previousLineMaxColumn,
              selection.startLineNumber,
              1,
            ),
            text: '',
            forceMoveMarkers: true,
          },
        ]);
        editor.setPosition({
          lineNumber: previousLineNumber,
          column: previousLineMaxColumn,
        });
        return;
      }

      editor.trigger('keyboard', 'deleteLeft', null);
    }, '!editorReadonly');

    editor.onDidFocusEditorText(() => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
        blurTimerRef.current = null;
      }
      window.dispatchEvent(new CustomEvent(CODE_EDITOR_FOCUS_EVENT, { detail: { focused: true } }));
    });
    editor.onDidBlurEditorText(() => {
      if (blurTimerRef.current) {
        window.clearTimeout(blurTimerRef.current);
      }
      blurTimerRef.current = window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent(CODE_EDITOR_FOCUS_EVENT, { detail: { focused: false } }));
        blurTimerRef.current = null;
      }, 0);
    });
  };

  return (
    <div
      className={`${styles.shell} ${isDark ? styles.dark : ''}`}
      data-script-editor-root="true"
    >
      <div className={styles.header}>
        <div className={styles.identity}>
          <span className={styles.eyebrowAccent} />
          <span className={styles.productName}>{t('scriptCodeEditor.productName')}</span>
        </div>
        <Segmented
          size="small"
          value={language}
          onChange={(nextValue) => onLanguageChange?.(nextValue as 'javascript' | 'python')}
          options={[
            { label: t('scriptCodeEditor.javascript'), value: 'javascript' },
            { label: t('scriptCodeEditor.python'), value: 'python' },
          ]}
          className={styles.languageSwitch}
        />
      </div>
      {!editing && value ? (
        <div
          className={styles.preview}
          onClick={() => {
            if (!disabled) setEditing(true);
          }}
          style={{ cursor: disabled ? 'default' : 'text' }}
        >
          <CodeBlock value={previewValue} language={language} showHeader={false} defaultExpanded collapsedLines={999} />
        </div>
      ) : (
        <div className={styles.editorWrap} style={{ minHeight: editorHeight }}>
          <div className={styles.editorFrame}>
            <Suspense fallback={<div className={styles.loading} style={{ minHeight: editorHeight }}>Loading Monaco</div>}>
              <MonacoEditor
                height={editorHeight}
                defaultLanguage={language}
                language={language}
                value={value}
                beforeMount={bootstrapMonaco}
                onMount={handleMount}
                onChange={(nextValue) => onChange?.(nextValue || '')}
                options={{
                  readOnly: disabled,
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  padding: { top: 18, bottom: 18 },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  insertSpaces: true,
                  quickSuggestions: true,
                  suggestOnTriggerCharacters: true,
                  inlineSuggest: { enabled: true },
                  lineNumbersMinChars: 3,
                  snippetSuggestions: 'top',
                  formatOnPaste: language === 'javascript',
                  formatOnType: language === 'javascript',
                  cursorBlinking: 'smooth',
                  smoothScrolling: true,
                  mouseWheelZoom: true,
                  placeholder: placeholder || t('scriptCodeEditor.placeholder'),
                }}
                theme={isDark ? 'vs-dark' : 'vs'}
              />
            </Suspense>
          </div>
        </div>
      )}
      <div className={styles.footer}>
        <div className={styles.actions}>
          {value ? (
            <button type="button" onClick={() => setEditing((prev) => !prev)} className={`${styles.actionButton} ${styles.actionGhost}`}>
              {editing ? t('scriptCodeEditor.preview') : t('scriptCodeEditor.edit')}
            </button>
          ) : null}
          <button type="button" onClick={() => { void handleFormat(); }} className={`${styles.actionButton} ${styles.actionGhost}`}>
            {t('scriptCodeEditor.format')}
          </button>
          {onAiRepair ? (
            <button type="button" onClick={onAiRepair} className={`${styles.actionButton} ${styles.actionAccent}`} disabled={aiRepairLoading}>
              {aiRepairLoading ? t('scriptCodeEditor.aiRepairing') : t('scriptCodeEditor.aiRepair')}
            </button>
          ) : null}
          <button type="button" onClick={() => { void handleCopy(); }} className={`${styles.actionButton} ${styles.actionPrimary}`}>
            {t('scriptCodeEditor.copy')}
          </button>
        </div>
      </div>
    </div>
  );
};

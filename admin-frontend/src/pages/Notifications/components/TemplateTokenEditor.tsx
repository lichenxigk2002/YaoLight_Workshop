import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import styles from '../index.module.scss';

interface TemplateTokenEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  onFocus?: () => void;
}

export interface TemplateTokenEditorRef {
  focus: () => void;
  insertToken: (tokenKey: string) => void;
}

interface TextPart {
  type: 'text' | 'variable';
  content: string;
}

function parseParts(value?: string): TextPart[] {
  const text = value || '';
  if (!text) {
    return [];
  }

  const result: TextPart[] = [];
  const regex = /{{\s*([^}]+)\s*}}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        content: text.slice(lastIndex, match.index),
      });
    }

    result.push({
      type: 'variable',
      content: match[1],
    });

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      content: text.slice(lastIndex),
    });
  }

  return result;
}

function getEditorText(editor: HTMLDivElement) {
  return editor.innerText.replace(/\u00a0/g, ' ').replace(/\n$/, '');
}

function getRenderedTokenCount(editor: HTMLDivElement) {
  return editor.querySelectorAll('[data-token]').length;
}

function createTokenNode(tokenKey: string) {
  const chip = document.createElement('span');
  chip.className = styles.templateEditorToken;
  chip.contentEditable = 'false';
  chip.dataset.token = tokenKey;
  chip.innerText = `{{${tokenKey}}}`;
  return chip;
}

function createTextNode(content: string) {
  return document.createTextNode(content);
}

function buildEditorContent(editor: HTMLDivElement, value?: string) {
  const parts = parseParts(value);
  const fragment = document.createDocumentFragment();

  parts.forEach((part) => {
    if (part.type === 'variable') {
      fragment.appendChild(createTokenNode(part.content));
    } else if (part.content) {
      fragment.appendChild(createTextNode(part.content));
    }
  });

  editor.replaceChildren(fragment);
  editor.dataset.empty = parts.length === 0 ? 'true' : 'false';
}

function moveCaretToEnd(editor: HTMLDivElement) {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function getDropRange(x: number, y: number) {
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (!position) {
      return null;
    }
    const range = document.createRange();
    range.setStart(position.offsetNode, position.offset);
    range.collapse(true);
    return range;
  }

  const legacyDoc = document as Document & {
    caretRangeFromPoint?: (px: number, py: number) => Range | null;
  };

  return legacyDoc.caretRangeFromPoint?.(x, y) || null;
}

const TemplateTokenEditor = forwardRef<TemplateTokenEditorRef, TemplateTokenEditorProps>(
  ({ value = '', onChange, placeholder, rows = 1, onFocus }, ref) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const savedRangeRef = useRef<Range | null>(null);

    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const currentValue = getEditorText(editor);
      const expectedTokenCount = parseParts(value).filter((part) => part.type === 'variable').length;
      if (currentValue !== value || getRenderedTokenCount(editor) !== expectedTokenCount) {
        buildEditorContent(editor, value);
      } else {
        editor.dataset.empty = currentValue ? 'false' : 'true';
      }
    }, [value]);

    function saveSelection() {
      const selection = window.getSelection();
      const editor = editorRef.current;
      if (!selection || !editor || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (editor.contains(range.startContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }

    function emitChange() {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      const nextValue = getEditorText(editor);
      editor.dataset.empty = nextValue ? 'false' : 'true';
      onChange?.(nextValue);
    }

    function insertToken(tokenKey: string, dropRange?: Range | null) {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }

      editor.focus();
      const selection = window.getSelection();
      const range = dropRange || savedRangeRef.current;

      if (selection) {
        selection.removeAllRanges();
        if (range && editor.contains(range.startContainer)) {
          selection.addRange(range);
        } else {
          moveCaretToEnd(editor);
        }
      }

      const activeSelection = window.getSelection();
      if (!activeSelection || activeSelection.rangeCount === 0) {
        return;
      }

      const activeRange = activeSelection.getRangeAt(0);
      activeRange.deleteContents();
      const chip = createTokenNode(tokenKey);
      activeRange.insertNode(chip);
      activeRange.setStartAfter(chip);
      activeRange.collapse(true);
      activeSelection.removeAllRanges();
      activeSelection.addRange(activeRange);
      savedRangeRef.current = activeRange.cloneRange();
      emitChange();
    }

    useImperativeHandle(ref, () => ({
      focus: () => {
        const editor = editorRef.current;
        if (!editor) {
          return;
        }
        editor.focus();
        moveCaretToEnd(editor);
      },
      insertToken: (tokenKey: string) => insertToken(tokenKey),
    }));

    return (
      <div
        ref={editorRef}
        role="textbox"
        contentEditable
        suppressContentEditableWarning
        className={`${styles.templateTokenEditor} ${rows > 1 ? styles.templateTokenEditorMultiline : ''}`}
        data-placeholder={placeholder || ''}
        data-empty={value ? 'false' : 'true'}
        style={{ minHeight: `${Math.max(40, rows * 28)}px` }}
        onFocus={() => {
          onFocus?.();
          saveSelection();
        }}
        onInput={() => {
          emitChange();
          saveSelection();
        }}
        onKeyUp={saveSelection}
        onMouseUp={saveSelection}
        onBlur={saveSelection}
        onDragOver={(event) => {
          event.preventDefault();
        }}
        onDrop={(event) => {
          event.preventDefault();
          const tokenKey = event.dataTransfer.getData('text/x-template-token');
          if (!tokenKey) {
            return;
          }
          const dropRange = getDropRange(event.clientX, event.clientY);
          insertToken(tokenKey, dropRange);
        }}
      />
    );
  },
);

TemplateTokenEditor.displayName = 'TemplateTokenEditor';

export default TemplateTokenEditor;

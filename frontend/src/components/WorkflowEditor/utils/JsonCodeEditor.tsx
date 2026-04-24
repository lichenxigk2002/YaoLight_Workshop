import React, { useEffect, useMemo, useState } from 'react';
import { Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { CodeBlock } from '@/components/CodeBlock';
import { useThemeStore } from '@/store/theme';

const { TextArea } = Input;

interface JsonCodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value = '',
  onChange,
  placeholder,
  rows = 8,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [editing, setEditing] = useState(!value);

  useEffect(() => {
    if (!value) {
      setEditing(true);
    }
  }, [value]);

  const formatJson = () => {
    if (!value) return;
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      if (onChange) {
        onChange(formatted);
      }
    } catch {
      // Ignore invalid JSON when formatting.
    }
  };

  const validateJson = (text: string): boolean => {
    if (!text.trim()) return true;
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  const isValid = validateJson(value || '');
  const previewValue = useMemo(() => {
    if (!value || !isValid) return value;
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }, [isValid, value]);
  const borderColor = isValid
    ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')
    : (isDark ? 'rgba(255, 77, 79, 0.45)' : 'rgba(255, 77, 79, 0.32)');
  const surfaceBackground = isValid
    ? (isDark
      ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0.018)), rgba(18, 18, 18, 0.94)'
      : 'linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(248, 248, 246, 0.72)), rgba(255, 255, 255, 0.72)')
    : (isDark
      ? 'linear-gradient(180deg, rgba(255, 77, 79, 0.1), rgba(255, 255, 255, 0.018)), rgba(18, 18, 18, 0.94)'
      : 'linear-gradient(180deg, rgba(255, 242, 240, 0.96), rgba(255, 255, 255, 0.78)), rgba(255, 255, 255, 0.72)');

  return (
    <div style={{
      position: 'relative',
      border: `1px solid ${borderColor}`,
      borderRadius: 16,
      background: surfaceBackground,
      boxShadow: isDark ? 'inset 0 1px 0 rgba(255, 255, 255, 0.04)' : 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        background: isDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.5)',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}`,
        fontSize: 12,
        color: isDark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(0, 0, 0, 0.62)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
          JSON
        </span>
        {value && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!isValid && (
              <span style={{
                color: '#ff4d4f',
                fontSize: 11,
              }}>
                {t('jsonCodeEditor.invalid')}
              </span>
            )}
            {value && isValid && (
              <button
                type="button"
                onClick={() => setEditing((prev) => !prev)}
                style={{
                  padding: '2px 8px',
                  fontSize: 11,
                  background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: isDark ? '#f2f2f2' : '#111',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {editing ? t('jsonCodeEditor.preview') : t('jsonCodeEditor.edit')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                formatJson();
                if (isValid) setEditing(false);
              }}
              style={{
                padding: '2px 8px',
                fontSize: 11,
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                color: isDark ? '#f2f2f2' : '#111',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                borderRadius: 999,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
              }}
            >
              {t('jsonCodeEditor.format')}
            </button>
          </div>
        )}
      </div>
      {!editing && value && isValid ? (
        <div
          onClick={() => {
            if (!disabled) setEditing(true);
          }}
          style={{ cursor: disabled ? 'default' : 'text' }}
        >
          <CodeBlock
            value={previewValue}
            language="json"
            showHeader={false}
            defaultExpanded
            collapsedLines={999}
          />
        </div>
      ) : (
        <TextArea
          value={value}
          onChange={(e) => {
            if (onChange) {
              onChange(e.target.value);
            }
          }}
          onBlur={() => {
            if (value && isValid) {
              setEditing(false);
            }
          }}
          placeholder={placeholder || t('jsonCodeEditor.placeholder')}
          rows={rows}
          disabled={disabled}
          bordered={false}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            lineHeight: 1.65,
            backgroundColor: 'transparent',
            color: isDark ? '#e7e7e7' : '#24292e',
            padding: '14px 16px',
            resize: 'vertical',
          }}
          autoSize={false}
        />
      )}
    </div>
  );
};

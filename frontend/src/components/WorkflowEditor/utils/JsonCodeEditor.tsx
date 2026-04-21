import React from 'react';
import { Input } from 'antd';
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
  placeholder = '输入JSON数据...',
  rows = 8,
  disabled = false,
}) => {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // JSON格式化函数
  const formatJson = () => {
    if (!value) return;
    try {
      const parsed = JSON.parse(value);
      const formatted = JSON.stringify(parsed, null, 2);
      if (onChange) {
        onChange(formatted);
      }
    } catch {
      // JSON无效，不格式化
    }
  };

  // 验证JSON
  const validateJson = (text: string): boolean => {
    if (!text.trim()) return true; // 空字符串视为有效
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  const isValid = validateJson(value || '');
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
      {/* 代码编辑器样式头部 */}
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
                ⚠ 格式无效
              </span>
            )}
            <button
              type="button"
              onClick={formatJson}
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
              格式化
            </button>
          </div>
        )}
      </div>
      <TextArea
        value={value}
        onChange={(e) => {
          if (onChange) {
            onChange(e.target.value);
          }
        }}
        placeholder={placeholder}
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
    </div>
  );
};

import React, { useRef } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
    } catch (e) {
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

  return (
    <div style={{
      position: 'relative',
      border: `1px solid ${isValid
        ? (isDark ? '#434343' : '#d9d9d9')
        : (isDark ? '#58191c' : '#ffccc7')}`,
      borderRadius: '4px',
      backgroundColor: isValid
        ? (isDark ? '#1e1e1e' : '#fafafa')
        : (isDark ? '#2a1215' : '#fff2f0'),
      overflow: 'hidden',
    }}>
      {/* 代码编辑器样式头部 */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        backgroundColor: isDark ? '#252526' : '#f5f5f5',
        borderBottom: `1px solid ${isDark ? '#3e3e42' : '#e8e8e8'}`,
        fontSize: 12,
        color: isDark ? '#cccccc' : '#666666',
      }}>
        <span style={{ fontFamily: 'Consolas, Monaco, "Courier New", monospace' }}>
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
                background: '#1890ff',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#40a9ff';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = '#1890ff';
              }}
            >
              格式化
            </button>
          </div>
        )}
      </div>
      <TextArea
        ref={textareaRef}
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
          fontFamily: 'Consolas, Monaco, "Courier New", monospace',
          fontSize: 14,
          lineHeight: 1.8,
          backgroundColor: 'transparent',
          color: isDark ? '#d4d4d4' : '#24292e',
          padding: '12px',
          resize: 'vertical',
        }}
        autoSize={false}
      />
    </div>
  );
};


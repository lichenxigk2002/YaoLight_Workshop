import React, { useMemo, useState } from 'react';
import { Popover, Select } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import styles from './ProviderPicker.module.scss';

const { Option } = Select;

export type ProviderPickerMode = 'list' | 'cards';

export interface ProviderPickerOption {
  value: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

interface ProviderPickerProps {
  value?: string;
  onChange?: (value: string) => void;
  options: ProviderPickerOption[];
  mode: ProviderPickerMode;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

export const ProviderPicker: React.FC<ProviderPickerProps> = ({
  value,
  onChange,
  options,
  mode,
  loading,
  placeholder,
  className,
}) => {
  const selected = useMemo(() => options.find(o => o.value === value), [options, value]);
  const [open, setOpen] = useState(false);

  if (mode === 'list') {
    return (
      <Select
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        loading={loading}
        className={className}
      >
        {options.map((opt) => (
          <Option key={opt.value} value={opt.value}>
            <div style={{ width: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8 }}>
              {opt.icon}
              <span>{opt.title}</span>
            </div>
          </Option>
        ))}
      </Select>
    );
  }

  // Cards mode: now renders directly embedded in the page, vertical layout
  if (mode === 'cards') {
    return (
      <div className={`${styles.gridEmbedded} ${className || ''}`}>
        {options.map((opt) => {
          const selectedCard = opt.value === value;
          return (
            <div
              key={opt.value}
              className={`${styles.card} ${selectedCard ? styles.cardSelected : ''}`}
              onClick={() => onChange?.(opt.value)}
              title={opt.title}
            >
              <div className={styles.cardIcon}>
                {/* Clone element to force currentColor if possible, though CSS handles it too */}
                {React.isValidElement(opt.icon) 
                  ? React.cloneElement(opt.icon as React.ReactElement, { 
                      // @ts-ignore
                      color: selectedCard ? 'currentColor' : undefined 
                    }) 
                  : opt.icon}
              </div>
              <div className={styles.cardText}>
                <div className={styles.cardTitle}>{opt.title}</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Legacy popover implementation (kept just in case, but currently unused if mode is restricted to list/cards)
  // If we ever want the old popover behavior back, we should add a 'popover' mode.
  // For now, let's keep it unreachable or default to list if unknown.
  return null; 
};

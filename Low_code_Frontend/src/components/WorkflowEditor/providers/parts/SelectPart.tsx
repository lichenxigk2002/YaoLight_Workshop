import React from 'react';
import { Form, Segmented } from 'antd';
import styles from './Parts.module.scss';

// Segmented Control Component
const SegmentedSelect: React.FC<{
  value?: string | number;
  onChange?: (value: string | number) => void;
  options: { label: string; value: string | number }[];
}> = ({ value, onChange, options }) => {
  return (
    <Segmented
      block
      motion={false}
      value={value}
      onChange={onChange as any}
      options={options}
      className={styles.segmentedControl}
    />
  );
};

export const SelectPart: React.FC<{
  name: string;
  label: string;
  options: { label: string; value: string | number }[];
  defaultValue?: string | number;
  tooltip?: string;
}> = ({
  name,
  label,
  options,
  defaultValue,
  tooltip,
}) => {
  return (
    <Form.Item
      label={label}
      name={name}
      initialValue={defaultValue}
      tooltip={tooltip}
    >
      <SegmentedSelect options={options} />
    </Form.Item>
  );
};

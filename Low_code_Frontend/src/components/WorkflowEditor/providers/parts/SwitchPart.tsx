import React from 'react';
import { Form, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import styles from './Parts.module.scss';

export const SegmentedSwitch: React.FC<{
  value?: boolean;
  onChange?: (value: boolean) => void;
  checkedChildren?: React.ReactNode;
  unCheckedChildren?: React.ReactNode;
}> = ({ value, onChange, checkedChildren, unCheckedChildren }) => {
  const { t } = useTranslation();
  
  return (
    <Segmented
      block
      motion={undefined}
      value={value}
      onChange={(val) => onChange?.(val as boolean)}
      className={styles.segmentedControl}
      options={[
        { label: unCheckedChildren || 'Off', value: false as any },
        { label: checkedChildren || 'On', value: true as any },
      ]}
    />
  );
};

export const SwitchPart: React.FC<{
  name: string;
  label?: string;
  defaultValue?: boolean;
  tooltip?: string;
}> = ({
  name,
  label,
  defaultValue = false,
  tooltip,
}) => {
  return (
    <Form.Item
      label={label}
      name={name}
      // Use standard 'value' prop instead of 'checked'
      initialValue={defaultValue}
      tooltip={tooltip}
    >
      <SegmentedSwitch />
    </Form.Item>
  );
};

import React from 'react';
import { Form, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';

export const FrequencyPenaltyPart: React.FC<{
  name?: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}> = ({
  name = 'frequencyPenalty',
  label,
  min = -2,
  max = 2,
  step = 0.1,
  defaultValue = 0,
}) => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={label || t('node.config.ai.frequencyPenalty')}
      name={name}
      initialValue={defaultValue}
      tooltip={t('node.config.ai.frequencyPenaltyTooltip')}
    >
      <InputNumber
        min={min}
        max={max}
        step={step}
        style={{ width: '100%' }}
      />
    </Form.Item>
  );
};

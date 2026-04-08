import React from 'react';
import { Form, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';

export const MaxTokensPart: React.FC<{
  name?: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}> = ({
  name = 'maxTokens',
  label,
  min = 1,
  max = 32768,
  step = 100,
  defaultValue = 2000,
}) => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={label || t('node.config.ai.maxTokens')}
      name={name}
      initialValue={defaultValue}
      tooltip={t('node.config.ai.maxTokensTooltip')}
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

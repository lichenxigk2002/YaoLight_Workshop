import React from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';

export const ThinkingLevelPart: React.FC<{
  name?: string;
  label?: string;
  defaultValue?: string;
  options?: { label: string; value: string }[];
}> = ({
  name = 'thinkingLevel',
  label,
  defaultValue = 'medium',
  options = [
    { label: '不思考', value: 'minimal' },
    { label: '简单思考', value: 'low' },
    { label: '适中思考', value: 'medium' },
    { label: '深度思考', value: 'high' },
  ],
}) => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={label || '思考程度'}
      name={name}
      initialValue={defaultValue}
      tooltip="控制模型的思考深度"
    >
      <Select options={options} />
    </Form.Item>
  );
};

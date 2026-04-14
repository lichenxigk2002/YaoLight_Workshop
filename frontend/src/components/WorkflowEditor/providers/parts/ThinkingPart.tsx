import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { SwitchPart } from './SwitchPart';

export const ThinkingPart: React.FC<{
  name?: string;
  label?: string;
  defaultValue?: boolean;
}> = ({
  name = 'thinking',
  label,
  defaultValue = false,
}) => {
  const { t } = useTranslation();

  return (
    <SwitchPart
      name={name}
      label={label || t('node.config.ai.thinking') || '深度思考'}
      defaultValue={defaultValue}
      tooltip={t('node.config.ai.thinkingTooltip') || '开启后将显示模型的思维链过程（CoT）'}
    />
  );
};

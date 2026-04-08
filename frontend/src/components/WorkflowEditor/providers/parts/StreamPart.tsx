import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { SwitchPart } from './SwitchPart';

export const StreamPart: React.FC<{
  name?: string;
  label?: string;
  defaultValue?: boolean;
}> = ({
  name = 'stream',
  label,
  defaultValue = false,
}) => {
  const { t } = useTranslation();

  return (
    <SwitchPart
      name={name}
      label={label || t('node.config.ai.stream')}
      defaultValue={defaultValue}
      tooltip={t('node.config.ai.streamTooltip')}
    />
  );
};

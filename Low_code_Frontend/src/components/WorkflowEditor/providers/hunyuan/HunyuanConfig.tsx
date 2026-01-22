import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './HunyuanConfig.module.scss';
import { SegmentedSwitch } from '../parts/SwitchPart';

export const HunyuanConfig: React.FC<ProviderConfigProps> = () => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={t('node.config.ai.enableEnhancement', { defaultValue: '功能增强' })}
      name="enableEnhancement"
      initialValue={true}
      tooltip="enable_enhancement"
      className={styles.formItem}
    >
      <SegmentedSwitch />
    </Form.Item>
  );
};

import React from 'react';
import { Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './HunyuanConfig.module.scss';

export const HunyuanConfig: React.FC<ProviderConfigProps> = () => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={t('node.config.ai.enableEnhancement', { defaultValue: '功能增强' })}
      name="enableEnhancement"
      initialValue={true}
      valuePropName="checked"
      tooltip="enable_enhancement"
      className={styles.formItem}
    >
      <Switch />
    </Form.Item>
  );
};

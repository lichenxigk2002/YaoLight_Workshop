import React from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './SparkConfig.module.scss';

export const SparkConfig: React.FC<ProviderConfigProps> = () => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.ai.thinking') || 'Thinking Mode'}
        name="thinkingType"
        initialValue="enabled"
        className={styles.formItem}
      >
        <Select>
          <Select.Option value="enabled">enabled</Select.Option>
          <Select.Option value="auto">auto</Select.Option>
          <Select.Option value="disabled">disabled</Select.Option>
        </Select>
      </Form.Item>
    </>
  );
};


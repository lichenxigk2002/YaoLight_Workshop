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
        label={t('node.config.ai.thinking') || '思考模式'}
        name="thinkingType"
        initialValue="auto"
        className={styles.formItem}
        tooltip="enabled: 强制思考 | auto: 自动判断 | disabled: 不思考"
      >
        <Select>
          <Select.Option value="enabled">enabled (强制思考)</Select.Option>
          <Select.Option value="auto">auto (自动判断)</Select.Option>
          <Select.Option value="disabled">disabled (不思考)</Select.Option>
        </Select>
      </Form.Item>
    </>
  );
};


/**
 * DeepSeek 专属配置组件
 */

import React from 'react';
import { Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './DeepSeekConfig.module.scss';

export const DeepSeekConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.ai.thinking')}
        name="thinking"
        valuePropName="checked"
        initialValue={false}
        tooltip={t('node.config.ai.thinkingTooltip')}
        className={styles.formItem}
      >
        <Switch />
      </Form.Item>
    </>
  );
};


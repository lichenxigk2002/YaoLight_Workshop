/**
 * 智谱AI GLM 专属配置组件
 */

import React from 'react';
import { Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './ZhipuaiConfig.module.scss';

export const ZhipuaiConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _form = form; // 保留 form 参数以保持接口一致性

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


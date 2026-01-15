/**
 * 通义千问专属配置组件
 */

import React from 'react';
import { Form, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './QianwenConfig.module.scss';

export const QianwenConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.ai.enableThinking') || '深度思考'}
        name="enable_thinking"
        valuePropName="checked"
        initialValue={false}
        tooltip={t('node.config.ai.enableThinkingTooltip') || '开启后，思考内容将通过reasoning_content字段返回。适用于 Qwen3、Qwen3-Omni-Flash、Qwen3-VL模型。'}
        className={styles.formItem}
      >
        <Switch />
      </Form.Item>
    </>
  );
};


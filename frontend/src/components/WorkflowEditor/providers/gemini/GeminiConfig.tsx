import React from 'react';
import { Form, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './GeminiConfig.module.scss';

export const GeminiConfig: React.FC<ProviderConfigProps> = () => {
  const { t } = useTranslation();
  
  // 注意：Gemini 3 Pro Preview 默认就会思考，即使不设置 reasoning 参数
  // 因此不提供思考开关，让模型使用默认行为

  return (
    <>
      {/* 思考开关已移除：Gemini 3 Pro Preview 默认会思考，不需要开关 */}
      
      <Form.Item
        label={t('node.config.ai.frequencyPenalty') || "Frequency Penalty"}
        name="frequencyPenalty"
        tooltip={t('node.config.ai.frequencyPenaltyTooltip') || "Decreases the model's likelihood to repeat the same line verbatim."}
        className={styles.formItem}
      >
        <InputNumber min={-2.0} max={2.0} step={0.1} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label={t('node.config.ai.presencePenalty') || "Presence Penalty"}
        name="presencePenalty"
        tooltip={t('node.config.ai.presencePenaltyTooltip') || "Encourages the model to talk about new topics."}
        className={styles.formItem}
      >
        <InputNumber min={-2.0} max={2.0} step={0.1} style={{ width: '100%' }} />
      </Form.Item>
    </>
  );
};

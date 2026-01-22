import React, { useState, useEffect } from 'react';
import { Form, Select, InputNumber } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './GeminiConfig.module.scss';
import { SegmentedSwitch } from '../parts/SwitchPart';

export const GeminiConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();
  
  // 监听 reasoning 开关状态，用于控制 effort 选项的显示
  const reasoningEnabled = Form.useWatch('reasoning', form);

  return (
    <>
      <Form.Item
        label={t('node.config.ai.thinking') || "Enable Reasoning"}
        name="reasoning"
        initialValue={false}
        tooltip={t('node.config.ai.thinkingTooltip') || "Enable Gemini thinking/reasoning capabilities"}
        className={styles.formItem}
      >
        <SegmentedSwitch />
      </Form.Item>

      {reasoningEnabled && (
        <Form.Item
          label={t('node.config.ai.thinkingEffort') || "Reasoning Effort"}
          name="reasoning_effort"
          initialValue="medium"
          tooltip={t('node.config.ai.thinkingEffortTooltip') || "Adjust the model's thinking effort"}
          className={styles.formItem}
        >
          <Select>
            <Select.Option value="low">{t('node.config.ai.thinkingEffortLow') || "Low"}</Select.Option>
            <Select.Option value="medium">{t('node.config.ai.thinkingEffortMedium') || "Medium"}</Select.Option>
            <Select.Option value="high">{t('node.config.ai.thinkingEffortHigh') || "High"}</Select.Option>
          </Select>
        </Form.Item>
      )}

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

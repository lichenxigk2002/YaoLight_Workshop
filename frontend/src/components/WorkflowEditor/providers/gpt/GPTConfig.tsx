import React from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './GPTConfig.module.scss';
import { SegmentedSwitch } from '../parts/SwitchPart';

export const GPTConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();

  const reasoningEnabled = Form.useWatch('reasoning', form);

  return (
    <>
      <Form.Item
        label={t('node.config.ai.thinking') || 'Enable Reasoning'}
        name="reasoning"
        initialValue={false}
        tooltip={t('node.config.ai.thinkingTooltip') || 'Enable reasoning capabilities (OpenRouter)'}
        className={styles.formItem}
      >
        <SegmentedSwitch />
      </Form.Item>

      {reasoningEnabled && (
        <Form.Item
          label={t('node.config.ai.thinkingEffort') || 'Reasoning Effort'}
          name="reasoning_effort"
          initialValue="medium"
          tooltip={t('node.config.ai.thinkingEffortTooltip') || "Adjust the model's thinking effort"}
          className={styles.formItem}
        >
          <Select>
            <Select.Option value="low">{t('node.config.ai.thinkingEffortLow') || 'Low'}</Select.Option>
            <Select.Option value="medium">{t('node.config.ai.thinkingEffortMedium') || 'Medium'}</Select.Option>
            <Select.Option value="high">{t('node.config.ai.thinkingEffortHigh') || 'High'}</Select.Option>
          </Select>
        </Form.Item>
      )}
    </>
  );
};


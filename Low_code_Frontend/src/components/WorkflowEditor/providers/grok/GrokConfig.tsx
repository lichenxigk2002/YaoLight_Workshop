import React from 'react';
import { Form, Select, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './GrokConfig.module.scss';
import { SegmentedSwitch } from '../parts/SwitchPart';

export const GrokConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();
  
  // 监听 reasoning 开关状态，用于控制 effort 选项的显示
  const reasoningEnabled = Form.useWatch('reasoning', form);
  // 监听当前选择的模型
  const modelName = Form.useWatch('modelName', form);

  // 定义推理过程不可见的模型列表
  const invisibleReasoningModels = ['x-ai/grok-4'];
  
  // 检查当前模型是否在不可见列表中
  const isReasoningInvisible = modelName && invisibleReasoningModels.some(m => modelName.includes(m));

  return (
    <>
      <Form.Item
        label={t('node.config.ai.thinking') || "Enable Reasoning"}
        name="reasoning"
        initialValue={false}
        tooltip={t('node.config.ai.thinkingTooltip') || "Enable Grok thinking/reasoning capabilities"}
        className={styles.formItem}
      >
        <SegmentedSwitch />
      </Form.Item>

      {reasoningEnabled && (
        <>
          {isReasoningInvisible && (
            <div style={{ marginBottom: 16 }}>
              <Alert 
                message={t('node.config.ai.reasoningInvisible') || "推理过程不可见 (Reasoning process not visible)"} 
                type="warning" 
                showIcon 
                style={{ fontSize: 12 }}
              />
            </div>
          )}
          
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
        </>
      )}

      {/* 移除 GrokConfig 中重复的 Frequency/Presence Penalty，因为 AINodeConfig 中已经通过 support.frequencyPenalty 控制显示了 */}
    </>
  );
};

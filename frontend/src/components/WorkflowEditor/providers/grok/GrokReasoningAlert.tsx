import React from 'react';
import { Form, Alert } from 'antd';
import { useTranslation } from 'react-i18next';

export const GrokReasoningAlert: React.FC<{ form: any }> = ({ form }) => {
  const { t } = useTranslation();
  
  const reasoningEnabled = Form.useWatch('reasoning', form);
  const modelName = Form.useWatch('modelName', form);
  
  const invisibleReasoningModels = ['x-ai/grok-4'];
  const isReasoningInvisible = modelName && invisibleReasoningModels.some(m => modelName.includes(m));

  if (reasoningEnabled && isReasoningInvisible) {
    return (
      <div style={{ marginBottom: 16 }}>
        <Alert 
          message={t('node.config.ai.reasoningInvisible') || "推理过程不可见 (Reasoning process not visible)"} 
          type="warning" 
          showIcon 
          style={{ fontSize: 12 }}
        />
      </div>
    );
  }
  
  return null;
};

import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps, ProviderConfigOption } from '../types';
import {
  TemperaturePart,
  MaxTokensPart,
  TopPPart,
  StreamPart,
  ThinkingPart,
  ThinkingLevelPart,
  FrequencyPenaltyPart,
  PresencePenaltyPart,
  SelectPart,
  SwitchPart,
} from './index';

interface StandardProviderConfigProps extends ProviderConfigProps {
  options: ProviderConfigOption[];
}

const ConfigItem: React.FC<{ option: ProviderConfigOption; form: any }> = ({ option, form }) => {
  const { t } = useTranslation();
  const { type, field, label, props, component: CustomComponent, condition } = option;
  
  // Watch conditional field if condition exists
  // Note: We call useWatch unconditionally, but we pass the field name dynamically. 
  // If condition is undefined, we pass undefined, which returns undefined.
  const conditionValue = Form.useWatch(condition?.field, form);

  if (condition) {
    const { value, operator } = condition;
    let isMatch = false;

    if (operator === 'neq') {
      isMatch = conditionValue !== value;
    } else if (operator === 'in') {
      isMatch = Array.isArray(value) && value.includes(conditionValue);
    } else {
      // default 'eq'
      isMatch = conditionValue === value;
    }

    if (!isMatch) return null;
  }

  const key = field || type;
  const displayLabel = label ? t(label) : undefined;

  switch (type) {
    case 'temperature':
      return <TemperaturePart key={key} name={field} label={displayLabel} {...props} />;
    case 'maxTokens':
      return <MaxTokensPart key={key} name={field} label={displayLabel} {...props} />;
    case 'topP':
      return <TopPPart key={key} name={field} label={displayLabel} {...props} />;
    case 'stream':
      return <StreamPart key={key} name={field} label={displayLabel} {...props} />;
    case 'thinking':
      return <ThinkingPart key={key} name={field} label={displayLabel} {...props} />;
    case 'thinkingLevel':
      return <ThinkingLevelPart key={key} name={field} label={displayLabel} {...props} />;
    case 'frequencyPenalty':
      return <FrequencyPenaltyPart key={key} name={field} label={displayLabel} {...props} />;
    case 'presencePenalty':
      return <PresencePenaltyPart key={key} name={field} label={displayLabel} {...props} />;
    case 'select':
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return <SelectPart key={key} name={field} label={displayLabel} {...props} />;
    case 'switch':
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return <SwitchPart key={key} name={field} label={displayLabel} {...props} />;
    case 'custom':
      if (CustomComponent) {
        return <CustomComponent key={key} form={form} {...props} />;
      }
      return null;
    default:
      return null;
  }
};

export const StandardProviderConfig: React.FC<StandardProviderConfigProps> = ({
  form,
  options,
}) => {
  return (
    <>
      {options.map((option, index) => (
        <ConfigItem key={option.field || option.type || index} option={option} form={form} />
      ))}
    </>
  );
};

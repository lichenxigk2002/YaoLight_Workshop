import React from 'react';

export type ProviderConfigOptionType =
  | 'temperature'
  | 'maxTokens'
  | 'topP'
  | 'stream'
  | 'thinking'
  | 'thinkingLevel'
  | 'frequencyPenalty'
  | 'presencePenalty'
  | 'select'
  | 'switch'
  | 'custom';

export interface ProviderConfigOption {
  type: ProviderConfigOptionType;
  field?: string;
  label?: string;
  props?: Record<string, any>;
  component?: React.ComponentType<any>;
  condition?: {
    field: string;
    value: any;
    operator?: 'eq' | 'neq' | 'in';
  };
}

export interface ProviderConfigProps {
  form: any;
  nodeId?: string;
  readonly?: boolean;
}

export interface ProviderPreviewProps {
  form: any;
  nodeId?: string;
}

export interface AIProviderRegistration {
  name: string;
  displayName: string;
  ConfigComponent?: React.ComponentType<ProviderConfigProps>;
  configuration?: ProviderConfigOption[];
  PreviewComponent?: React.ComponentType<ProviderPreviewProps>;
  supportedConfig?: {
    stream?: boolean;
    thinking?: boolean;
    thinkingLevel?: boolean;
    frequencyPenalty?: boolean;
    presencePenalty?: boolean;
    stopSequences?: boolean;
  };
  defaultConfig?: Record<string, any>;
}

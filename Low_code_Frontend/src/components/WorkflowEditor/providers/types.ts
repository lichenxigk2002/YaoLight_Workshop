/**
 * AI 提供商类型定义
 * 用于支持可扩展的 AI 提供商配置和预览
 */

import { FormInstance } from 'antd';
import { Node } from 'reactflow';

/**
 * 提供商配置组件 Props
 */
export interface ProviderConfigProps {
  form: FormInstance;
  node?: Node | null;
  nodes?: Node[];
  edges?: any[];
}

/**
 * 提供商预览组件 Props
 */
export interface ProviderPreviewProps {
  open: boolean;
  onClose: () => void;
  aiTest: {
    previewOpen: boolean;
    setPreviewOpen: (open: boolean) => void;
    previewData: any;
    streamingContent: string;
    streamingReasoningContent: string;
    isStreaming: boolean;
    isReasoningStreaming?: boolean;
    cancelStream: () => void;
  };
  nodeConfig?: Record<string, any>;
}

/**
 * AI 提供商注册信息
 */
export interface AIProviderRegistration {
  /** 提供商名称（唯一标识） */
  name: string;
  /** 显示名称 */
  displayName: string;
  /** 配置组件 */
  ConfigComponent: React.ComponentType<ProviderConfigProps>;
  /** 预览组件 */
  PreviewComponent: React.ComponentType<ProviderPreviewProps>;
  /** 支持的配置项 */
  supportedConfig: {
    stream?: boolean;
    thinking?: boolean;
    thinkingLevel?: boolean;
    frequencyPenalty?: boolean;
    presencePenalty?: boolean;
    stopSequences?: boolean;
  };
  /** 默认配置 */
  defaultConfig?: Record<string, any>;
}


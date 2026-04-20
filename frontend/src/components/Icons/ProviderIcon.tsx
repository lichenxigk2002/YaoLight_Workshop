/**
 * AI 提供商图标组件
 */

import React from 'react';
import { Claude, DeepSeek, Doubao, Gemini, Grok, Hunyuan, Moonshot, OpenAI, Qwen, Spark, Zhipu } from '@lobehub/icons';

// 检查图标组件是否正确加载
const SafeIcon = ({ Component, ...props }: any) => {
  if (!Component) {
    console.warn('Icon component missing or invalid:', Component);
    return null;
  }

  const AnyComponent = Component as any;
  if (AnyComponent.Color) {
    return <AnyComponent.Color {...props} />;
  }
  return <AnyComponent {...props} />;
};

interface ProviderIconProps {
  provider: string;
  size?: number;
  className?: string;
}

/**
 * 根据提供商名称返回对应的图标
 */
export const ProviderIcon: React.FC<ProviderIconProps> = ({ provider, size = 16, className }) => {
  const providerLower = provider?.toLowerCase() || '';

  if (providerLower === 'deepseek') {
    return <SafeIcon Component={DeepSeek} size={size} className={className} />;
  }

  if (providerLower === 'doubao') {
    return <SafeIcon Component={Doubao} size={size} className={className} />;
  }

  if (providerLower === 'moonshot' || providerLower === 'kimi') {
    return <SafeIcon Component={Moonshot} size={size} className={className} />;
  }

  if (providerLower === 'qianwen' || providerLower === 'qwen') {
    if (!Qwen) {
      console.warn('Qwen icon component is missing');
      return null;
    }
    const QwenMono = (Qwen as any).Mono ?? Qwen;
    return <QwenMono size={size} className={className} style={{ color: '#615ced' }} />;
  }

  if (providerLower === 'zhipuai') {
    return <SafeIcon Component={Zhipu} size={size} className={className} />;
  }

  if (providerLower === 'gemini') {
    return <SafeIcon Component={Gemini} size={size} className={className} />;
  }

  if (providerLower === 'gpt' || providerLower === 'openai') {
    return <SafeIcon Component={OpenAI} size={size} className={className} />;
  }

  if (providerLower === 'grok') {
    return <SafeIcon Component={Grok} size={size} className={className} />;
  }

  if (providerLower === 'spark') {
    return <SafeIcon Component={Spark} size={size} className={className} />;
  }

  if (providerLower === 'hunyuan') {
    return <SafeIcon Component={Hunyuan} size={size} className={className} />;
  }

  if (providerLower === 'claude' || providerLower === 'anthropic') {
    return <SafeIcon Component={Claude} size={size} className={className} />;
  }

  // 默认返回空（未知提供商）
  return null;
};

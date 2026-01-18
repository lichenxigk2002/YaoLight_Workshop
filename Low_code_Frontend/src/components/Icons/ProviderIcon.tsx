/**
 * AI 提供商图标组件
 */

import React from 'react';
import { DeepSeek, Doubao, Qwen, Zhipu, Gemini, Grok, OpenAI, Spark, Hunyuan } from '@lobehub/icons';

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

  if (providerLower === 'qianwen' || providerLower === 'qwen') {
    // 确保 Qwen 组件存在，否则返回 null 避免报错
    if (!Qwen) {
      console.warn('Qwen icon component is missing');
      return null;
    }
    // 用户反馈图标显示有问题，使用单色版本，并指定通义千问的品牌色（紫色 #615CED）
    // 注意：SafeIcon 会优先使用 Color 组件，所以这里直接使用 Qwen 组件
    return <Qwen size={size} className={className} style={{ color: '#615CED' }} />;
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

  // 默认返回空（未知提供商）
  return null;
};

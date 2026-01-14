/**
 * DeepSeek 专属预览组件
 * 可以自定义 DeepSeek 的预览显示方式
 */

import React from 'react';
import { ProviderPreviewProps } from '../types';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

export const DeepSeekPreview: React.FC<ProviderPreviewProps> = (props) => {
  // DeepSeek 使用通用的预览组件
  // 如果需要自定义，可以在这里实现
  return <AIPreviewModal {...props} />;
};


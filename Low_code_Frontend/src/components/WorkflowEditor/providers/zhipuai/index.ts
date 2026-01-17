/**
 * 智谱AI GLM 提供商注册
 */

import { providerRegistry } from '../registry';
import { ZhipuaiConfig } from './ZhipuaiConfig';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

providerRegistry.register({
  name: 'zhipuai',
  displayName: '智谱AI GLM',
  ConfigComponent: ZhipuaiConfig,
  PreviewComponent: AIPreviewModal, // 使用通用的预览组件
  supportedConfig: {
    stream: true,
    thinking: true,
  },
  defaultConfig: {
    stream: false,
    thinking: false,
  },
});


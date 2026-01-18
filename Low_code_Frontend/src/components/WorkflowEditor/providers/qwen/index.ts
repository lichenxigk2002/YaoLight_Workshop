/**
 * 通义千问提供商注册
 */

import { providerRegistry } from '../registry';
import { QwenConfig } from './QwenConfig';
import { QwenPreview } from './QwenPreview';

providerRegistry.register({
  name: 'qwen',
  displayName: '通义千问',
  ConfigComponent: QwenConfig,
  PreviewComponent: QwenPreview,
  supportedConfig: {
    stream: true,
    thinking: true, // 通义千问使用 enable_thinking 参数
  },
  defaultConfig: {
    stream: false,
    enable_thinking: false,
  },
});


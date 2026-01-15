/**
 * 通义千问提供商注册
 */

import { providerRegistry } from '../registry';
import { QianwenConfig } from './QianwenConfig';
import { QianwenPreview } from './QianwenPreview';

providerRegistry.register({
  name: 'qianwen',
  displayName: '通义千问',
  ConfigComponent: QianwenConfig,
  PreviewComponent: QianwenPreview,
  supportedConfig: {
    stream: true,
    thinking: true, // 通义千问使用 enable_thinking 参数
  },
  defaultConfig: {
    stream: false,
    enable_thinking: false,
  },
});


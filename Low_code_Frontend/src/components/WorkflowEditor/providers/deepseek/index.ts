/**
 * DeepSeek 提供商注册
 */

import { providerRegistry } from '../registry';
import { DeepSeekConfig } from './DeepSeekConfig';
import { DeepSeekPreview } from './DeepSeekPreview';

providerRegistry.register({
  name: 'deepseek',
  displayName: 'DeepSeek',
  ConfigComponent: DeepSeekConfig,
  PreviewComponent: DeepSeekPreview,
  supportedConfig: {
    stream: true,
    thinking: true,
  },
  defaultConfig: {
    stream: false,
    thinking: false,
  },
});


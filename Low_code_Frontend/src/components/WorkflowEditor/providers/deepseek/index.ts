/**
 * DeepSeek 提供商注册
 */

import { providerRegistry } from '../registry';
import { DeepSeekPreview } from './DeepSeekPreview';

providerRegistry.register({
  name: 'deepseek',
  displayName: 'DeepSeek',
  configuration: [
    { type: 'temperature', props: { defaultValue: 1.0 } },
    { type: 'maxTokens', props: { defaultValue: 2000, max: 65536 } },
    { type: 'topP', props: { defaultValue: 1.0 } },
    { type: 'stream', props: { defaultValue: false } },
    { type: 'thinking', props: { defaultValue: false } },
  ],
  PreviewComponent: DeepSeekPreview,
  supportedConfig: {
    stream: true,
    thinking: true,
  },
  defaultConfig: {
    temperature: 1.0,
    maxTokens: 2000,
    topP: 1.0,
    stream: false,
    thinking: false,
  },
});

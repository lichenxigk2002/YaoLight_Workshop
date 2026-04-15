/**
 * 豆包提供商注册
 */

import { providerRegistry } from '../registry';
import { DoubaoPreview } from './DoubaoPreview';

providerRegistry.register({
  name: 'doubao',
  displayName: '豆包',
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.7 } },
    { type: 'maxTokens', props: { defaultValue: 2000, max: 32768 } },
    { type: 'stream', props: { defaultValue: false } },
    { type: 'thinkingLevel', props: { defaultValue: 'medium' } },
  ],
  PreviewComponent: DoubaoPreview,
  supportedConfig: {
    stream: true,
    thinkingLevel: true,
  },
  defaultConfig: {
    stream: false,
    thinkingLevel: 'medium',
    temperature: 0.7,
    maxTokens: 2000,
  },
});

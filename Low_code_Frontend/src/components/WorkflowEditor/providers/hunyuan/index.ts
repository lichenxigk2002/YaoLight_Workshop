import { providerRegistry } from '../registry';
import { HunyuanPreview } from './HunyuanPreview';

providerRegistry.register({
  name: 'hunyuan',
  displayName: '腾讯混元',
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.7 } },
    { type: 'maxTokens', props: { defaultValue: 2000, max: 32768 } },
    { type: 'topP', props: { defaultValue: 1.0 } },
    { type: 'stream', props: { defaultValue: false } },
    { 
      type: 'switch', 
      field: 'enableEnhancement', 
      label: 'node.config.ai.enableEnhancement',
      props: { defaultValue: true, tooltip: 'enable_enhancement' } 
    },
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
  PreviewComponent: HunyuanPreview,
  supportedConfig: {
    stream: true,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 0.7,
    topP: 1.0,
    maxTokens: 2000,
    stream: false,
    enableEnhancement: true,
    modelName: 'hunyuan-turbos-latest',
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
  },
});

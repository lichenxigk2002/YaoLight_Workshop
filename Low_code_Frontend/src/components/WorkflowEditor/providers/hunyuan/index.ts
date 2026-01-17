import { providerRegistry } from '../registry';
import { HunyuanConfig } from './HunyuanConfig';
import { HunyuanPreview } from './HunyuanPreview';

providerRegistry.register({
  name: 'hunyuan',
  displayName: '腾讯混元',
  ConfigComponent: HunyuanConfig,
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


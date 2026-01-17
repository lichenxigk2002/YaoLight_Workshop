import { providerRegistry } from '../registry';
import { SparkConfig } from './SparkConfig';
import { SparkPreview } from './SparkPreview';

providerRegistry.register({
  name: 'spark',
  displayName: '讯飞星火',
  ConfigComponent: SparkConfig,
  PreviewComponent: SparkPreview,
  supportedConfig: {
    stream: true,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 1.2,
    topP: 0.95,
    maxTokens: 65535,
    stream: false,
    thinkingType: 'enabled',
    modelName: 'spark-x',
    baseUrl: 'https://spark-api-open.xf-yun.com/v2',
  },
});


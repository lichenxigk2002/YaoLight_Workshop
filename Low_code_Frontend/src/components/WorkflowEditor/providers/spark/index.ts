import { providerRegistry } from '../registry';
import { SparkPreview } from './SparkPreview';

providerRegistry.register({
  name: 'spark',
  displayName: '讯飞星火',
  configuration: [
    { type: 'temperature', props: { defaultValue: 1.2 } },
    { type: 'topP', props: { defaultValue: 0.95 } },
    { type: 'maxTokens', props: { defaultValue: 65535, max: 65535 } },
    { type: 'stream', props: { defaultValue: false } },
    { 
      type: 'select',
      field: 'thinkingType',
      label: '思考模式',
      props: {
        defaultValue: 'auto',
        options: [
          { label: 'enabled (强制思考)', value: 'enabled' },
          { label: 'auto (自动判断)', value: 'auto' },
          { label: 'disabled (不思考)', value: 'disabled' },
        ]
      }
    },
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
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
    thinkingType: 'auto',
    modelName: 'spark-x',
    baseUrl: 'https://spark-api-open.xf-yun.com/v2',
  },
});

import { providerRegistry } from '../registry';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

providerRegistry.register({
  name: 'zhipuai',
  displayName: '智谱AI GLM',
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.95 } },
    { type: 'maxTokens', props: { defaultValue: 4096, max: 131072 } },
    { type: 'topP', props: { defaultValue: 0.7 } },
    { type: 'stream', props: { defaultValue: false } },
    { 
      type: 'thinking', 
      field: 'thinking', 
      label: 'node.config.ai.thinking',
      props: { defaultValue: false } 
    },
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
  PreviewComponent: AIPreviewModal,
  supportedConfig: {
    stream: true,
    thinking: true,
  },
  defaultConfig: {
    stream: false,
    thinking: false,
    temperature: 0.95,
    maxTokens: 4096,
  },
});

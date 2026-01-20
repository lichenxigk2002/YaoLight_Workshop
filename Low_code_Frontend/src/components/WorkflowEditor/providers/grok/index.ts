import { providerRegistry } from '../registry';
import { GrokPreview } from './GrokPreview';
import { GrokReasoningAlert } from './GrokReasoningAlert';

providerRegistry.register({
  name: 'grok',
  displayName: 'Grok',
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.7 } },
    { type: 'maxTokens', props: { defaultValue: 4096, max: 131072 } },
    { type: 'topP', props: { defaultValue: 1 } },
    { type: 'stream', props: { defaultValue: false } },
    { 
      type: 'thinking', 
      field: 'reasoning', 
      label: 'node.config.ai.thinking',
      props: { defaultValue: false } 
    },
    {
      type: 'custom',
      component: GrokReasoningAlert
    },
    { 
      type: 'thinkingLevel', 
      field: 'reasoning_effort', 
      label: 'node.config.ai.thinkingEffort',
      props: { 
        defaultValue: 'medium',
        options: [
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'medium' },
          { label: 'High', value: 'high' }
        ]
      },
      condition: {
        field: 'reasoning',
        value: true
      }
    },
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
  PreviewComponent: GrokPreview,
  supportedConfig: {
    stream: true,
    thinking: true,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 0.7,
    maxTokens: 4096,
    reasoning: false,
    reasoning_effort: 'medium',
    stream: false,
  },
});

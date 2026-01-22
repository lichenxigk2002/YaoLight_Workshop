import { providerRegistry } from '../registry';
import { GeminiPreview } from './GeminiPreview';

providerRegistry.register({
  name: 'gemini',
  displayName: 'Google Gemini',
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.7 } },
    { type: 'maxTokens', props: { defaultValue: 2000, max: 32768 } },
    { type: 'topP', props: { defaultValue: 1 } }, // Gemini usually supports topP
    { type: 'stream', props: { defaultValue: false } },
    { 
      type: 'thinking', 
      field: 'reasoning', 
      label: 'node.config.ai.thinking',
      props: { defaultValue: false } 
    },
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
  PreviewComponent: GeminiPreview,
  supportedConfig: {
    stream: true,
    thinking: true,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 0.7,
    maxTokens: 2000,
    reasoning: false,
    stream: false,
  },
});

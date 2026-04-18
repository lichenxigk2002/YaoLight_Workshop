import { providerRegistry } from '../registry';

providerRegistry.register({
  name: 'moonshot',
  displayName: 'Moonshot',
  configuration: [
    { type: 'temperature', props: { defaultValue: 1 } },
    { type: 'maxTokens', props: { defaultValue: 4096, max: 32768 } },
    { type: 'topP', props: { defaultValue: 0.95 } },
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
  supportedConfig: {
    stream: true,
    thinking: true,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 1,
    maxTokens: 4096,
    topP: 0.95,
    stream: false,
    thinking: false,
  },
});

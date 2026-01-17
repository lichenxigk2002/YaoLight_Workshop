import { providerRegistry } from '../registry';
import { GPTConfig } from './GPTConfig';
import { GPTPreview } from './GPTPreview';

providerRegistry.register({
  name: 'gpt',
  displayName: 'GPT',
  ConfigComponent: GPTConfig,
  PreviewComponent: GPTPreview,
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
  },
});


import { providerRegistry } from '../registry';
import { GrokConfig } from './GrokConfig';
import { GrokPreview } from './GrokPreview';

providerRegistry.register({
  name: 'grok',
  displayName: 'Grok',
  ConfigComponent: GrokConfig,
  PreviewComponent: GrokPreview,
  supportedConfig: {
    stream: true,
    thinking: true, // Grok supports reasoning via OpenRouter
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

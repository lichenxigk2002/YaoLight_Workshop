import { providerRegistry } from '../registry';
import { GeminiConfig } from './GeminiConfig';
import { GeminiPreview } from './GeminiPreview';

providerRegistry.register({
  name: 'gemini',
  displayName: 'Google Gemini',
  ConfigComponent: GeminiConfig,
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
  },
});

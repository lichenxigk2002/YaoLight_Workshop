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
    // 注意：Gemini 3 Pro Preview 默认就会思考，即使不设置 reasoning 参数
    // 因此不提供思考开关，让模型使用默认行为
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
  PreviewComponent: GeminiPreview,
  supportedConfig: {
    stream: true,
    // thinking: false, // Gemini 默认会思考，不需要开关
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 0.7,
    maxTokens: 2000,
    // reasoning: false, // 不设置 reasoning 参数，让模型使用默认行为
    stream: false,
  },
});

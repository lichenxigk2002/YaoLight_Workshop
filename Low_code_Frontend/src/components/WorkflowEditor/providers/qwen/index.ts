import { providerRegistry } from '../registry';
import { QwenPreview } from './QwenPreview';

providerRegistry.register({
  name: 'qwen',
  displayName: '通义千问',
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.7 } },
    { type: 'maxTokens', props: { defaultValue: 2000, max: 32768 } },
    { type: 'topP', props: { defaultValue: 0.8 } }, // Qwen usually 0.8
    { type: 'stream', props: { defaultValue: false } },
    { 
      type: 'thinking', 
      field: 'enable_thinking', 
      label: 'node.config.ai.enableThinking',
      props: { 
        defaultValue: false,
        tooltip: 'node.config.ai.enableThinkingTooltip' 
      } 
    },
    { type: 'frequencyPenalty', props: { defaultValue: 0 } },
    { type: 'presencePenalty', props: { defaultValue: 0 } },
  ],
  PreviewComponent: QwenPreview,
  supportedConfig: {
    stream: true,
    thinking: true, // 通义千问使用 enable_thinking 参数
  },
  defaultConfig: {
    stream: false,
    enable_thinking: false,
    temperature: 0.7,
    maxTokens: 2000,
  },
});

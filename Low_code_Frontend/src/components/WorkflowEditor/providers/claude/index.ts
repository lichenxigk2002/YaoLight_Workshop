import { providerRegistry } from '../registry';
import { ClaudePreview } from './ClaudePreview';

providerRegistry.register({
  name: 'claude',
  displayName: 'Claude',
  // Claude API支持流式输出和推理（Extended Thinking）功能
  // 但官方示例中默认不启用，因此这些选项保留但默认值为false（与官方示例一致）
  configuration: [
    { type: 'temperature', props: { defaultValue: 0.7 } },
    { type: 'maxTokens', props: { defaultValue: 4096, max: 131072 } },
    { type: 'topP', props: { defaultValue: 1 } },
    { type: 'stream', props: { defaultValue: false } }, // 支持流式，但默认关闭（与官方示例一致）
    {
      type: 'thinking',
      field: 'reasoning',
      label: 'node.config.ai.thinking',
      props: { defaultValue: false } // 支持推理，但默认关闭（与官方示例一致）
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
  PreviewComponent: ClaudePreview,
  supportedConfig: {
    stream: true,  // Claude支持流式输出
    thinking: true,  // Claude支持推理（Extended Thinking）
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    temperature: 0.7,
    maxTokens: 4096,
    stream: false,  // 默认不启用流式（与官方示例一致）
    reasoning: false,  // 默认不启用推理（与官方示例一致）
    reasoning_effort: 'medium',
  },
});


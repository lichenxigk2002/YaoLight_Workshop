import type { ComponentType } from 'react';
import {
  Alibaba,
  AlibabaCloud,
  Anthropic,
  Aws,
  Azure,
  AzureAI,
  Baidu,
  BaiduCloud,
  Bedrock,
  ByteDance,
  Claude,
  Cohere,
  DeepSeek,
  DeepMind,
  Doubao,
  Fireworks,
  Gemini,
  Google,
  GoogleCloud,
  Grok,
  Groq,
  HuggingFace,
  Hunyuan,
  Meta,
  Midjourney,
  Minimax,
  Mistral,
  Moonshot,
  Ollama,
  OpenAI,
  OpenRouter,
  Perplexity,
  Qwen,
  SiliconCloud,
  Spark,
  Stability,
  Stepfun,
  Tencent,
  TencentCloud,
  Together,
  Volcengine,
  XAI,
  Zhipu,
} from '@lobehub/icons';

export type LobeIconComponent = ComponentType<any> & {
  Color?: ComponentType<any>;
};

export type AIIconGroup = 'model' | 'provider';

export interface AIIconPreset {
  key: string;
  label: string;
  group: AIIconGroup;
  Icon: LobeIconComponent;
}

const PROVIDER_ICON_PRESETS: AIIconPreset[] = [
  { key: 'OpenAI', label: 'OpenAI', group: 'provider', Icon: OpenAI },
  { key: 'Anthropic', label: 'Anthropic', group: 'provider', Icon: Anthropic },
  { key: 'Google', label: 'Google', group: 'provider', Icon: Google },
  { key: 'GoogleCloud', label: 'Google Cloud', group: 'provider', Icon: GoogleCloud },
  { key: 'Meta', label: 'Meta', group: 'provider', Icon: Meta },
  { key: 'Mistral', label: 'Mistral', group: 'provider', Icon: Mistral },
  { key: 'Cohere', label: 'Cohere', group: 'provider', Icon: Cohere },
  { key: 'Perplexity', label: 'Perplexity', group: 'provider', Icon: Perplexity },
  { key: 'Groq', label: 'Groq', group: 'provider', Icon: Groq },
  { key: 'OpenRouter', label: 'OpenRouter', group: 'provider', Icon: OpenRouter },
  { key: 'Together', label: 'Together AI', group: 'provider', Icon: Together },
  { key: 'Fireworks', label: 'Fireworks', group: 'provider', Icon: Fireworks },
  { key: 'Stability', label: 'Stability AI', group: 'provider', Icon: Stability },
  { key: 'HuggingFace', label: 'Hugging Face', group: 'provider', Icon: HuggingFace },
  { key: 'Ollama', label: 'Ollama', group: 'provider', Icon: Ollama },
  { key: 'Azure', label: 'Microsoft Azure', group: 'provider', Icon: Azure },
  { key: 'AzureAI', label: 'Azure AI', group: 'provider', Icon: AzureAI },
  { key: 'Aws', label: 'AWS', group: 'provider', Icon: Aws },
  { key: 'Bedrock', label: 'Amazon Bedrock', group: 'provider', Icon: Bedrock },
  { key: 'ByteDance', label: '字节跳动', group: 'provider', Icon: ByteDance },
  { key: 'Volcengine', label: '火山引擎', group: 'provider', Icon: Volcengine },
  { key: 'Alibaba', label: '阿里巴巴', group: 'provider', Icon: Alibaba },
  { key: 'AlibabaCloud', label: '阿里云', group: 'provider', Icon: AlibabaCloud },
  { key: 'Tencent', label: '腾讯', group: 'provider', Icon: Tencent },
  { key: 'TencentCloud', label: '腾讯云', group: 'provider', Icon: TencentCloud },
  { key: 'Baidu', label: '百度', group: 'provider', Icon: Baidu },
  { key: 'BaiduCloud', label: '百度智能云', group: 'provider', Icon: BaiduCloud },
  { key: 'SiliconCloud', label: '硅基流动', group: 'provider', Icon: SiliconCloud },
  { key: 'Stepfun', label: '阶跃星辰', group: 'provider', Icon: Stepfun },
  { key: 'Minimax', label: 'MiniMax', group: 'provider', Icon: Minimax },
  { key: 'XAI', label: 'xAI', group: 'provider', Icon: XAI },
];

const MODEL_ICON_PRESETS: AIIconPreset[] = [
  { key: 'OpenAI', label: 'GPT / OpenAI', group: 'model', Icon: OpenAI },
  { key: 'Claude', label: 'Claude', group: 'model', Icon: Claude },
  { key: 'Gemini', label: 'Gemini', group: 'model', Icon: Gemini },
  { key: 'Grok', label: 'Grok', group: 'model', Icon: Grok },
  { key: 'DeepSeek', label: 'DeepSeek', group: 'model', Icon: DeepSeek },
  { key: 'Doubao', label: '豆包', group: 'model', Icon: Doubao },
  { key: 'Qwen', label: '通义千问', group: 'model', Icon: Qwen },
  { key: 'Hunyuan', label: '腾讯混元', group: 'model', Icon: Hunyuan },
  { key: 'Spark', label: '讯飞星火', group: 'model', Icon: Spark },
  { key: 'Zhipu', label: '智谱 GLM', group: 'model', Icon: Zhipu },
  { key: 'Moonshot', label: 'Kimi / Moonshot', group: 'model', Icon: Moonshot },
  { key: 'Mistral', label: 'Mistral', group: 'model', Icon: Mistral },
  { key: 'Meta', label: 'Llama / Meta', group: 'model', Icon: Meta },
  { key: 'Minimax', label: 'MiniMax', group: 'model', Icon: Minimax },
  { key: 'Cohere', label: 'Cohere', group: 'model', Icon: Cohere },
  { key: 'Perplexity', label: 'Perplexity', group: 'model', Icon: Perplexity },
  { key: 'Groq', label: 'Groq', group: 'model', Icon: Groq },
  { key: 'Ollama', label: 'Ollama', group: 'model', Icon: Ollama },
  { key: 'Bedrock', label: 'Amazon Bedrock', group: 'model', Icon: Bedrock },
  { key: 'HuggingFace', label: 'Hugging Face', group: 'model', Icon: HuggingFace },
  { key: 'Midjourney', label: 'Midjourney', group: 'model', Icon: Midjourney },
  { key: 'Stability', label: 'Stable Diffusion / Stability', group: 'model', Icon: Stability },
  { key: 'DeepMind', label: 'DeepMind', group: 'model', Icon: DeepMind },
];

export const AI_ICON_PRESETS: AIIconPreset[] = [
  ...PROVIDER_ICON_PRESETS,
  ...MODEL_ICON_PRESETS,
];

export const AI_ICON_MAP: Record<string, LobeIconComponent> = Object.fromEntries(
  AI_ICON_PRESETS.map((item) => [item.key, item.Icon]),
) as Record<string, LobeIconComponent>;

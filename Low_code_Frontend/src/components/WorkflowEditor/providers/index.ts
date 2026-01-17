/**
 * AI 提供商统一导出
 */

export { providerRegistry } from './registry';
export type { AIProviderRegistration, ProviderConfigProps, ProviderPreviewProps } from './types';

// 注册所有提供商
import './deepseek';
import './doubao';
import './gemini';
import './gpt';
import './hunyuan';
import './qwen';
import './spark';
import './zhipuai';
import './grok';

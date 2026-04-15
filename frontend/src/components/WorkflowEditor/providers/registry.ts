/**
 * AI 提供商注册表
 * 用于管理所有 AI 提供商的配置和预览组件
 */

import { AIProviderRegistration } from './types';

class ProviderRegistry {
  private providers: Map<string, AIProviderRegistration> = new Map();

  /**
   * 注册 AI 提供商
   */
  register(registration: AIProviderRegistration) {
    this.providers.set(registration.name.toLowerCase(), registration);
  }

  /**
   * 获取 AI 提供商
   */
  get(name: string): AIProviderRegistration | undefined {
    return this.providers.get(name.toLowerCase());
  }

  /**
   * 获取所有已注册的提供商
   */
  getAll(): AIProviderRegistration[] {
    return Array.from(this.providers.values());
  }

  /**
   * 检查提供商是否已注册
   */
  has(name: string): boolean {
    return this.providers.has(name.toLowerCase());
  }
}

// 导出单例
export const providerRegistry = new ProviderRegistry();


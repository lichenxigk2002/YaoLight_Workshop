import type {
  OutputDestinationProvider,
  OutputFormatProvider,
  OutputDestinationId,
  OutputFormatId,
} from './types';

/**
 * 输出节点 Provider Registry（前端）
 * 设计目标：
 * - 像 AI providerRegistry 一样，输出格式/投递目标可注册扩展（PDF/Word/Chart/Mermaid 等）
 * - OutputNodeConfig 只依赖 registry 渲染选项，避免写死
 * - 与后端 export providers 保持值对齐（backendValue）
 */
class OutputProviderRegistry {
  private formats = new Map<OutputFormatId, OutputFormatProvider>();
  private destinations = new Map<OutputDestinationId, OutputDestinationProvider>();

  registerFormat(p: OutputFormatProvider) {
    this.formats.set(p.id, p);
  }

  registerDestination(p: OutputDestinationProvider) {
    this.destinations.set(p.id, p);
  }

  getFormat(id: OutputFormatId) {
    return this.formats.get(id);
  }

  getDestination(id: OutputDestinationId) {
    return this.destinations.get(id);
  }

  getAllFormats(): OutputFormatProvider[] {
    return Array.from(this.formats.values());
  }

  getAllDestinations(): OutputDestinationProvider[] {
    return Array.from(this.destinations.values());
  }
}

export const outputProviderRegistry = new OutputProviderRegistry();


import { registerDefaultOutputProviders } from './defaultProviders';

// 触发默认注册（类似 AINodeConfig 里 import '../providers' 的方式）
registerDefaultOutputProviders();

export { outputProviderRegistry } from './registry';
export type {
  OutputFormatId,
  OutputDestinationId,
  OutputFormatProvider,
  OutputDestinationProvider,
} from './types';


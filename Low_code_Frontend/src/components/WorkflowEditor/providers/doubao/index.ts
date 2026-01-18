/**
 * 豆包提供商注册
 */

import { providerRegistry } from '../registry';
import { DoubaoConfig } from './DoubaoConfig';
import { DoubaoPreview } from './DoubaoPreview';

providerRegistry.register({
  name: 'doubao',
  displayName: '豆包',
  ConfigComponent: DoubaoConfig,
  PreviewComponent: DoubaoPreview,
  supportedConfig: {
    stream: true,
    thinkingLevel: true, // 豆包使用思考长度，而不是开关
  },
  defaultConfig: {
    stream: false,
    thinkingLevel: 'medium',
  },
});


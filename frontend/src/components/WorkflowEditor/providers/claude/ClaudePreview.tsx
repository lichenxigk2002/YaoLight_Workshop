import React from 'react';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

// Claude使用通用的预览组件
// 注意：实际使用时，NodeConfigPanel会传递AIPreviewModalProps，这里使用any以兼容
export const ClaudePreview: React.FC<any> = (props) => {
  return <AIPreviewModal {...props} />;
};


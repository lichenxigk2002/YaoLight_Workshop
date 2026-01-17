import React from 'react';
import { ProviderPreviewProps } from '../types';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

export const GeminiPreview: React.FC<ProviderPreviewProps> = (props) => {
  return <AIPreviewModal {...props} />;
};

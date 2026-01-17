import React from 'react';
import { ProviderPreviewProps } from '../types';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

export const GrokPreview: React.FC<ProviderPreviewProps> = (props) => {
  return <AIPreviewModal {...props} />;
};

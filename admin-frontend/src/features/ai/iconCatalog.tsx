import type { ReactNode } from 'react';
import { toc } from '@lobehub/icons';
import AIIcon from '@/components/Icons/AIIcon';

type IconGroup = 'model' | 'provider' | 'application';

export interface AIIconOption {
  value: string;
  label: string;
  group: IconGroup;
  searchText: string;
  preview: ReactNode;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function getAIIconOptions(groups?: IconGroup[]): AIIconOption[] {
  const groupSet = groups ? new Set(groups) : null;

  return toc
    .filter((item) => !groupSet || groupSet.has(item.group))
    .map((item) => ({
      value: item.id,
      label: item.fullTitle || item.title || item.id,
      group: item.group,
      searchText: normalizeSearchText(`${item.id} ${item.title} ${item.fullTitle}`),
      preview: <AIIcon iconKey={item.id} size={18} />,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

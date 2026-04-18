import type { ReactNode } from 'react';
import AIIcon from '@/components/Icons/AIIcon';
import { AI_ICON_PRESETS, type AIIconGroup } from '@/components/Icons/lobeIconMap';

export interface AIIconOption {
  value: string;
  label: string;
  group: AIIconGroup;
  searchText: string;
  preview: ReactNode;
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

export function getAIIconOptions(groups?: AIIconGroup[]): AIIconOption[] {
  const groupSet = groups ? new Set(groups) : null;
  const seen = new Set<string>();

  return AI_ICON_PRESETS
    .filter((item) => !groupSet || groupSet.has(item.group))
    .filter((item) => {
      if (seen.has(item.key)) {
        return false;
      }
      seen.add(item.key);
      return true;
    })
    .map((item) => ({
      value: item.key,
      label: item.label,
      group: item.group,
      searchText: normalizeSearchText(`${item.key} ${item.label}`),
      preview: <AIIcon iconKey={item.key} size={18} />,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

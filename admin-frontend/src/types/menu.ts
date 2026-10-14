import type { ReactNode } from 'react';

export interface AdminMenuItem {
  key: string;
  path?: string;
  label: string;
  icon?: ReactNode;
  aliases?: string[];
  permissionKey?: string;
  children?: AdminMenuItem[];
}

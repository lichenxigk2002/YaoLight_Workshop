import type { CSSProperties, ComponentType, FC } from 'react';
import * as LobeHubIcons from '@lobehub/icons';
import ProviderIcon from './ProviderIcon';

type IconProps = {
  size?: string | number;
  className?: string;
  style?: CSSProperties;
};

type LobeIconComponent = ComponentType<any> & {
  Color?: ComponentType<any>;
};

interface AIIconProps extends IconProps {
  iconKey?: string | null;
  fallbackProvider?: string;
}

const iconRegistry = LobeHubIcons as Record<string, unknown>;

const RenderIcon: FC<{ Icon?: LobeIconComponent } & IconProps> = ({ Icon, ...props }) => {
  if (!Icon) {
    return null;
  }

  const Variant = Icon.Color ?? Icon;
  return <Variant {...props} />;
};

function resolveIcon(iconKey?: string | null): LobeIconComponent | undefined {
  const key = iconKey?.trim();
  if (!key) {
    return undefined;
  }

  const value = iconRegistry[key];
  if (!value) {
    return undefined;
  }

  return value as LobeIconComponent;
}

export default function AIIcon({ iconKey, fallbackProvider, size = 18, className, style }: AIIconProps) {
  const Icon = resolveIcon(iconKey);

  if (Icon) {
    return <RenderIcon Icon={Icon} size={size} className={className} style={style} />;
  }

  if (fallbackProvider) {
    return <ProviderIcon provider={fallbackProvider} size={size} className={className} style={style} />;
  }

  return null;
}

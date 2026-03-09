import type { CSSProperties, ComponentType, FC } from 'react';
import { Claude, DeepSeek, Doubao, Gemini, Grok, Hunyuan, Moonshot, OpenAI, Qwen, Spark, Zhipu } from '@lobehub/icons';

type IconProps = {
  size?: string | number;
  className?: string;
  style?: CSSProperties;
};

type LobeIconComponent = ComponentType<any> & {
  Color?: ComponentType<any>;
};

interface ProviderIconProps extends IconProps {
  provider: string;
}

const iconMap: Record<string, LobeIconComponent> = {
  anthropic: Claude,
  claude: Claude,
  deepseek: DeepSeek,
  doubao: Doubao,
  gemini: Gemini,
  grok: Grok,
  hunyuan: Hunyuan,
  kimi: Moonshot,
  moonshot: Moonshot,
  openai: OpenAI,
  spark: Spark,
  xai: Grok,
  zhipuai: Zhipu,
};

const RenderIcon: FC<{ Icon?: LobeIconComponent } & IconProps> = ({ Icon, ...props }) => {
  if (!Icon) {
    return null;
  }

  const Variant = Icon.Color ?? Icon;
  return <Variant {...props} />;
};

export default function ProviderIcon({ provider, size = 18, className, style }: ProviderIconProps) {
  const providerLower = provider.toLowerCase();

  if (providerLower === 'qianwen' || providerLower === 'qwen') {
    return <Qwen size={size} className={className} style={{ color: '#615CED', ...style }} />;
  }

  if (providerLower === 'gpt') {
    return <RenderIcon Icon={OpenAI} size={size} className={className} style={style} />;
  }

  return <RenderIcon Icon={iconMap[providerLower]} size={size} className={className} style={style} />;
}

import React from 'react';
import { NodeProps } from 'reactflow';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import { AIIcon } from '@/components/Icons';

const AINode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  
  // 获取提供商信息
  const getProvider = (): string | null => {
    if (data.config?.provider) {
      return data.config.provider.toLowerCase();
    }
    return null;
  };

  const provider = getProvider();
  
  // 根据是否有 provider 决定使用哪个图标
  const renderIcon = () => {
    if (provider) {
      return <AIIcon iconKey={data.config?.modelIcon || data.config?.providerIcon} fallbackProvider={provider} size={20} />;
    }
    return <RobotOutlined style={{ fontSize: 20 }} />;
  };

  const metaLines = data.config?.model
    ? [`${t('node.labels.model')} ${data.config.model}`]
    : [];

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={renderIcon()}
      color="#722ed1"
      label={t('node.labels.ai')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default AINode;

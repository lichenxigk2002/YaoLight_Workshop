import React from 'react';
import { NodeProps } from 'reactflow';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import { ProviderIcon } from '@/components/Icons/ProviderIcon';
import styles from './AINode.module.scss';

const AINode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  
  // 获取提供商信息
  const getProvider = (): string | null => {
    // 优先从配置中获取 provider
    if (data.config?.provider) {
      return data.config.provider.toLowerCase();
    }
    
    // 如果配置中有 modelName，尝试从模型名称推断
    const modelName = data.config?.modelName || data.config?.model || '';
    if (modelName) {
      const lowerModelName = modelName.toLowerCase();
      if (lowerModelName.includes('deepseek')) {
        return 'deepseek';
      } else if (lowerModelName.includes('doubao') || lowerModelName.includes('seed')) {
        return 'doubao';
      } else if (lowerModelName.includes('qwen')) {
        return 'qianwen';
      } else if (lowerModelName.includes('spark')) {
        return 'spark';
      } else if (lowerModelName.includes('hunyuan')) {
        return 'hunyuan';
      }
    }
    
    return null;
  };

  const provider = getProvider();
  
  // 根据是否有 provider 决定使用哪个图标
  const renderIcon = () => {
    if (provider) {
      return <ProviderIcon provider={provider} size={20} />;
    }
    return <RobotOutlined style={{ fontSize: 20 }} />;
  };

  const renderContent = () => {
    if (data.config?.model) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>{t('node.labels.model')} {data.config.model}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={renderIcon()}
      color="#722ed1"
      label={t('node.labels.ai')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default AINode;


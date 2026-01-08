import React from 'react';
import { NodeProps } from 'reactflow';
import { RobotOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './AINode.module.scss';

const AINode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
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
      icon={<RobotOutlined style={{ fontSize: 20 }} />}
      color="#722ed1"
      label={t('node.labels.ai')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default AINode;


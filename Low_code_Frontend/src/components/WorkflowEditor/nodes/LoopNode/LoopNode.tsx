import React from 'react';
import { NodeProps } from 'reactflow';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './LoopNode.module.scss';

const LoopNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const renderContent = () => {
    if (data.config?.loopType) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>{t('node.labels.type')} {data.config.loopType}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ReloadOutlined style={{ fontSize: 20 }} />}
      color="#eb2f96"
      label={t('node.labels.loop')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default LoopNode;


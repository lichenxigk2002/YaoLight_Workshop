import React from 'react';
import { NodeProps } from 'reactflow';
import { ClearOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './DataCleanNode.module.scss';

const DataCleanNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const renderContent = () => {
    const cleanType = data.config?.cleanType;

    if (cleanType) {
      const cleanTypeLabel = t(`node.labels.cleanTypeLabels.${cleanType}`) || cleanType;
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>
            {t('node.labels.type')} {cleanTypeLabel}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ClearOutlined style={{ fontSize: 20 }} />}
      color="#52c41a"
      label={t('node.labels.dataclean')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default DataCleanNode;


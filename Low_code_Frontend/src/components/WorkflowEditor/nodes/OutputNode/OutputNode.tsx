import React from 'react';
import { NodeProps } from 'reactflow';
import { ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './OutputNode.module.scss';

const OutputNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const renderContent = () => {
    if (data.config?.format) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>{t('node.labels.format')} {data.config.format}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ExportOutlined style={{ fontSize: 20 }} />}
      color="#fa8c16"
      label={t('node.labels.output')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default OutputNode;


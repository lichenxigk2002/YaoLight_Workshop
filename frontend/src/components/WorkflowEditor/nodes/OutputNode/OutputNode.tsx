import React from 'react';
import { NodeProps } from 'reactflow';
import { ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './OutputNode.module.scss';

const OutputNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const isAPIOutput = data.config?.outputMode === 'api_output';
  const renderContent = () => {
    if (data.config?.format || data.config?.destination || data.config?.responsePath || data.config?.outputMode) {
      return (
        <div className={styles.nodeInfo}>
          {data.config?.outputMode ? (
            <div className={styles.nodeInfoItem}>
              模式 {data.config.outputMode}
            </div>
          ) : null}
          {data.config?.format ? (
            <div className={styles.nodeInfoItem}>
              {t('node.labels.format')} {data.config.format}
            </div>
          ) : null}
          {data.config?.destination ? (
            <div className={styles.nodeInfoItem}>
              {t('node.labels.destination') || '目标'} {data.config.destination}
            </div>
          ) : null}
          {data.config?.responsePath ? (
            <div className={styles.nodeInfoItem}>
              response {data.config.responsePath}
            </div>
          ) : null}
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
      label={isAPIOutput ? 'API Output' : t('node.labels.output')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default OutputNode;

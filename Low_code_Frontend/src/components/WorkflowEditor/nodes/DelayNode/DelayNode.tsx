import React from 'react';
import { NodeProps } from 'reactflow';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './DelayNode.module.scss';

const DelayNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const renderContent = () => {
    if (data.config?.seconds) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>{t('node.labels.delayLabel')} {data.config.seconds}{t('node.labels.seconds')}</div>
        </div>
      );
    }
    return null;
  };

  return (
    <BaseNode
      {...props}
      data={{ ...data, renderContent }}
      icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
      color="#fa8c16"
      label={t('node.labels.delay')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default DelayNode;


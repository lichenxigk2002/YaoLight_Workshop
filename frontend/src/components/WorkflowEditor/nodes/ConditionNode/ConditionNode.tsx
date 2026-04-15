import React from 'react';
import { NodeProps } from 'reactflow';
import { BranchesOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';
import styles from './ConditionNode.module.scss';

const ConditionNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const renderContent = () => {
    if (data.config?.field) {
      return (
        <div className={styles.nodeInfo}>
          <div className={styles.nodeInfoItem}>
            {data.config.field} {data.config.operator} {data.config.value}
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
      icon={<BranchesOutlined style={{ fontSize: 20 }} />}
      color="#faad14"
      label={t('node.labels.condition')}
      showInput={true}
      showOutput={true}
      outputCount={2} // 条件节点有两个输出（true/false）
    />
  );
};

export default ConditionNode;


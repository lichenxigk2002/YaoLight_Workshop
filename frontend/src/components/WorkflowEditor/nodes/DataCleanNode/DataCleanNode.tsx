import React from 'react';
import { NodeProps } from 'reactflow';
import { ClearOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const DataCleanNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const cleanType = data.config?.cleanType;
  const cleanTypeLabel = cleanType ? t(`node.labels.cleanTypeLabels.${cleanType}`) || cleanType : null;
  const metaLines = cleanTypeLabel ? [`${t('node.labels.type')} ${cleanTypeLabel}`] : [];

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<ClearOutlined style={{ fontSize: 20 }} />}
      color="#52c41a"
      label={t('node.labels.dataclean')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default DataCleanNode;

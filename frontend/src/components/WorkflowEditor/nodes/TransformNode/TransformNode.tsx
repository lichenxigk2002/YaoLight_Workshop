import React from 'react';
import { NodeProps } from 'reactflow';
import { SwapOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const TransformNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const metaLines = data.config?.transformType
    ? [`${t('node.labels.type')} ${data.config.transformType}`]
    : [];

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<SwapOutlined style={{ fontSize: 20 }} />}
      color="#13c2c2"
      label={t('node.labels.transform')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default TransformNode;

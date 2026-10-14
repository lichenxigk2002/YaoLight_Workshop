import React from 'react';
import { NodeProps } from 'reactflow';
import { ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const LoopNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const metaLines = data.config?.loopType
    ? [`${t('node.labels.type')} ${data.config.loopType}`]
    : [];

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<ReloadOutlined style={{ fontSize: 20 }} />}
      color="#eb2f96"
      label={t('node.labels.loop')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default LoopNode;

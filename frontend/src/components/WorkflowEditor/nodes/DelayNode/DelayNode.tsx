import React from 'react';
import { NodeProps } from 'reactflow';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const DelayNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const metaLines = data.config?.seconds
    ? [`${t('node.labels.delayLabel')} ${data.config.seconds}${t('node.labels.seconds')}`]
    : [];

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<ClockCircleOutlined style={{ fontSize: 20 }} />}
      color="#fa8c16"
      label={t('node.labels.delay')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default DelayNode;

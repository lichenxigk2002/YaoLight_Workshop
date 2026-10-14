import React from 'react';
import { NodeProps } from 'reactflow';
import { ExportOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const OutputNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();
  const isAPIOutput = data.config?.outputMode === 'api_output';
  const metaLines = [
    data.config?.outputMode ? `模式 ${data.config.outputMode}` : null,
    data.config?.format ? `${t('node.labels.format')} ${data.config.format}` : null,
    data.config?.destination ? `${t('node.labels.destination') || '目标'} ${data.config.destination}` : null,
    data.config?.responsePath ? `response ${data.config.responsePath}` : null,
  ].filter(Boolean);

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<ExportOutlined style={{ fontSize: 20 }} />}
      color="#fa8c16"
      label={isAPIOutput ? 'API Output' : t('node.labels.output')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default OutputNode;

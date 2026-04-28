import React from 'react';
import { NodeProps } from 'reactflow';
import { CodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNode from '../BaseNode/BaseNode';

const CodeNode: React.FC<NodeProps> = ({ data, ...props }) => {
  const { t } = useTranslation();

  const metaLines = [
    data.config?.language ? `${t('node.labels.type')} ${data.config.language}` : null,
    data.config?.consoleEnabled !== undefined ? `console ${data.config.consoleEnabled ? 'on' : 'off'}` : null,
  ].filter(Boolean);

  return (
    <BaseNode
      {...props}
      data={{ ...data, metaLines }}
      icon={<CodeOutlined style={{ fontSize: 20 }} />}
      color="#1677ff"
      label={t('node.labels.code')}
      showInput={true}
      showOutput={true}
    />
  );
};

export default CodeNode;

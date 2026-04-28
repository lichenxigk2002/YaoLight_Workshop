import React from 'react';
import { Button, Empty, Modal, Space, Tag, Typography } from 'antd';
import { CodeBlock } from '@/components/CodeBlock';

const { Paragraph, Text } = Typography;

interface CodeRepairModalProps {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  repairResult: {
    fixedSource: string;
    explanation?: string;
    model?: string;
  } | null;
  language: 'javascript' | 'python';
}

export const CodeRepairModal: React.FC<CodeRepairModalProps> = ({
  open,
  onClose,
  onApply,
  repairResult,
  language,
}) => {
  return (
    <Modal
      title="AI 修复建议"
      open={open}
      onCancel={onClose}
      width={860}
      centered
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onClose}>关闭</Button>,
        <Button key="apply" type="primary" onClick={onApply} disabled={!repairResult?.fixedSource}>
          应用修复
        </Button>,
      ]}
    >
      {!repairResult?.fixedSource ? (
        <Empty description="暂无修复结果" />
      ) : (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tag color="processing">AI Repair</Tag>
            {repairResult.model ? <Tag bordered={false}>{repairResult.model}</Tag> : null}
          </div>

          {repairResult.explanation ? (
            <div>
              <Text strong>修复说明</Text>
              <Paragraph style={{ marginTop: 8, marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                {repairResult.explanation}
              </Paragraph>
            </div>
          ) : null}

          <div>
            <Text strong>建议替换代码</Text>
            <div style={{ marginTop: 8 }}>
              <CodeBlock value={repairResult.fixedSource} language={language} defaultExpanded collapsedLines={999} />
            </div>
          </div>
        </Space>
      )}
    </Modal>
  );
};

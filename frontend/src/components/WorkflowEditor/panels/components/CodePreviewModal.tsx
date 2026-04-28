import React from 'react';
import { Empty, Modal, Tabs, Tag, Typography } from 'antd';
import { CodeBlock } from '@/components/CodeBlock';

const { Text } = Typography;

interface CodePreviewModalProps {
  open: boolean;
  onClose: () => void;
  codeTest: {
    previewData: any;
  };
}

export const CodePreviewModal: React.FC<CodePreviewModalProps> = ({
  open,
  onClose,
  codeTest,
}) => {
  if (!codeTest.previewData?.code) {
    return (
      <Modal title="代码节点测试结果" open={open} onCancel={onClose} footer={null} width={760} centered>
        <Empty description="暂无测试数据" />
      </Modal>
    );
  }

  const codeResult = codeTest.previewData.code;
  const data = codeResult.data || {};
  const result = data.result;
  const stdout = Array.isArray(data.stdout) ? data.stdout : [];
  const stderr = Array.isArray(data.stderr) ? data.stderr : [];
  const metrics = data.metrics || {};

  return (
    <Modal
      title="代码节点测试结果"
      open={open}
      onCancel={onClose}
      footer={null}
      width={820}
      centered
      styles={{ body: { paddingTop: 8 } }}
    >
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Tag color={codeResult.success ? 'success' : 'error'}>
          {codeResult.success ? '成功' : '失败'}
        </Tag>
        {metrics.language ? <Tag bordered={false}>language: {metrics.language}</Tag> : null}
        {metrics.durationMs != null ? <Tag bordered={false}>duration: {metrics.durationMs}ms</Tag> : null}
      </div>
      {!codeResult.success && codeResult.error ? (
        <div style={{ marginBottom: 16 }}>
          <Text type="danger">{codeResult.error}</Text>
        </div>
      ) : null}
      <Tabs
        defaultActiveKey="result"
        items={[
          {
            key: 'result',
            label: '返回结果',
            children: <CodeBlock value={result ?? null} language="json" defaultExpanded collapsedLines={999} />,
          },
          {
            key: 'stdout',
            label: `日志 (${stdout.length})`,
            children: stdout.length
              ? <CodeBlock value={stdout.join('\n')} language="text" defaultExpanded collapsedLines={999} />
              : <Empty description="无日志输出" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'stderr',
            label: `错误输出 (${stderr.length})`,
            children: stderr.length
              ? <CodeBlock value={stderr.join('\n')} language="text" defaultExpanded collapsedLines={999} />
              : <Empty description="无错误输出" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          },
          {
            key: 'raw',
            label: '原始结果',
            children: <CodeBlock value={codeTest.previewData.raw} language="json" defaultExpanded collapsedLines={999} />,
          },
        ]}
      />
    </Modal>
  );
};

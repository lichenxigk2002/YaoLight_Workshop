import React, { useState } from 'react';
import { Drawer, Collapse, Badge, Empty, Tag, Typography, Button, Space, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CopyOutlined,
  DownloadOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import styles from './ExecutionResultPanel.module.scss';

const { Panel } = Collapse;
const { Text, Paragraph } = Typography;

interface NodeExecutionResult {
  node_id: string;
  type: string;
  success: boolean;
  data: any;
  error?: string;
}

interface ExecutionResult {
  success: boolean;
  results: NodeExecutionResult[];
  error?: string;
}

interface ExecutionResultPanelProps {
  visible: boolean;
  onClose: () => void;
  result: ExecutionResult | null;
  nodes: any[];
}

const ExecutionResultPanel: React.FC<ExecutionResultPanelProps> = ({
  visible,
  onClose,
  result,
  nodes,
}) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  // 获取节点名称
  const getNodeLabel = (nodeId: string): string => {
    const node = nodes.find((n) => n.id === nodeId);
    return node?.data?.label || nodeId;
  };

  // 获取节点类型中文名
  const getNodeTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      start: '开始',
      crawler: '爬虫',
      dataclean: '数据清洗',
      ai: 'AI处理',
      condition: '条件判断',
      transform: '数据转换',
      loop: '循环',
      merge: '合并',
      delay: '延迟',
      output: '输出',
      end: '结束',
    };
    return labels[type] || type;
  };

  // 复制数据到剪贴板
  const copyToClipboard = (data: any) => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    });
  };

  // 下载数据为JSON文件
  const downloadAsJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 渲染数据预览
  const renderDataPreview = (data: any, nodeType: string) => {
    if (!data) {
      return <Empty description="无数据" image={Empty.SIMPLE_IMAGE} />;
    }

    // 如果是爬虫节点，特殊处理
    if (nodeType === 'crawler') {
      return (
        <div className={styles.dataPreview}>
          <div className={styles.dataStats}>
            {data.count !== undefined && (
              <Tag color="blue">提取项数: {data.count}</Tag>
            )}
            {data.mode && (
              <Tag color="green">模式: {data.mode}</Tag>
            )}
            {data.selector_used && (
              <Tag color="purple">选择器: {data.selector_used}</Tag>
            )}
          </div>
          
          {/* 文本预览 */}
          {data.text && (
            <div className={styles.textPreview}>
              <Text strong>文本内容：</Text>
              <Paragraph ellipsis={{ rows: 5, expandable: true, symbol: '展开' }}>
                {typeof data.text === 'string' ? data.text : JSON.stringify(data.text)}
              </Paragraph>
            </div>
          )}

          {/* 数据列表 */}
          {data.data && Array.isArray(data.data) && (
            <div className={styles.listPreview}>
              <Text strong>提取数据（{data.data.length} 项）：</Text>
              <div className={styles.listItems}>
                {data.data.slice(0, 5).map((item: any, index: number) => (
                  <div key={index} className={styles.listItem}>
                    <Text type="secondary">#{index + 1}</Text>
                    <Paragraph ellipsis={{ rows: 2 }}>
                      {typeof item === 'string' ? item : JSON.stringify(item)}
                    </Paragraph>
                  </div>
                ))}
                {data.data.length > 5 && (
                  <Text type="secondary">... 还有 {data.data.length - 5} 项</Text>
                )}
              </div>
            </div>
          )}

          {/* 链接列表 */}
          {data.links && Array.isArray(data.links) && (
            <div className={styles.linksPreview}>
              <Text strong>链接列表（{data.links.length} 个）：</Text>
              <div className={styles.linkItems}>
                {data.links.slice(0, 10).map((link: any, index: number) => (
                  <div key={index} className={styles.linkItem}>
                    <a href={link.link} target="_blank" rel="noopener noreferrer">
                      {link.text || link.link}
                    </a>
                  </div>
                ))}
                {data.links.length > 10 && (
                  <Text type="secondary">... 还有 {data.links.length - 10} 个链接</Text>
                )}
              </div>
            </div>
          )}

          {/* 图片列表 */}
          {data.images && Array.isArray(data.images) && (
            <div className={styles.imagesPreview}>
              <Text strong>图片列表（{data.images.length} 张）：</Text>
              <div className={styles.imageItems}>
                {data.images.slice(0, 6).map((img: any, index: number) => (
                  <div key={index} className={styles.imageItem}>
                    <img src={img.src} alt={img.alt || `Image ${index + 1}`} />
                    {img.alt && <Text type="secondary">{img.alt}</Text>}
                  </div>
                ))}
                {data.images.length > 6 && (
                  <Text type="secondary">... 还有 {data.images.length - 6} 张图片</Text>
                )}
              </div>
            </div>
          )}
        </div>
      );
    }

    // 数据清洗节点
    if (nodeType === 'dataclean') {
      return (
        <div className={styles.dataPreview}>
          {/* 显示清洗后的数据 */}
          {typeof data === 'string' ? (
            <Paragraph ellipsis={{ rows: 10, expandable: true, symbol: '展开' }}>
              {data}
            </Paragraph>
          ) : (
            <pre className={styles.jsonDisplay}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
        </div>
      );
    }

    // 其他节点，使用代码块展示JSON
    return (
      <pre className={styles.jsonDisplay}>
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  if (!result) {
    return null;
  }

  return (
    <Drawer
      title={
        <Space>
          <span>执行结果</span>
          {result.success ? (
            <Badge status="success" text="成功" />
          ) : (
            <Badge status="error" text="失败" />
          )}
        </Space>
      }
      placement="right"
      width={700}
      onClose={onClose}
      open={visible}
      className={styles.resultDrawer}
    >
      {result.results.length === 0 ? (
        <Empty description="暂无执行结果" />
      ) : (
        <Collapse
          activeKey={activeKeys}
          onChange={(keys) => setActiveKeys(keys as string[])}
          className={styles.resultCollapse}
        >
          {result.results.map((nodeResult, index) => (
            <Panel
              key={nodeResult.node_id}
              header={
                <div className={styles.panelHeader}>
                  <Space>
                    {nodeResult.success ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : (
                      <CloseCircleOutlined style={{ color: '#f5222d' }} />
                    )}
                    <span className={styles.nodeLabel}>
                      {getNodeLabel(nodeResult.node_id)}
                    </span>
                    <Tag color={nodeResult.success ? 'success' : 'error'}>
                      {getNodeTypeLabel(nodeResult.type)}
                    </Tag>
                  </Space>
                </div>
              }
              extra={
                <Space onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => {
                      if (activeKeys.includes(nodeResult.node_id)) {
                        setActiveKeys(activeKeys.filter((k) => k !== nodeResult.node_id));
                      } else {
                        setActiveKeys([...activeKeys, nodeResult.node_id]);
                      }
                    }}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(nodeResult.data)}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DownloadOutlined />}
                    onClick={() =>
                      downloadAsJson(
                        nodeResult.data,
                        `${getNodeLabel(nodeResult.node_id)}_result.json`
                      )
                    }
                  />
                </Space>
              }
            >
              {nodeResult.success ? (
                renderDataPreview(nodeResult.data, nodeResult.type)
              ) : (
                <div className={styles.errorMessage}>
                  <Text type="danger">{nodeResult.error || '执行失败'}</Text>
                </div>
              )}
            </Panel>
          ))}
        </Collapse>
      )}
    </Drawer>
  );
};

export default ExecutionResultPanel;


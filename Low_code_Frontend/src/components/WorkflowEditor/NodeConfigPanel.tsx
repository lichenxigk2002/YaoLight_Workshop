import React, { useEffect } from 'react';
import { Drawer, Form, Input, Button, Select, Switch, message, Tag, Space } from 'antd';
import { Node } from 'reactflow';
import { getNodeInputFormats, getNodeOutputFormat, nodeFormats } from './nodeFormats';

const { Option } = Select;
const { TextArea } = Input;

interface NodeConfigPanelProps {
  visible: boolean;
  node: Node | null;
  onClose: () => void;
  onSave: (nodeId: string, config: any) => void;
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  visible,
  node,
  onClose,
  onSave,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (node) {
      // 填充表单数据
      form.setFieldsValue({
        label: node.data.label || '',
        connectionDirection: node.data.connectionDirection || 'vertical',
        ...node.data.config,
      });
    }
  }, [node, form]);

  const handleSave = () => {
    form
      .validateFields()
      .then((values) => {
        if (node) {
          const config = { ...values };
          delete config.label; // label不是config的一部分
          delete config.connectionDirection; // connectionDirection不是config的一部分

          onSave(node.id, {
            label: values.label,
            connectionDirection: values.connectionDirection || 'vertical',
            config: config,
          });
          message.success('配置已保存');
          onClose();
        }
      })
      .catch((error) => {
        console.error('表单验证失败:', error);
      });
  };

  const renderConditionConfig = () => (
    <>
      <Form.Item
        label="条件类型"
        name="conditionType"
        initialValue="equals"
      >
        <Select>
          <Option value="equals">等于</Option>
          <Option value="contains">包含</Option>
          <Option value="greater">大于</Option>
          <Option value="less">小于</Option>
          <Option value="regex">正则匹配</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="字段名"
        name="field"
        rules={[{ required: true, message: '请输入字段名' }]}
        tooltip="要判断的数据字段，如：data.count"
      >
        <Input placeholder="data.count" />
      </Form.Item>
      <Form.Item
        label="操作符"
        name="operator"
        initialValue="=="
      >
        <Select>
          <Option value="==">等于 (==)</Option>
          <Option value="!=">不等于 (!=)</Option>
          <Option value=">">大于 (&gt;)</Option>
          <Option value="<">小于 (&lt;)</Option>
          <Option value=">=">大于等于 (&gt;=)</Option>
          <Option value="<=">小于等于 (&lt;=)</Option>
          <Option value="contains">包含</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="比较值"
        name="value"
        rules={[{ required: true, message: '请输入比较值' }]}
      >
        <Input placeholder="100" />
      </Form.Item>
    </>
  );

  const renderTransformConfig = () => (
    <>
      <Form.Item
        label="转换类型"
        name="transformType"
        initialValue="map"
      >
        <Select>
          <Option value="map">映射</Option>
          <Option value="filter">过滤</Option>
          <Option value="sort">排序</Option>
          <Option value="group">分组</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="转换脚本"
        name="script"
        tooltip="JavaScript表达式，如：item * 2"
      >
        <TextArea rows={3} placeholder="item * 2" />
      </Form.Item>
    </>
  );

  const renderLoopConfig = () => (
    <>
      <Form.Item
        label="循环类型"
        name="loopType"
        initialValue="foreach"
      >
        <Select>
          <Option value="foreach">遍历数组</Option>
          <Option value="while">条件循环</Option>
          <Option value="for">计数循环</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="数据源"
        name="items"
        tooltip="要遍历的数据，如：data.items"
      >
        <Input placeholder="data.items" />
      </Form.Item>
      <Form.Item
        label="循环条件（while类型）"
        name="condition"
      >
        <Input placeholder="data.count < 10" />
      </Form.Item>
    </>
  );

  const renderDelayConfig = () => (
    <>
      <Form.Item
        label="延迟类型"
        name="delayType"
        initialValue="fixed"
      >
        <Select>
          <Option value="fixed">固定延迟</Option>
          <Option value="random">随机延迟</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="延迟时间（秒）"
        name="seconds"
        initialValue={1}
        rules={[{ required: true, message: '请输入延迟时间' }]}
      >
        <Input type="number" min={0} max={3600} />
      </Form.Item>
    </>
  );

  const renderDataCleanConfig = () => (
    <>
      <Form.Item
        label="清洗类型"
        name="cleanType"
        initialValue="html"
        tooltip="选择预设的清洗类型，或选择自定义"
      >
        <Select>
          <Option value="html">清洗HTML（移除标签）</Option>
          <Option value="text">清洗文本（去空格换行）</Option>
          <Option value="email">提取邮箱地址</Option>
          <Option value="url">提取URL链接</Option>
          <Option value="phone">提取电话号码</Option>
          <Option value="number">提取数字</Option>
          <Option value="date">提取日期</Option>
          <Option value="custom">自定义清洗</Option>
        </Select>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues?.cleanType !== currentValues?.cleanType}
      >
        {({ getFieldValue }) => {
          const cleanType = getFieldValue('cleanType');
          if (cleanType === 'custom') {
            return (
              <>
                <Form.Item
                  label="移除HTML标签"
                  name="removeHTML"
                  initialValue={false}
                  valuePropName="checked"
                  tooltip="移除所有HTML标签，保留纯文本"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="去除首尾空白"
                  name="trim"
                  initialValue={true}
                  valuePropName="checked"
                  tooltip="移除文本开头和结尾的空格、换行等空白字符"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="移除多余空格"
                  name="removeSpaces"
                  initialValue={false}
                  valuePropName="checked"
                  tooltip="将连续的多个空格替换为单个空格"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="转小写"
                  name="toLowerCase"
                  initialValue={false}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="转大写"
                  name="toUpperCase"
                  initialValue={false}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label="去重"
                  name="deduplicate"
                  initialValue={false}
                  valuePropName="checked"
                  tooltip="如果输入是数组，移除重复项"
                >
                  <Switch />
                </Form.Item>
              </>
            );
          }
          return null;
        }}
      </Form.Item>
    </>
  );

  const renderCrawlerConfig = () => (
    <>
      <Form.Item
        label="网页地址"
        name="url"
        rules={[{ required: true, message: '请输入网页地址' }]}
        tooltip="要爬取的网页地址，例如：https://www.example.com"
      >
        <Input placeholder="https://www.example.com" />
      </Form.Item>
      <Form.Item
        label="网页类型"
        name="useHeadless"
        initialValue={false}
        valuePropName="checked"
        tooltip="如果是SPA单页应用（如React/Vue/Angular），请开启"
      >
        <Switch
          checkedChildren="SPA应用"
          unCheckedChildren="普通网页"
        />
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues?.useHeadless !== currentValues?.useHeadless}
      >
        {({ getFieldValue }) => {
          const useHeadless = getFieldValue('useHeadless');
          if (useHeadless) {
            return (
              <>
                <Form.Item
                  label="等待时间（秒）"
                  name="javascriptWait"
                  initialValue={3}
                  tooltip="等待JavaScript执行的时间，建议3-10秒"
                >
                  <Input type="number" min={1} max={30} />
                </Form.Item>
                <Form.Item
                  label="等待元素出现"
                  name="waitForSelector"
                  tooltip="选填：等待特定元素加载完成，例如：.content 或 #app"
                >
                  <Input placeholder="例如: .content 或 #app" />
                </Form.Item>
              </>
            );
          }
          return null;
        }}
      </Form.Item>
      <Form.Item
        label="提取模式"
        name="extractMode"
        initialValue="smart"
        tooltip="推荐使用智能模式，系统会自动提取页面主要内容"
      >
        <Select>
          <Option value="smart">🤖 智能提取（推荐）</Option>
          <Option value="article">📄 文章内容</Option>
          <Option value="list">📋 列表项</Option>
          <Option value="links">🔗 所有链接</Option>
          <Option value="images">🖼️ 所有图片</Option>
        </Select>
      </Form.Item>
    </>
  );

  const renderAIConfig = () => (
    <>
      <Form.Item
        label="AI模型"
        name="model"
        rules={[{ required: true, message: '请选择AI模型' }]}
      >
        <Input placeholder="gpt-3.5-turbo" />
      </Form.Item>
      <Form.Item
        label="提示词"
        name="prompt"
        rules={[{ required: true, message: '请输入提示词' }]}
      >
        <TextArea rows={4} placeholder="输入你的提示词..." />
      </Form.Item>
      <Form.Item
        label="温度"
        name="temperature"
        initialValue={0.7}
        tooltip="控制输出的随机性，0-1之间"
      >
        <Input type="number" min={0} max={1} step={0.1} />
      </Form.Item>
    </>
  );

  const renderOutputConfig = () => (
    <>
      <Form.Item
        label="输出格式"
        name="format"
        initialValue="json"
      >
        <Select>
          <Option value="json">JSON</Option>
          <Option value="csv">CSV</Option>
          <Option value="txt">TXT</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="输出目标"
        name="destination"
        initialValue="file"
      >
        <Select>
          <Option value="file">文件</Option>
          <Option value="database">数据库</Option>
          <Option value="api">API</Option>
        </Select>
      </Form.Item>
    </>
  );

  const renderConfigForm = () => {
    if (!node) return null;

    const nodeType = node.data.type || node.type;

    switch (nodeType) {
      case 'start':
        return <div>开始节点无需配置</div>;
      case 'crawler':
        return renderCrawlerConfig();
      case 'dataclean':
        return renderDataCleanConfig();
      case 'ai':
        return renderAIConfig();
      case 'condition':
        return renderConditionConfig();
      case 'transform':
        return renderTransformConfig();
      case 'loop':
        return renderLoopConfig();
      case 'merge':
        return <div>合并节点自动合并所有输入数据</div>;
      case 'delay':
        return renderDelayConfig();
      case 'output':
        return renderOutputConfig();
      case 'end':
        return <div>结束节点无需配置</div>;
      default:
        return <div>未知节点类型</div>;
    }
  };

  if (!node) return null;

  // 获取节点格式信息
  const nodeType = node.data.type || node.type;
  const inputFormats = getNodeInputFormats(nodeType);
  const outputFormat = getNodeOutputFormat(nodeType);
  const formatInfo = nodeFormats[nodeType];

  // 格式化标签显示
  const formatLabels: Record<string, string> = {
    any: '任意',
    json: 'JSON',
    array: '数组',
    text: '文本',
    html: 'HTML',
    url: 'URL',
    number: '数字',
    boolean: '布尔值',
    null: '无',
  };

  return (
    <Drawer
      title={`配置节点: ${node.data.label || node.id}`}
      placement="right"
      width={400}
      onClose={onClose}
      open={visible}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Button onClick={onClose} style={{ marginRight: 8 }}>
            取消
          </Button>
          <Button type="primary" onClick={handleSave}>
            保存
          </Button>
        </div>
      }
    >
      {/* 数据格式信息 */}
      <div style={{
        marginBottom: 16,
        padding: 12,
        background: '#f5f5f5',
        borderRadius: 4,
        fontSize: 12
      }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>数据格式</div>
        <div style={{ marginBottom: 4 }}>
          <span style={{ color: '#666' }}>输入格式：</span>
          <Space size={4} wrap>
            {inputFormats.map((format) => (
              <Tag key={format} color="blue" style={{ margin: 0 }}>
                {formatLabels[format] || format}
              </Tag>
            ))}
          </Space>
        </div>
        <div>
          <span style={{ color: '#666' }}>输出格式：</span>
          <Tag color="green" style={{ margin: 0 }}>
            {formatLabels[outputFormat] || outputFormat}
          </Tag>
        </div>
        {formatInfo?.description && (
          <div style={{ marginTop: 8, color: '#999', fontSize: 11 }}>
            {formatInfo.description}
          </div>
        )}
      </div>

      <Form form={form} layout="vertical">
        <Form.Item
          label="节点名称"
          name="label"
          rules={[{ required: true, message: '请输入节点名称' }]}
        >
          <Input />
        </Form.Item>
        {renderConfigForm()}
      </Form>
    </Drawer>
  );
};

export default NodeConfigPanel;


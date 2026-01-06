import React, { useEffect } from 'react';
import { Drawer, Form, Input, Button, Select, Switch, message } from 'antd';
import { Node } from 'reactflow';

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

  const renderCrawlerConfig = () => (
    <>
      <Form.Item
        label="URL"
        name="url"
        rules={[{ required: true, message: '请输入URL' }]}
        tooltip="要爬取的网页地址"
      >
        <Input placeholder="https://example.com" />
      </Form.Item>
      <Form.Item
        label="提取模式"
        name="extractMode"
        initialValue="smart"
        tooltip="选择提取模式，智能模式会自动检测页面主要内容，无需填写选择器"
      >
        <Select>
          <Option value="smart">智能模式（自动检测）</Option>
          <Option value="article">文章内容</Option>
          <Option value="list">列表项</Option>
          <Option value="links">所有链接</Option>
          <Option value="images">所有图片</Option>
          <Option value="custom">自定义选择器（高级）</Option>
        </Select>
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues?.extractMode !== currentValues?.extractMode}
      >
        {({ getFieldValue }) => {
          const extractMode = getFieldValue('extractMode');
          if (extractMode === 'custom') {
            return (
              <Form.Item
                label="选择器（高级）"
                name="selector"
                tooltip="CSS选择器，用于精确提取数据。示例：.title（类名）、#content（ID）、h1（标签）"
              >
                <Input placeholder=".content 或 #main 或 h1.title" />
              </Form.Item>
            );
          }
          return null;
        }}
      </Form.Item>
      <Form.Item
        label="请求方法"
        name="method"
        initialValue="GET"
      >
        <Select>
          <Option value="GET">GET</Option>
          <Option value="POST">POST</Option>
          <Option value="PUT">PUT</Option>
          <Option value="DELETE">DELETE</Option>
        </Select>
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues?.extractMode !== currentValues?.extractMode}
      >
        {({ getFieldValue }) => {
          const extractMode = getFieldValue('extractMode');
          if (extractMode === 'custom') {
            return (
              <>
                <Form.Item
                  label="提取类型"
                  name="extractType"
                  initialValue="text"
                  tooltip="选择要提取的内容类型（仅自定义模式）"
                >
                  <Select>
                    <Option value="text">文本内容</Option>
                    <Option value="html">HTML内容</Option>
                    <Option value="attr">属性值</Option>
                    <Option value="link">链接（href）</Option>
                    <Option value="image">图片（src）</Option>
                    <Option value="all">全部信息</Option>
                  </Select>
                </Form.Item>
                <Form.Item
                  label="属性名（提取类型为属性时）"
                  name="extractAttr"
                  tooltip="当提取类型选择'属性值'时，指定要提取的属性名，如：href、src、data-id"
                >
                  <Input placeholder="href 或 src 或 data-id" />
                </Form.Item>
              </>
            );
          }
          return null;
        }}
      </Form.Item>
      <Form.Item
        label="User-Agent"
        name="userAgent"
        tooltip="浏览器标识，留空则使用随机User-Agent"
      >
        <Input placeholder="留空使用随机User-Agent" />
      </Form.Item>
      <Form.Item
        label="超时时间（秒）"
        name="timeout"
        initialValue={30}
        tooltip="请求超时时间，建议30-60秒"
      >
        <Input type="number" min={1} max={300} />
      </Form.Item>
      <Form.Item
        label="请求体（POST/PUT时）"
        name="body"
        tooltip="POST或PUT请求时的请求体内容，JSON格式"
      >
        <TextArea rows={3} placeholder='{"key": "value"}' />
      </Form.Item>
      <Form.Item
        label="请求体类型"
        name="bodyType"
        initialValue="json"
        tooltip="请求体的内容类型"
      >
        <Select>
          <Option value="json">JSON</Option>
          <Option value="form">Form表单</Option>
          <Option value="xml">XML</Option>
          <Option value="text">文本</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="页面编码"
        name="encoding"
        initialValue="auto"
        tooltip="页面编码，auto为自动检测"
      >
        <Select>
          <Option value="auto">自动检测</Option>
          <Option value="utf-8">UTF-8</Option>
          <Option value="gbk">GBK</Option>
          <Option value="gb2312">GB2312</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="重试次数"
        name="retryCount"
        initialValue={3}
        tooltip="请求失败时的重试次数"
      >
        <Input type="number" min={0} max={10} />
      </Form.Item>
      <Form.Item
        label="重试延迟（秒）"
        name="retryDelay"
        initialValue={1}
        tooltip="重试前等待的时间"
      >
        <Input type="number" min={0} max={60} />
      </Form.Item>
      <Form.Item
        label="JavaScript等待时间（秒）"
        name="javascriptWait"
        initialValue={5}
        tooltip="如果网站使用JavaScript动态加载内容，设置等待时间让内容加载完成。建议3-10秒"
      >
        <Input type="number" min={0} max={30} />
      </Form.Item>
      <Form.Item
        label="请求后等待（秒）"
        name="waitTime"
        initialValue={0}
        tooltip="请求完成后等待的时间，用于避免请求过快"
      >
        <Input type="number" min={0} max={60} />
      </Form.Item>
      <Form.Item
        label="代理地址"
        name="proxy"
        tooltip="代理服务器地址，格式：http://proxy:port 或 https://proxy:port"
      >
        <Input placeholder="http://127.0.0.1:8080" />
      </Form.Item>
      <Form.Item
        label="跟随重定向"
        name="followRedirect"
        initialValue={true}
        valuePropName="checked"
        tooltip="是否自动跟随HTTP重定向"
      >
        <Switch />
      </Form.Item>
      <Form.Item
        label="验证SSL证书"
        name="verifySSL"
        initialValue={true}
        valuePropName="checked"
        tooltip="是否验证SSL证书（某些网站可能需要关闭）"
      >
        <Switch />
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


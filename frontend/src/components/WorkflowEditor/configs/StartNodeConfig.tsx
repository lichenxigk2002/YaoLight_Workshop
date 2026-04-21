import React from 'react';
import { Button, Form, Input, Select, Space, Typography } from 'antd';
import { FileTextOutlined, LinkOutlined, CodeOutlined, ApiOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Node } from 'reactflow';
import { JsonCodeEditor } from '../utils/JsonCodeEditor';
import { StartTooltips } from '../utils/configTooltips';

const { Option } = Select;
const { TextArea } = Input;
const { Text } = Typography;

const API_MOCK_INPUT = JSON.stringify({
  keyword: '百度热搜',
  limit: 10,
  source: 'apifox',
}, null, 2);

interface StartNodeConfigProps {
  node: Node | null;
}

export const StartNodeConfig: React.FC<StartNodeConfigProps> = () => {
  return (
    <>
      <Form.Item
        label="入口模式"
        name="inputMode"
        initialValue="manual"
        tooltip="手动模式用于站内执行；API 输入模式用于发布 Workflow API 时作为对外入口。"
      >
        <Select>
          <Option value="manual">
            <Space>
              <PlayCircleOutlined />
              <span>手动运行入口</span>
            </Space>
          </Option>
          <Option value="api_input">
            <Space>
              <ApiOutlined />
              <span>API 输入入口</span>
            </Space>
          </Option>
        </Select>
      </Form.Item>
      <Form.Item
        label="输入格式"
        name="inputDataType"
        initialValue="text"
        tooltip="选择输入数据的格式，系统会根据格式显示对应的输入编辑器"
      >
        <Select>
          <Option value="text">
            <Space>
              <FileTextOutlined />
              <span>文本</span>
            </Space>
          </Option>
          <Option value="json">
            <Space>
              <CodeOutlined />
              <span>JSON对象</span>
            </Space>
          </Option>
          <Option value="url">
            <Space>
              <LinkOutlined />
              <span>URL地址</span>
            </Space>
          </Option>
          <Option value="number">
            <Space>
              <span>数字</span>
            </Space>
          </Option>
          <Option value="auto">自动检测</Option>
        </Select>
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) =>
          prevValues?.inputDataType !== currentValues?.inputDataType ||
          prevValues?.inputData !== currentValues?.inputData ||
          prevValues?.inputMode !== currentValues?.inputMode
        }
      >
        {({ getFieldValue, setFieldsValue }) => {
          const inputDataType = getFieldValue('inputDataType') || 'text';
          const inputData = getFieldValue('inputData') || '';
          const inputMode = getFieldValue('inputMode') || 'manual';
          const isAPIInput = inputMode === 'api_input';

          return (
            <>
              {isAPIInput ? (
                <div
                  style={{
                    marginBottom: 12,
                    padding: '12px 14px',
                    border: '1px solid var(--border-secondary)',
                    borderRadius: 14,
                    background: 'var(--bg-secondary)',
                  }}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Text strong>模拟 API 输入</Text>
                    <Text type="secondary">
                      这里填写的数据会模拟外部请求体里的 input，用于站内调试、变量选择和默认文档示例。真实 API 调用时，请求传入的 input 会覆盖这份模拟数据。
                    </Text>
                    <Button
                      size="small"
                      icon={<CodeOutlined />}
                      onClick={() => setFieldsValue({ inputDataType: 'json', inputData: API_MOCK_INPUT })}
                    >
                      填入模拟 JSON
                    </Button>
                  </Space>
                </div>
              ) : null}
              <Form.Item
                label={isAPIInput ? '模拟请求数据' : '输入数据'}
                name="inputData"
                tooltip={StartTooltips.inputData}
              >
                {inputDataType === 'json' ? (
                  <JsonCodeEditor
                    value={inputData}
                    placeholder={isAPIInput
                      ? '模拟外部 API 请求的 input，例如：\n{\n  "keyword": "百度热搜",\n  "limit": 10\n}'
                      : '输入JSON数据，例如：\n{\n  "url": "https://baidu.com",\n  "name": "百度"\n}'}
                    rows={10}
                  />
                ) : inputDataType === 'url' ? (
                  <Input
                    placeholder={isAPIInput ? '模拟请求中的 URL，例如：https://www.baidu.com' : '输入URL地址，例如：https://www.baidu.com'}
                    prefix={<LinkOutlined />}
                  />
                ) : inputDataType === 'number' ? (
                  <Input
                    type="number"
                    placeholder={isAPIInput ? '模拟请求中的数字，例如：10' : '输入数字，例如：123'}
                  />
                ) : (
                  <TextArea
                    rows={4}
                    placeholder={isAPIInput ? '模拟请求中的文本，例如：百度热搜' : '输入文本数据，例如：百度'}
                  />
                )}
              </Form.Item>
            </>
          );
        }}
      </Form.Item>
    </>
  );
};

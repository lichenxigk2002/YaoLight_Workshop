import React from 'react';
import { Form, Input, Select, Space } from 'antd';
import { FileTextOutlined, LinkOutlined, CodeOutlined } from '@ant-design/icons';
import { Node } from 'reactflow';
import { JsonCodeEditor } from '../utils/JsonCodeEditor';
import { StartTooltips } from '../utils/configTooltips';

const { Option } = Select;
const { TextArea } = Input;

interface StartNodeConfigProps {
  node: Node | null;
}

export const StartNodeConfig: React.FC<StartNodeConfigProps> = ({ node }) => {
  return (
    <>
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
          prevValues?.inputData !== currentValues?.inputData
        }
      >
        {({ getFieldValue }) => {
          const inputDataType = getFieldValue('inputDataType') || 'text';
          const inputData = getFieldValue('inputData') || '';

          return (
            <Form.Item
              label="输入数据"
              name="inputData"
              tooltip={StartTooltips.inputData}
            >
              {inputDataType === 'json' ? (
                <JsonCodeEditor
                  value={inputData}
                  placeholder='输入JSON数据，例如：\n{\n  "url": "https://baidu.com",\n  "name": "百度"\n}'
                  rows={10}
                />
              ) : inputDataType === 'url' ? (
                <Input
                  placeholder="输入URL地址，例如：https://www.baidu.com"
                  prefix={<LinkOutlined />}
                />
              ) : inputDataType === 'number' ? (
                <Input
                  type="number"
                  placeholder="输入数字，例如：123"
                />
              ) : (
                <TextArea
                  rows={4}
                  placeholder='输入文本数据，例如：百度'
                />
              )}
            </Form.Item>
          );
        }}
      </Form.Item>
    </>
  );
};


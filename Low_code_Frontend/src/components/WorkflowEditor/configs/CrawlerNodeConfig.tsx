import React from 'react';
import { Form, Input, Select, Switch, Row, Col, Space } from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  CodeOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Node, Edge } from 'reactflow';
import { VariableSelectField } from '../variables';
import { CrawlerTooltips } from '../utils/configTooltips';
import { jsonValidatorRule } from '../extensions/jsonValidator';

const { Option } = Select;
const { TextArea } = Input;

interface CrawlerNodeConfigProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  executionResult?: any;
}

export const CrawlerNodeConfig: React.FC<CrawlerNodeConfigProps> = ({
  node,
  nodes,
  edges,
  executionResult,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        noStyle
        shouldUpdate={(prevValues, currentValues) => prevValues?.urlVariable !== currentValues?.urlVariable}
      >
        {({ getFieldValue }) => {
          const urlVariable = getFieldValue('urlVariable');
          return (
            <Form.Item
              label={t('node.config.crawler.url')}
              name="url"
              rules={[
                {
                  required: !urlVariable,
                  message: urlVariable ? '已选择URL变量，URL字段可选' : t('node.config.crawler.urlRequired'),
                },
              ]}
              tooltip={
                urlVariable
                  ? '已选择URL变量，此字段可选。如果填写，变量优先。'
                  : t('node.config.crawler.urlTooltip')
              }
            >
              <Input placeholder="https://www.example.com" disabled={!!urlVariable} />
            </Form.Item>
          );
        }}
      </Form.Item>
      <Form.Item
        label="URL变量"
        name="urlVariable"
        tooltip={CrawlerTooltips.urlVariable}
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="点击选择：使用上游节点的数据作为网址（可选）"
          executionResult={executionResult}
        />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item
            label={t('node.config.crawler.pageType')}
            name="useHeadless"
            initialValue={false}
            valuePropName="checked"
            tooltip={CrawlerTooltips.pageType(t)}
          >
            <Switch
              checkedChildren={t('node.config.crawler.spaApp')}
              unCheckedChildren={t('node.config.crawler.normalPage')}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item
            label={t('node.config.crawler.advanced')}
            name="useAdvanced"
            initialValue={false}
            valuePropName="checked"
            tooltip={t('node.config.crawler.advancedTooltip')}
          >
            <Switch checkedChildren={t('node.config.crawler.enable')} unCheckedChildren={t('node.config.crawler.disable')} />
          </Form.Item>
        </Col>
      </Row>
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
                  label={t('node.config.crawler.waitTime')}
                  name="javascriptWait"
                  initialValue={3}
                  tooltip={t('node.config.crawler.waitTimeTooltip')}
                >
                  <Input type="number" min={1} max={30} />
                </Form.Item>
                <Form.Item
                  label={t('node.config.crawler.waitForSelector')}
                  name="waitForSelector"
                  tooltip={CrawlerTooltips.waitForSelector(t)}
                >
                  <Input placeholder="article, .content, #app" />
                </Form.Item>
              </>
            );
          }
          return null;
        }}
      </Form.Item>
      <Form.Item
        label={t('node.config.crawler.extractMode')}
        name="extractMode"
        initialValue="smart"
        tooltip={t('node.config.crawler.extractModeTooltip')}
      >
        <Select>
          <Option value="smart">
            <Space>
              <RobotOutlined />
              <span>{t('node.config.crawler.smartExtract')}</span>
            </Space>
          </Option>
          <Option value="article">
            <Space>
              <FileTextOutlined />
              <span>{t('node.config.crawler.article')}</span>
            </Space>
          </Option>
          <Option value="list">
            <Space>
              <UnorderedListOutlined />
              <span>{t('node.config.crawler.list')}</span>
            </Space>
          </Option>
          <Option value="links">
            <Space>
              <LinkOutlined />
              <span>{t('node.config.crawler.links')}</span>
            </Space>
          </Option>
          <Option value="images">
            <Space>
              <PictureOutlined />
              <span>{t('node.config.crawler.images')}</span>
            </Space>
          </Option>
          <Option value="custom">
            <Space>
              <CodeOutlined />
              <span>{t('node.config.crawler.customSelector')}</span>
            </Space>
          </Option>
        </Select>
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prev, curr) => prev?.extractMode !== curr?.extractMode}
      >
        {({ getFieldValue }) => {
          const mode = getFieldValue('extractMode');
          if (mode === 'custom') {
            return (
              <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '4px', marginBottom: '24px', border: '1px solid var(--border-secondary)' }}>
                <Form.Item
                  label={t('node.config.crawler.cssSelector')}
                  name="selector"
                  rules={[{ required: true, message: t('node.config.crawler.cssSelectorRequired') }]}
                  tooltip={t('node.config.crawler.cssSelectorTooltip')}
                  style={{ marginBottom: 12 }}
                >
                  <Input placeholder=".class-name or #id" />
                </Form.Item>
                <Form.Item
                  label={t('node.config.crawler.extractType')}
                  name="extractType"
                  initialValue="text"
                  tooltip={t('node.config.crawler.extractTypeTooltip')}
                  style={{ marginBottom: 0 }}
                >
                  <Select>
                    <Option value="text">{t('node.config.crawler.text')}</Option>
                    <Option value="html">{t('node.config.crawler.htmlContent')}</Option>
                    <Option value="link">{t('node.config.crawler.linkAddress')}</Option>
                    <Option value="image">{t('node.config.crawler.imageAddress')}</Option>
                    <Option value="attr">{t('node.config.crawler.customAttr')}</Option>
                  </Select>
                </Form.Item>

                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) => prev?.extractType !== curr?.extractType}
                >
                  {({ getFieldValue }) => {
                    return getFieldValue('extractType') === 'attr' ? (
                      <Form.Item
                        label={t('node.config.crawler.attrName')}
                        name="extractAttr"
                        rules={[{ required: true, message: t('node.config.crawler.attrNameRequired') }]}
                        style={{ marginTop: 12, marginBottom: 0 }}
                      >
                        <Input placeholder="data-id" />
                      </Form.Item>
                    ) : null;
                  }}
                </Form.Item>
              </div>
            );
          }
          return null;
        }}
      </Form.Item>

      <Form.Item
        noStyle
        shouldUpdate={(prev, curr) => prev?.useAdvanced !== curr?.useAdvanced}
      >
        {({ getFieldValue }) => {
          const useAdvanced = getFieldValue('useAdvanced');
          if (!useAdvanced) return null;
          return (
            <div style={{ marginBottom: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 4, border: '1px solid var(--border-secondary)' }}>
              <div style={{ marginBottom: 16, fontWeight: 500 }}>{t('node.config.crawler.advancedRequestConfig')}</div>
              <Form.Item
                label={t('node.config.crawler.headers')}
                name="headers"
                tooltip={CrawlerTooltips.headers(t)}
                rules={[jsonValidatorRule(t('node.config.crawler.headersInvalid'))]}
              >
                <TextArea
                  autoSize={{ minRows: 1, maxRows: 6 }}
                  placeholder='{"User-Agent": "Mozilla/5.0...", "Authorization": "Bearer {{token}}"}'
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>
              <Form.Item
                label={t('node.config.crawler.cookies')}
                name="cookies"
                tooltip={t('node.config.crawler.cookiesTooltip')}
                rules={[jsonValidatorRule(t('node.config.crawler.cookiesInvalid'))]}
              >
                <TextArea
                  autoSize={{ minRows: 1, maxRows: 6 }}
                  placeholder='{"session_id": "xyz"}'
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </Form.Item>
              <Form.Item
                label={t('node.config.crawler.timeout')}
                name="timeout"
                initialValue={30}
              >
                <Input type="number" min={1} step={1} />
              </Form.Item>
              <Form.Item
                label={t('node.config.crawler.proxy')}
                name="proxy"
                tooltip={t('node.config.crawler.proxyTooltip')}
              >
                <Input placeholder="http://127.0.0.1:7890" />
              </Form.Item>
              <Form.Item
                label={t('node.config.crawler.retryCount')}
                name="retryCount"
                initialValue={3}
              >
                <Input type="number" min={0} max={10} />
              </Form.Item>
            </div>
          );
        }}
      </Form.Item>

      <Form.Item
        label={t('node.config.crawler.testCleanEnable')}
        name="testCleanEnable"
        valuePropName="checked"
        initialValue={false}
        tooltip={t('node.config.crawler.testCleanTooltip')}
      >
        <Switch />
      </Form.Item>
      <Form.Item
        noStyle
        shouldUpdate={(prev, curr) => prev?.testCleanEnable !== curr?.testCleanEnable}
      >
        {({ getFieldValue }) => {
          const enable = getFieldValue('testCleanEnable');
          if (!enable) return null;
          return (
            <>
              <Form.Item
                label={t('node.config.crawler.testCleanRemoveHTML')}
                name="testCleanRemoveHTML"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>
              <Form.Item
                label={t('node.config.crawler.testCleanTrim')}
                name="testCleanTrim"
                valuePropName="checked"
                initialValue={true}
              >
                <Switch />
              </Form.Item>
            </>
          );
        }}
      </Form.Item>
    </>
  );
};


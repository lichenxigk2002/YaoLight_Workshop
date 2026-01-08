import React, { useEffect, useRef } from 'react';
import { Form, Input, Button, Select, Switch, message, Tag, Space, Modal, Tabs, Typography, Collapse, Image, Empty, Row, Col } from 'antd';
import {
  RobotOutlined,
  FileTextOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  CodeOutlined,
  PictureOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { Node, Edge } from 'reactflow';
import { getNodeInputFormats, getNodeOutputFormat, nodeFormats } from './nodeFormats';
import { workflowApi } from '@/api/workflow';
import { useCrawlerTest } from './hooks/useCrawlerTest';
import { jsonValidatorRule } from './extensions/jsonValidator';
import { useThemeStore } from '@/store/theme';
import { useTranslation } from 'react-i18next';
import { VariableSelectField } from './VariableSelectField';
import { JsonCodeEditor } from './JsonCodeEditor';

const { Option } = Select;
const { TextArea } = Input;

interface NodeConfigPanelProps {
  visible: boolean;
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  onClose: () => void;
  onSave: (nodeId: string, config: any) => void;
  autoTest?: boolean;
  executionResult?: any; // 执行结果，用于显示变量预览
  workflowId?: string; // 工作流ID，用于保存到后端
  onSaveToBackend?: () => Promise<boolean>; // 保存到后端的函数
}

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({
  visible,
  node,
  nodes,
  edges,
  onClose,
  onSave,
  autoTest = false,
  executionResult,
  workflowId,
  onSaveToBackend,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const { Paragraph, Text } = Typography;
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';

  // 只在爬虫节点时使用测试功能
  const nodeType = node?.data?.type || node?.type;
  const isCrawlerNode = nodeType === 'crawler';
  const crawlerTest = useCrawlerTest(isCrawlerNode ? node : null, form, nodes, edges);

  // 注入局部样式修复 Select 选中项背景过深的问题，以及Input聚焦样式过重的问题
  const selectStyle = `
    /* Select 下拉选项选中样式 */
    .ant-select-item-option-selected:not(.ant-select-item-option-disabled) {
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#e6f7ff'} !important;
      color: ${isDark ? '#ffffff' : 'inherit'} !important;
      font-weight: 500;
    }
    .ant-select-item-option-selected .anticon {
      color: ${isDark ? '#ffffff' : '#1890ff'} !important;
    }
    .ant-select-item-option-active:not(.ant-select-item-option-disabled) {
      background-color: ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#f5f5f5'} !important;
    }
    
    /* 优化 Input 和 Select 聚焦样式 */
    .ant-input:focus, .ant-input-focused,
    .ant-select-focused .ant-select-selector,
    .ant-select-selector:focus,
    .ant-select-selector:active,
    .ant-select-open .ant-select-selector {
      border-color: ${isDark ? '#177ddc' : '#40a9ff'} !important;
      box-shadow: 0 0 0 2px ${isDark ? 'rgba(23, 125, 220, 0.2)' : 'rgba(24, 144, 255, 0.2)'} !important;
      outline: none !important;
    }
    .ant-input:hover, .ant-select-selector:hover {
      border-color: ${isDark ? '#177ddc' : '#40a9ff'} !important;
    }

    /* 修复 Input/Select 在暗色模式下的背景和文字颜色 */
    ${isDark ? `
      .ant-input, .ant-select-selector {
        background-color: #141414 !important;
        color: #ffffff !important;
        border-color: #434343;
      }
      .ant-select-arrow {
        color: rgba(255, 255, 255, 0.45) !important;
      }
      .ant-select-dropdown {
        background-color: #1f1f1f !important;
      }
      .ant-select-item {
        color: rgba(255, 255, 255, 0.85) !important;
      }
      .ant-select-item-option-active {
        background-color: rgba(255, 255, 255, 0.08) !important;
      }
      .ant-empty-description {
        color: rgba(255, 255, 255, 0.45);
      }
    ` : ''}
  `;

  // 使用 ref 跟踪当前已初始化的节点ID，避免重复填充表单
  const initializedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (node) {
      // 如果已经为这个节点初始化过表单，且不是自动测试，则不重新填充
      // 这样可以保持用户在表单中的输入，即使数据库中的数据更新了
      if (initializedNodeIdRef.current === node.id && !autoTest) {
        return;
      }

      const config = node.data.config || {};

      // 处理配置数据的格式转换（对象转JSON字符串，用于表单显示）
      const formConfig = { ...config };
      if (formConfig.headers && typeof formConfig.headers === 'object') {
        formConfig.headers = JSON.stringify(formConfig.headers, null, 2);
      }
      if (formConfig.cookies && typeof formConfig.cookies === 'object') {
        formConfig.cookies = JSON.stringify(formConfig.cookies, null, 2);
      }

      // 判断是否需要自动开启高级配置
      const hasAdvanced = !!(
        (formConfig.headers && formConfig.headers.trim() !== '' && formConfig.headers.trim() !== '{}') ||
        (formConfig.cookies && formConfig.cookies.trim() !== '' && formConfig.cookies.trim() !== '{}') ||
        formConfig.proxy ||
        (formConfig.timeout !== undefined && formConfig.timeout !== 30) ||
        (formConfig.retryCount !== undefined && formConfig.retryCount !== 3)
      );

      // 填充表单数据，提供默认值
      form.setFieldsValue({
        label: node.data.label || '',
        connectionDirection: node.data.connectionDirection || 'vertical',
        timeout: 30,
        retryCount: 3,
        useAdvanced: hasAdvanced,
        ...formConfig,
      });

      // 标记当前节点已初始化
      initializedNodeIdRef.current = node.id;

      // 如果需要自动测试，且是爬虫节点，则延迟触发测试
      const currentNodeType = node?.data?.type || node?.type;
      if (autoTest && currentNodeType === 'crawler') {
        // 使用 setTimeout 确保表单值已设置且组件已准备好
        setTimeout(() => {
          crawlerTest.handleTestCrawl();
        }, 100);
      }
    } else {
      // 节点为空时，重置初始化标记
      initializedNodeIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, autoTest]); // 只依赖 node.id，避免 node 对象变化时重新填充表单

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (node) {
        const config = { ...values };
        const parseJsonField = (field: string) => {
          const v = (config as any)[field];
          if (typeof v === 'string') {
            const s = v.trim();
            if (s.startsWith('{') && s.endsWith('}')) {
              try {
                (config as any)[field] = JSON.parse(s);
              } catch {
              }
            }
          }
        };
        parseJsonField('headers');
        parseJsonField('cookies');
        delete config.label; // label不是config的一部分
        delete config.connectionDirection; // connectionDirection不是config的一部分
        delete (config as any).testCleanEnable;
        delete (config as any).testCleanRemoveHTML;
        delete (config as any).testCleanTrim;

        // 先更新本地状态
        onSave(node.id, {
          label: values.label,
          connectionDirection: values.connectionDirection || 'vertical',
          config: config,
        });

        // 等待状态更新后，再保存到后端
        // 使用setTimeout确保状态已更新
        if (workflowId && onSaveToBackend) {
          setTimeout(async () => {
            try {
              const saved = await onSaveToBackend();
              if (saved) {
                // 静默保存成功，不显示额外消息
              } else {
                message.warning('配置已保存，但保存到后端失败，请手动保存');
              }
            } catch (error) {
              console.error('保存到后端失败:', error);
              message.warning('配置已保存，但保存到后端失败，请手动保存');
            }
          }, 100);
        }

        message.success(t('node.config.configSaved'));
        onClose();
      }
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };


  const renderConditionConfig = () => (
    <>
      <Form.Item
        label={t('node.config.condition.conditionType')}
        name="conditionType"
        initialValue="equals"
      >
        <Select>
          <Option value="equals">{t('node.config.condition.equals')}</Option>
          <Option value="contains">{t('node.config.condition.contains')}</Option>
          <Option value="greater">{t('node.config.condition.greater')}</Option>
          <Option value="less">{t('node.config.condition.less')}</Option>
          <Option value="regex">{t('node.config.condition.regex')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.condition.fieldName')}
        name="field"
        rules={[{ required: true, message: t('node.config.condition.fieldNameRequired') }]}
        tooltip={t('node.config.condition.fieldNameTooltip')}
      >
        <Input placeholder="data.count" />
      </Form.Item>
      <Form.Item
        label="字段变量"
        name="fieldVariable"
        tooltip={
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是字段变量？</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              就像查字典时，你需要知道查哪个"词条"（字段名）。如果字段名是动态的，可以从上游节点获取。
            </div>

            <div style={{ fontSize: 12, lineHeight: 1.6, color: '#666' }}>
              <div style={{ marginBottom: 4 }}>• <strong>固定字段：</strong>直接在"字段名"框里输入，如：<code>data.count</code></div>
              <div>• <strong>动态字段：</strong>如果字段名会变化，在这里选择上游节点传来的字段名</div>
            </div>
          </div>
        }
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="选择字段变量（可选，通常直接在上方输入字段名）"
          executionResult={executionResult}
        />
      </Form.Item>
      <Form.Item
        label={t('node.config.condition.operator')}
        name="operator"
        initialValue="=="
      >
        <Select>
          <Option value="==">{t('node.config.condition.operatorEquals')}</Option>
          <Option value="!=">{t('node.config.condition.operatorNotEquals')}</Option>
          <Option value=">">{t('node.config.condition.operatorGreater')}</Option>
          <Option value="<">{t('node.config.condition.operatorLess')}</Option>
          <Option value=">=">{t('node.config.condition.operatorGreaterEqual')}</Option>
          <Option value="<=">{t('node.config.condition.operatorLessEqual')}</Option>
          <Option value="contains">{t('node.config.condition.operatorContains')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.condition.compareValue')}
        name="value"
        rules={[{ required: true, message: t('node.config.condition.compareValueRequired') }]}
      >
        <Input placeholder="100" />
      </Form.Item>
      <Form.Item
        label="比较值变量"
        name="valueVariable"
        tooltip={
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是比较值变量？</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              就像判断"成绩是否及格"，"60分"这个标准可以是固定的，也可以从其他地方获取。
            </div>

            <div style={{ fontSize: 12, lineHeight: 1.6, color: '#666' }}>
              <div style={{ marginBottom: 4 }}>• <strong>固定值：</strong>直接在"比较值"框里输入，如：<code>100</code></div>
              <div>• <strong>动态值：</strong>如果比较值会变化，在这里选择上游节点传来的值</div>
            </div>
          </div>
        }
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="选择比较值变量（可选，通常直接在上方输入固定值）"
          executionResult={executionResult}
        />
      </Form.Item>
    </>
  );

  const renderTransformConfig = () => (
    <>
      <Form.Item
        label={t('node.config.transform.transformType')}
        name="transformType"
        initialValue="map"
      >
        <Select>
          <Option value="map">{t('node.config.transform.map')}</Option>
          <Option value="filter">{t('node.config.transform.filter')}</Option>
          <Option value="sort">{t('node.config.transform.sort')}</Option>
          <Option value="group">{t('node.config.transform.group')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.transform.script')}
        name="script"
        tooltip={t('node.config.transform.scriptTooltip')}
      >
        <TextArea rows={3} placeholder="item * 2" />
      </Form.Item>
    </>
  );

  const renderLoopConfig = () => (
    <>
      <Form.Item
        label={t('node.config.loop.loopType')}
        name="loopType"
        initialValue="foreach"
      >
        <Select>
          <Option value="foreach">{t('node.config.loop.foreach')}</Option>
          <Option value="while">{t('node.config.loop.while')}</Option>
          <Option value="for">{t('node.config.loop.for')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.loop.dataSource')}
        name="items"
        tooltip={t('node.config.loop.dataSourceTooltip')}
      >
        <Input placeholder="data.items" />
      </Form.Item>
      <Form.Item
        label={t('node.config.loop.loopCondition')}
        name="condition"
      >
        <Input placeholder="data.count < 10" />
      </Form.Item>
    </>
  );

  const renderStartConfig = () => {
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
                tooltip={
                  <div style={{ maxWidth: 400 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是输入数据？</div>
                    <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
                      就像给工作流一个"起点数据"。你可以输入任何内容（比如"百度"），这个数据会传给下一个节点。
                    </div>

                    <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: '#666' }}>
                      <div style={{ marginBottom: 4 }}>• <strong>文本：</strong>直接输入文字，如：<code>百度</code></div>
                      <div style={{ marginBottom: 4 }}>• <strong>JSON：</strong>输入JSON格式，带语法高亮和格式化</div>
                      <div style={{ marginBottom: 4 }}>• <strong>URL：</strong>输入网址，会自动验证格式</div>
                      <div style={{ marginBottom: 4 }}>• <strong>数字：</strong>输入数字，如：<code>123</code></div>
                      <div>• <strong>留空：</strong>如果不输入，会使用默认数据（包含时间戳）</div>
                    </div>

                    <div style={{
                      padding: 8,
                      background: '#f0f7ff',
                      borderRadius: 4,
                      fontSize: 12,
                      lineHeight: 1.6,
                      border: '1px solid #b3d8ff'
                    }}>
                      <strong>🎯 使用场景：</strong><br />
                      比如你想爬取"百度"这个网站，可以在这里输入"百度"或网址，然后下一个爬虫节点就可以使用这个数据。
                    </div>
                  </div>
                }
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

  const renderDelayConfig = () => (
    <>
      <Form.Item
        label={t('node.config.delay.delayType')}
        name="delayType"
        initialValue="fixed"
      >
        <Select>
          <Option value="fixed">{t('node.config.delay.fixed')}</Option>
          <Option value="random">{t('node.config.delay.random')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.delay.delayTime')}
        name="seconds"
        initialValue={1}
        rules={[{ required: true, message: t('node.config.delay.delayTimeRequired') }]}
      >
        <Input type="number" min={0} max={3600} />
      </Form.Item>
    </>
  );

  const renderDataCleanConfig = () => (
    <>
      <Form.Item
        label="数据变量"
        name="dataVariable"
        tooltip={
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是数据变量？</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              就像做菜时，从上一个步骤拿过来"半成品"继续加工。选择上游节点传过来的数据，进行清洗处理。
            </div>

            <div style={{
              padding: 8,
              background: '#fff7e6',
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.6,
              border: '1px solid #ffd591'
            }}>
              <strong>💬 提示：</strong><br />
              如果不选择，系统会自动使用连接的上游节点的输出数据。
              只有当你需要指定特定的数据字段时，才需要选择。
            </div>
          </div>
        }
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="点击选择：使用上游节点的数据（不选则自动使用上游输出）"
          executionResult={executionResult}
        />
      </Form.Item>
      <Form.Item
        label={t('node.config.dataclean.cleanType')}
        name="cleanType"
        initialValue="html"
        tooltip={t('node.config.dataclean.cleanTypeTooltip')}
      >
        <Select>
          <Option value="html">{t('node.config.dataclean.html')}</Option>
          <Option value="text">{t('node.config.dataclean.text')}</Option>
          <Option value="email">{t('node.config.dataclean.email')}</Option>
          <Option value="url">{t('node.config.dataclean.url')}</Option>
          <Option value="phone">{t('node.config.dataclean.phone')}</Option>
          <Option value="number">{t('node.config.dataclean.number')}</Option>
          <Option value="date">{t('node.config.dataclean.date')}</Option>
          <Option value="custom">{t('node.config.dataclean.custom')}</Option>
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
                  label={t('node.config.dataclean.removeHTML')}
                  name="removeHTML"
                  initialValue={false}
                  valuePropName="checked"
                  tooltip={t('node.config.dataclean.removeHTMLTooltip')}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label={t('node.config.dataclean.trim')}
                  name="trim"
                  initialValue={true}
                  valuePropName="checked"
                  tooltip={t('node.config.dataclean.trimTooltip')}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label={t('node.config.dataclean.removeSpaces')}
                  name="removeSpaces"
                  initialValue={false}
                  valuePropName="checked"
                  tooltip={t('node.config.dataclean.removeSpacesTooltip')}
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label={t('node.config.dataclean.toLowerCase')}
                  name="toLowerCase"
                  initialValue={false}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label={t('node.config.dataclean.toUpperCase')}
                  name="toUpperCase"
                  initialValue={false}
                  valuePropName="checked"
                >
                  <Switch />
                </Form.Item>
                <Form.Item
                  label={t('node.config.dataclean.deduplicate')}
                  name="deduplicate"
                  initialValue={false}
                  valuePropName="checked"
                  tooltip={t('node.config.dataclean.deduplicateTooltip')}
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
        tooltip={
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是URL变量？</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              就像接力赛一样，让上一个节点把"网址"传过来，这个爬虫节点就会自动使用这个网址去爬取。
            </div>

            <div style={{ marginBottom: 8, fontWeight: 500 }}>📝 使用场景：</div>
            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: '#666' }}>
              <div style={{ marginBottom: 4 }}>• <strong>场景1：</strong>上一个节点输出了网址，直接选择使用</div>
              <div style={{ marginBottom: 4 }}>• <strong>场景2：</strong>上一个节点输出了数据包（包含网址），选择"数据.URL地址"</div>
              <div>• <strong>场景3：</strong>不选择变量，直接在"URL"框里输入固定网址</div>
            </div>

            <div style={{
              padding: 8,
              background: '#f0f7ff',
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.6,
              border: '1px solid #b3d8ff'
            }}>
              <strong>🎯 简单理解：</strong><br />
              如果下拉框里有很多选项（比如"延迟节点.数据.URL地址"），说明上游节点传过来的是一个"数据包"。
              选择带".URL地址"的选项，系统会自动从数据包里取出网址。
            </div>
          </div>
        }
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
            tooltip={
              <div style={{ maxWidth: 400, fontSize: 12, lineHeight: 1.6 }}>
                <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('node.config.crawler.selectPageType')}</div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{t('node.config.crawler.spaApp')}：</strong>{t('node.config.crawler.spaAppDesc')}
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>{t('node.config.crawler.normalPage')}：</strong>{t('node.config.crawler.normalPageDesc')}
                </div>
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(24, 144, 255, 0.1)', borderRadius: 4, color: '#1890ff' }}>
                  <strong>{t('node.config.crawler.antiCrawlerTip')}</strong>
                </div>
              </div>
            }
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
                  tooltip={
                    <div style={{ maxWidth: 400, fontSize: 12, lineHeight: 1.6 }}>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('node.config.crawler.waitForSelectorTooltip')}</div>
                      <div style={{ marginBottom: 8 }}>
                        <strong>{t('node.config.crawler.commonScenarios')}：</strong>
                      </div>
                      <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
                        <li>{t('node.config.crawler.blogArticle')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>article</code></li>
                        <li>{t('node.config.crawler.articleContent')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.content</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.post-content</code></li>
                        <li>{t('node.config.crawler.listPage')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.list</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>ul</code></li>
                        <li>{t('node.config.crawler.mainContainer')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>#app</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>main</code></li>
                        <li>{t('node.config.crawler.cardContent')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.card</code> {t('node.config.crawler.or')} <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 2 }}>.item</code></li>
                      </ul>
                      <div style={{ marginTop: 8, color: '#999' }}>
                        {t('node.config.crawler.selectorTip')}
                      </div>
                    </div>
                  }
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
                tooltip={
                  <div>
                    <div>{t('node.config.crawler.headersTooltip')}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
                      支持变量引用，如：{`{"Authorization": "Bearer {{auth_1.token}}"}`}
                    </div>
                  </div>
                }
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

  const renderAIConfig = () => (
    <>
      <Form.Item
        label={t('node.config.ai.model')}
        name="model"
        rules={[{ required: true, message: t('node.config.ai.modelRequired') }]}
      >
        <Input placeholder="gpt-3.5-turbo" />
      </Form.Item>
      <Form.Item
        label={t('node.config.ai.prompt')}
        name="prompt"
        rules={[{ required: true, message: t('node.config.ai.promptRequired') }]}
        tooltip="提示词内容，支持变量引用。可以在提示词中使用 {{变量名}} 来引用上游节点的数据。"
      >
        <TextArea rows={4} placeholder={t('node.config.ai.promptPlaceholder')} />
      </Form.Item>
      <Form.Item
        label="输入内容变量"
        name="contentVariable"
        tooltip={
          <div style={{ maxWidth: 400 }}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>💡 什么是输入内容变量？</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
              就像让AI分析一篇文章，文章内容可以从上游节点传过来，不需要手动输入。
            </div>

            <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 12, color: '#666' }}>
              <div style={{ marginBottom: 4 }}>• <strong>方式1：</strong>在这里选择变量，AI会直接使用这个变量的内容</div>
              <div>• <strong>方式2：</strong>在"提示词"框里用 <code>{`{{变量名}}`}</code> 的方式引用</div>
            </div>

            <div style={{
              padding: 8,
              background: '#f6ffed',
              borderRadius: 4,
              fontSize: 12,
              lineHeight: 1.6,
              border: '1px solid #b7eb8f'
            }}>
              <strong>💬 推荐：</strong><br />
              如果只是简单传递内容，在这里选择变量更方便。
              如果需要在提示词中灵活组合多个变量，在提示词中使用 <code>{`{{变量名}}`}</code> 更灵活。
            </div>
          </div>
        }
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="选择输入内容变量（可选，也可在提示词中使用{{变量名}}）"
          executionResult={executionResult}
        />
      </Form.Item>
      <Form.Item
        label={t('node.config.ai.temperature')}
        name="temperature"
        initialValue={0.7}
        tooltip={t('node.config.ai.temperatureTooltip')}
      >
        <Input type="number" min={0} max={1} step={0.1} />
      </Form.Item>
    </>
  );

  const renderOutputConfig = () => (
    <>
      <Form.Item
        label={t('node.config.output.format')}
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
        label={t('node.config.output.destination')}
        name="destination"
        initialValue="file"
      >
        <Select>
          <Option value="file">{t('node.config.output.file')}</Option>
          <Option value="database">{t('node.config.output.database')}</Option>
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
        return renderStartConfig();
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
        return <div>{t('node.config.mergeAutoMerge')}</div>;
      case 'delay':
        return renderDelayConfig();
      case 'output':
        return renderOutputConfig();
      case 'end':
        return <div>{t('node.config.endNoConfig')}</div>;
      default:
        return <div>{t('node.config.unknownType')}</div>;
    }
  };

  if (!node) return null;

  // 获取节点格式信息（使用已声明的 nodeType 变量）
  const inputFormats = getNodeInputFormats(nodeType);
  const outputFormat = getNodeOutputFormat(nodeType);
  const formatInfo = nodeFormats[nodeType];

  // 格式化标签显示
  const formatLabels: Record<string, string> = {
    any: t('node.formats.any'),
    json: t('node.formats.json'),
    array: t('node.formats.array'),
    text: t('node.formats.text'),
    html: t('node.formats.html'),
    url: t('node.formats.url'),
    number: t('node.formats.number'),
    boolean: t('node.formats.boolean'),
    null: t('node.formats.null'),
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
      }}
    >
      <style>{selectStyle}</style>

      {/* 头部 */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border-secondary)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--text-primary)' }}>
          {t('node.config.title')}: {node.data.label || node.id}
        </div>
        <Button
          type="text"
          icon={<CloseOutlined style={{ color: 'var(--text-primary)' }} />}
          onClick={onClose}
        />
      </div>

      {/* 内容区域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px',
      }}>
        {/* 数据格式信息 */}
        <div style={{
          marginBottom: 24,
          padding: 12,
          background: 'var(--bg-secondary)',
          borderRadius: 4,
          fontSize: 12,
          color: 'var(--text-primary)'
        }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('node.config.dataFormat')}</div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ color: 'var(--text-tertiary)' }}>{t('node.config.inputFormat')}：</span>
            <Space size={4} wrap>
              {inputFormats.map((format) => (
                <Tag key={format} color="blue" style={{ margin: 0 }}>
                  {formatLabels[format] || format}
                </Tag>
              ))}
            </Space>
          </div>
          <div>
            <span style={{ color: 'var(--text-tertiary)' }}>{t('node.config.outputFormat')}：</span>
            <Tag color="green" style={{ margin: 0 }}>
              {formatLabels[outputFormat] || outputFormat}
            </Tag>
          </div>
          {formatInfo?.description && (
            <div style={{ marginTop: 8, color: 'var(--text-disabled)', fontSize: 11 }}>
              {formatInfo.description}
            </div>
          )}
        </div>

        <Form form={form} layout="vertical">
          <Form.Item
            label={t('node.config.nodeName')}
            name="label"
            rules={[{ required: true, message: t('node.config.nodeNameRequired') }]}
          >
            <Input />
          </Form.Item>
          {renderConfigForm()}
        </Form>
      </div>

      {/* 底部按钮 */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border-secondary)',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        flexShrink: 0,
        background: 'var(--bg-primary)',
      }}>
        <Button onClick={onClose}>
          {t('common.cancel')}
        </Button>
        {isCrawlerNode && (
          <Button onClick={crawlerTest.handleTestCrawl}>
            {t('node.config.crawler.testCrawl')}
          </Button>
        )}
        <Button type="primary" onClick={handleSave}>
          {t('workflowEditor.save')}
        </Button>
      </div>

      {/* 只在爬虫节点时显示预览模态框 */}
      {isCrawlerNode && (
        <Modal
          title={t('node.config.crawler.previewTitle')}
          open={crawlerTest.previewOpen}
          onCancel={() => crawlerTest.setPreviewOpen(false)}
          footer={null}
          width={700}
          centered
          maskClosable={false}
          bodyStyle={{ padding: '0 24px 24px' }}
        >
          {crawlerTest.previewData ? (() => {
            const crawlerData = crawlerTest.previewData?.crawler?.data;
            const mode = crawlerData?.mode || crawlerData?.extractMode;
            // 尝试获取数据源，可能是 data, value, 或者直接就是 crawlerData
            let rawData = crawlerData?.data || crawlerData?.value || crawlerData;

            // 智能查找数组源：如果 rawData 不是数组，尝试查找常见的数组字段
            if (!Array.isArray(rawData) && rawData && typeof rawData === 'object') {
              if (Array.isArray(rawData.images)) {
                rawData = rawData.images;
              } else if (Array.isArray(rawData.list)) {
                rawData = rawData.list;
              } else if (Array.isArray(rawData.items)) {
                rawData = rawData.items;
              } else if (Array.isArray(rawData.results)) {
                rawData = rawData.results;
              }
            }

            const isImageMode = mode === 'images';

            // 智能提取图片链接
            let extractedImages: string[] = [];

            if (Array.isArray(rawData)) {
              extractedImages = rawData
                .map((item: any) => {
                  if (typeof item === 'string') return item;
                  if (typeof item === 'object' && item !== null) {
                    // 尝试常见的图片字段名
                    return item.src || item.url || item.link || item.img || item.image || item.href || item.data;
                  }
                  return null;
                })
                .filter((url: any) => typeof url === 'string' && (url.startsWith('http') || url.startsWith('https') || url.startsWith('data:image') || url.startsWith('//') || url.startsWith('/')));
            } else if (typeof rawData === 'string' && (rawData.startsWith('http') || rawData.startsWith('data:image') || rawData.startsWith('/'))) {
              extractedImages = [rawData];
            }

            const hasImages = extractedImages.length > 0;

            const items = [
              {
                key: 'overview',
                label: t('node.config.crawler.overview'),
                children: (
                  <div style={{ maxHeight: '50vh', overflow: 'auto', paddingRight: 4 }}>
                    <div style={{ marginBottom: 16, background: 'var(--bg-secondary)', padding: 12, borderRadius: 6 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>{t('node.config.executionStatus')}</Text>
                      <div style={{ marginTop: 8, display: 'flex', gap: 24 }}>
                        <div>
                          <Text style={{ marginRight: 8, fontSize: 13 }}>{t('node.types.crawler')}</Text>
                          <Tag color={crawlerTest.previewData?.crawler?.success ? 'success' : 'error'}>
                            {crawlerTest.previewData?.crawler?.success ? t('node.execution.success') : t('node.execution.failed')}
                          </Tag>
                        </div>
                        {crawlerTest.previewData?.dataclean && (
                          <div>
                            <Text style={{ marginRight: 8, fontSize: 13 }}>{t('node.types.dataclean')}</Text>
                            <Tag color={crawlerTest.previewData?.dataclean?.success ? 'success' : 'error'}>
                              {crawlerTest.previewData?.dataclean?.success ? t('node.execution.success') : t('node.execution.failed')}
                            </Tag>
                          </div>
                        )}
                      </div>
                      {(crawlerTest.previewData?.crawler?.error || crawlerTest.previewData?.dataclean?.error) && (
                        <div style={{
                          marginTop: 12,
                          padding: 8,
                          background: isDark ? 'rgba(255, 77, 79, 0.1)' : '#fff1f0',
                          borderRadius: 4,
                          border: `1px solid ${isDark ? '#a8071a' : '#ffa39e'}`
                        }}>
                          <Text type="danger" style={{ fontSize: 12 }}>
                            {crawlerTest.previewData?.crawler?.error || crawlerTest.previewData?.dataclean?.error}
                          </Text>
                        </div>
                      )}
                    </div>
                    <Collapse defaultActiveKey={['summary']} size="small" ghost>
                      <Collapse.Panel header={t('node.config.crawler.dataSummary')} key="summary">
                        <div style={{ paddingLeft: 8 }}>
                          <Space direction="vertical" size={4} style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <Text type="secondary">{t('node.config.crawler.mode')}</Text>
                              <Text>{crawlerTest.previewData?.crawler?.data?.mode || crawlerTest.previewData?.crawler?.data?.extractMode || t('node.config.crawler.unknown')}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <Text type="secondary">{t('node.config.crawler.selector')}</Text>
                              <Text code>{crawlerTest.previewData?.crawler?.data?.selector_used || crawlerTest.previewData?.crawler?.data?.selector || t('node.config.crawler.notUsed')}</Text>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                              <Text type="secondary">{t('node.config.crawler.resultCount')}</Text>
                              <Text strong>{crawlerTest.previewData?.crawler?.data?.count ?? (Array.isArray(rawData) ? rawData.length : 1)}</Text>
                            </div>
                          </Space>
                          <div style={{ marginTop: 16 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>{t('node.config.crawler.textSample')}</Text>
                            <div style={{ marginTop: 8, background: 'var(--bg-secondary)', padding: 12, borderRadius: 4, fontSize: 12, lineHeight: 1.5 }}>
                              <Paragraph ellipsis={{ rows: 8, expandable: true }} style={{ marginBottom: 0 }}>
                                {crawlerTest.previewData?.dataclean?.data
                                  ? (typeof crawlerTest.previewData.dataclean.data === 'string'
                                    ? crawlerTest.previewData.dataclean.data
                                    : JSON.stringify(crawlerTest.previewData.dataclean.data, null, 2))
                                  : (crawlerTest.previewData?.crawler?.data?.text ??
                                    JSON.stringify(crawlerTest.previewData?.crawler?.data?.value || crawlerTest.previewData?.crawler?.data?.data || crawlerTest.previewData?.crawler?.data, null, 2))}
                              </Paragraph>
                            </div>
                          </div>
                        </div>
                      </Collapse.Panel>
                    </Collapse>
                  </div>
                ),
              },
              {
                key: 'cleaned',
                label: t('node.config.crawler.cleaned'),
                children: (
                  <div style={{ maxHeight: '60vh', overflow: 'auto', background: 'var(--bg-secondary)', borderRadius: 4, padding: 12 }}>
                    {crawlerTest.previewData?.dataclean?.data ? (
                      typeof crawlerTest.previewData.dataclean.data === 'string' ? (
                        <Paragraph style={{ fontSize: 13, marginBottom: 0, whiteSpace: 'pre-wrap' }}>{crawlerTest.previewData.dataclean.data}</Paragraph>
                      ) : (
                        <pre style={{ margin: 0, fontSize: 12, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                          {JSON.stringify(crawlerTest.previewData.dataclean.data, null, 2)}
                        </pre>
                      )
                    ) : (
                      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
                        {t('node.config.crawler.noCleanResult')}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'json',
                label: t('node.config.crawler.rawJson'),
                children: (
                  <div style={{ maxHeight: '50vh', overflow: 'auto', background: '#282c34', color: '#abb2bf', padding: 12, borderRadius: 4 }}>
                    <pre style={{ margin: 0, fontSize: 12, fontFamily: 'Consolas, monospace' }}>
                      {JSON.stringify(crawlerTest.previewData, null, 2)}
                    </pre>
                  </div>
                ),
              }
            ];

            if (isImageMode || hasImages) {
              items.push({
                key: 'images',
                label: t('node.config.crawler.imagePreview'),
                children: (
                  <div style={{ maxHeight: '60vh', overflow: 'auto', padding: 12 }}>
                    {hasImages ? (
                      <Image.PreviewGroup>
                        <Space size={[8, 8]} wrap>
                          {extractedImages.map((src: string, index: number) => (
                            <Image
                              key={index}
                              width={100}
                              height={100}
                              src={src}
                              style={{ objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border-secondary)' }}
                              fallback="https://via.placeholder.com/100x100?text=Error"
                            />
                          ))}
                        </Space>
                      </Image.PreviewGroup>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('node.config.crawler.noImageLinks')} />
                        <div style={{ marginTop: 16, maxWidth: '80%', fontSize: 12, color: '#999', textAlign: 'center' }}>
                          <p>{t('node.config.crawler.imageExtractTip')}</p>
                          <p>{t('node.config.crawler.checkRawJsonTip')}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )
              });
            }

            return (
              <Tabs
                defaultActiveKey={isImageMode ? 'images' : 'overview'}
                size="small"
                items={items}
              />
            );
          })() : (
            <div style={{ padding: 48, textAlign: 'center', color: '#999' }}>
              {t('node.config.crawler.noPreviewData')}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default NodeConfigPanel;

import React, { useState, useEffect } from 'react';
import { Form, Input, Select, Radio, Collapse, InputNumber, Tag, message, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { Node, Edge } from 'reactflow';
import { VariableSelectField } from '../variables';
import { AITooltips } from '../utils/configTooltips';
import { aiApi } from '@/api/ai';
import type { AIModel, SystemPresetModel } from '@/types/ai';
import {
  SettingOutlined,
  DatabaseOutlined,
  KeyOutlined,
  RobotOutlined,
  QuestionCircleOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import styles from './AINodeConfig.module.scss';

const { TextArea } = Input;
const { Option } = Select;
const { Panel } = Collapse;

interface AINodeConfigProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  executionResult?: any;
}

export const AINodeConfig: React.FC<AINodeConfigProps> = ({
  node,
  nodes,
  edges,
  executionResult,
}) => {
  const { t } = useTranslation();
  const [systemModels, setSystemModels] = useState<SystemPresetModel[]>([]);
  const [userModels, setUserModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(false);

  // 加载系统预设模型
  useEffect(() => {
    const loadSystemModels = async () => {
      try {
        const models = await aiApi.getSystemPresetModels();
        setSystemModels(models);
      } catch (error) {
        console.error(t('node.config.ai.loadSystemModelsFailed'), error);
      }
    };
    loadSystemModels();
  }, []);

  // 加载用户模型列表的函数
  const loadUserModels = async () => {
    if (loading) return; // 防止重复加载
    setLoading(true);
    try {
      const response = await aiApi.getModels({ page: 1, pageSize: 100 });
      setUserModels(response.list || []);
    } catch (error) {
      console.error(t('node.config.ai.loadUserModelsFailed'), error);
      message.error(t('node.config.ai.loadUserModelsFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 初始化时，如果节点配置中modelMode是saved，则加载
  useEffect(() => {
    const currentMode = node?.data?.config?.modelMode;
    if (currentMode === 'saved') {
      loadUserModels();
    }
  }, [node]);

  return (
    <div className={styles.configContainer}>
      {/* 配置模式选择 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <QuestionCircleOutlined />
          <span>{t('node.config.ai.configMode')}</span>
        </div>
        <div className={styles.sectionDescription}>
          {t('node.config.ai.configModeDesc')}
        </div>
        <Form.Item
          name="modelMode"
          initialValue="system"
          style={{ marginBottom: 0 }}
        >
          <Radio.Group className={styles.modeSelector}>
            <Radio.Button value="system">
              <div className={styles.modeButton} title={t('node.config.ai.systemPreset')}>
                <SettingOutlined className={styles.modeIcon} />
                <span className={styles.modeText}>{t('node.config.ai.systemPreset')}</span>
              </div>
            </Radio.Button>
            <Radio.Button value="saved">
              <div className={styles.modeButton} title={t('node.config.ai.savedModel')}>
                <DatabaseOutlined className={styles.modeIcon} />
                <span className={styles.modeText}>{t('node.config.ai.savedModel')}</span>
              </div>
            </Radio.Button>
            <Radio.Button value="custom">
              <div className={styles.modeButton} title={t('node.config.ai.customConfig')}>
                <KeyOutlined className={styles.modeIcon} />
                <span className={styles.modeText}>{t('node.config.ai.customConfig')}</span>
              </div>
            </Radio.Button>
          </Radio.Group>
        </Form.Item>
      </div>

      {/* 根据modelMode显示不同的配置 */}
      <div className={styles.section}>
        <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.modelMode !== curr?.modelMode}>
          {({ getFieldValue }) => {
            const currentMode = getFieldValue('modelMode') || 'system';

            return (
              <>
                {/* 系统预设模式 */}
                {currentMode === 'system' && (
                  <>
                    <div className={styles.sectionTitle}>
                      <SettingOutlined />
                      <span>{t('node.config.ai.systemPresetModel')}</span>
                    </div>
                    <div className={styles.sectionDescription}>
                      {t('node.config.ai.systemPresetDesc')}
                    </div>
                    <div className={styles.configForm}>
                      <Form.Item
                        label={t('node.config.ai.selectModel')}
                        name="provider"
                        rules={[{ required: true, message: t('node.config.ai.selectProviderRequired') }]}
                        className={styles.formItem}
                      >
                        <Select
                          placeholder={t('node.config.ai.selectSystemPresetModel')}
                          loading={loading}
                          className={styles.modelSelect}
                        >
                          {systemModels.map((model) => (
                            <Option key={model.id} value={model.provider}>
                              <div style={{ width: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Tag color="blue" className={styles.optionTag} title={model.name}>
                                  {model.name}
                                </Tag>
                                <span className={styles.optionText} title={model.modelName}>
                                  {model.modelName}
                                </span>
                              </div>
                            </Option>
                          ))}
                          {systemModels.length === 0 && (
                            <Option disabled value="">
                              {t('node.config.ai.noSystemPresetModel')}
                            </Option>
                          )}
                        </Select>
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.modelName')}
                        name="modelName"
                        initialValue="deepseek-chat"
                        className={styles.formItem}
                      >
                        <Select className={styles.modelSelect}>
                          <Option value="deepseek-chat">deepseek-chat</Option>
                          <Option value="deepseek-coder">deepseek-coder</Option>
                        </Select>
                      </Form.Item>
                    </div>
                  </>
                )}

                {/* 已保存模型模式 */}
                {currentMode === 'saved' && (
                  <>
                    <div className={styles.sectionTitle}>
                      <DatabaseOutlined />
                      <span>{t('node.config.ai.savedModel')}</span>
                    </div>
                    <div className={styles.sectionDescription}>
                      {t('node.config.ai.savedModelDesc')}
                    </div>
                    <div className={styles.configForm}>
                      <Form.Item
                        label={t('node.config.ai.selectModel')}
                        name="modelId"
                        rules={[{ required: true, message: t('node.config.ai.selectSavedModelRequired') }]}
                        className={styles.formItem}
                      >
                        <Select
                          placeholder={t('node.config.ai.selectSavedModel')}
                          loading={loading}
                          showSearch
                          className={styles.modelSelect}
                          filterOption={(input, option) => {
                            // 根据 option.value 找到对应的模型
                            const model = userModels.find(m => m.id === option?.value);
                            if (!model) return false;
                            // 基于模型的名称、提供商和模型名称进行过滤
                            const searchText = `${model.name} ${model.provider} ${model.modelName}`.toLowerCase();
                            return searchText.includes(input.toLowerCase());
                          }}
                          onFocus={() => {
                            // 当聚焦时，如果列表为空，重新加载
                            if (userModels.length === 0 && !loading) {
                              loadUserModels();
                            }
                          }}
                        >
                          {userModels.map((model) => (
                            <Option key={model.id} value={model.id}>
                              <div style={{ width: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
                                <Tag color="green" className={styles.optionTag} title={model.name}>
                                  {model.name}
                                </Tag>
                                <span className={styles.optionText} title={`${model.provider} / ${model.modelName}`}>
                                  {model.provider} / {model.modelName}
                                </span>
                                {model.status === 'active' && (
                                  <Tag color="success" style={{ flexShrink: 0 }}>
                                    {t('node.config.ai.enabled')}
                                  </Tag>
                                )}
                              </div>
                            </Option>
                          ))}
                          {userModels.length === 0 && !loading && (
                            <Option disabled value="">
                              {t('node.config.ai.noSavedModel')}
                            </Option>
                          )}
                        </Select>
                      </Form.Item>
                    </div>
                  </>
                )}

                {/* 自定义配置模式 */}
                {currentMode === 'custom' && (
                  <>
                    <div className={styles.sectionTitle}>
                      <KeyOutlined />
                      <span>{t('node.config.ai.customConfig')}</span>
                    </div>
                    <div className={styles.sectionDescription}>
                      {t('node.config.ai.customConfigDesc')}
                    </div>
                    <div className={styles.configForm}>
                      <Form.Item
                        label={t('node.config.ai.provider')}
                        name="provider"
                        rules={[{ required: true, message: t('node.config.ai.selectProviderRequired') }]}
                        initialValue="deepseek"
                        className={styles.formItem}
                      >
                        <Select className={styles.modelSelect}>
                          <Option value="deepseek">DeepSeek</Option>
                        </Select>
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.modelName')}
                        name="modelName"
                        rules={[{ required: true, message: t('node.config.ai.modelNameRequired') }]}
                        initialValue="deepseek-chat"
                        className={styles.formItem}
                      >
                        <Input placeholder="deepseek-chat" />
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.apiKey')}
                        name="apiKey"
                        rules={[{ required: true, message: t('node.config.ai.apiKeyRequired') }]}
                        className={styles.formItem}
                        tooltip={t('node.config.ai.apiKeyTooltip')}
                      >
                        <Input.Password
                          placeholder="sk-xxx"
                          iconRender={(visible) => (visible ? <EyeInvisibleOutlined /> : <EyeInvisibleOutlined />)}
                        />
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.baseUrl')}
                        name="baseUrl"
                        initialValue="https://api.deepseek.com"
                        className={styles.formItem}
                        tooltip={t('node.config.ai.baseUrlTooltip')}
                      >
                        <Input placeholder="https://api.deepseek.com" />
                      </Form.Item>
                    </div>
                  </>
                )}
              </>
            );
          }}
        </Form.Item>
      </div>

      {/* 提示词和内容配置 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <RobotOutlined />
          <span>{t('node.config.ai.aiProcessingConfig')}</span>
        </div>
        <div className={styles.sectionDescription}>
          {t('node.config.ai.aiProcessingDesc')}
        </div>
        <div className={styles.configForm}>
          <Form.Item
            label={t('node.config.ai.prompt')}
            name="prompt"
            rules={[{ required: true, message: t('node.config.ai.promptRequired') }]}
            className={styles.formItem}
            tooltip={t('node.config.ai.promptTooltip')}
          >
            <TextArea
              rows={5}
              className={styles.promptTextArea}
              placeholder={t('node.config.ai.promptPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            label={t('node.config.ai.contentVariable')}
            name="contentVariable"
            className={styles.formItem}
            tooltip={AITooltips.contentVariable}
          >
            <VariableSelectField
              node={node}
              nodes={nodes}
              edges={edges}
              placeholder={t('node.config.ai.contentVariablePlaceholder')}
              executionResult={executionResult}
            />
          </Form.Item>
        </div>
      </div>

      {/* 高级参数（可折叠） */}
      <div className={styles.advancedSection}>
        <Collapse ghost>
          <Panel header={t('node.config.ai.advancedParams')} key="advanced">
            <Form.Item
              label={t('node.config.ai.temperature')}
              name="temperature"
              initialValue={0.7}
              tooltip={t('node.config.ai.temperatureTooltip')}
              className={styles.formItem}
            >
              <InputNumber
                min={0}
                max={1}
                step={0.1}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              label={t('node.config.ai.maxTokens')}
              name="maxTokens"
              initialValue={2000}
              tooltip={t('node.config.ai.maxTokensTooltip')}
              className={styles.formItem}
            >
              <InputNumber
                min={1}
                max={4096}
                step={100}
                style={{ width: '100%' }}
              />
            </Form.Item>
            <Form.Item
              label={t('node.config.ai.stream')}
              name="stream"
              valuePropName="checked"
              initialValue={false}
              tooltip={t('node.config.ai.streamTooltip')}
              className={styles.formItem}
            >
              <Switch />
            </Form.Item>
            <Form.Item
              label={t('node.config.ai.thinking')}
              name="thinking"
              valuePropName="checked"
              initialValue={false}
              tooltip={t('node.config.ai.thinkingTooltip')}
              className={styles.formItem}
            >
              <Switch />
            </Form.Item>
          </Panel>
        </Collapse>
      </div>
    </div>
  );
};

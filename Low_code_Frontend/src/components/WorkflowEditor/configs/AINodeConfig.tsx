import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Radio, Collapse, InputNumber, Tag, message, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { Node, Edge } from 'reactflow';
import { VariableSelectField, VariableTagTextArea } from '../variables';
import { AITooltips } from '../utils/configTooltips';
import { aiApi } from '@/api/ai';
import type { AIModel, SystemPresetModel, ProviderTemplate } from '@/types/ai';
import {
  SettingOutlined,
  DatabaseOutlined,
  KeyOutlined,
  RobotOutlined,
  QuestionCircleOutlined,
  EyeInvisibleOutlined
} from '@ant-design/icons';
import styles from './AINodeConfig.module.scss';
import {
  getModelConfigSupport,
  getModelConfigKey,
} from './modelConfigSupport';
// 导入 providers 以触发注册
import '../providers';
import { providerRegistry } from '../providers';
import { AIModelConfigPopup } from './AIModelConfigPopup';
import { ProviderIcon } from '../../Icons/ProviderIcon';
import { ProviderPicker, type ProviderPickerMode, type ProviderPickerOption } from './ProviderPicker';

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
  const [providerTemplates, setProviderTemplates] = useState<ProviderTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const form = Form.useFormInstance();

  const [providerPickerMode, setProviderPickerMode] = useState<ProviderPickerMode>(() => {
    if (typeof window === 'undefined') return 'list';
    const v = window.localStorage.getItem('ai_provider_picker_mode');
    return v === 'cards' ? 'cards' : 'list';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ai_provider_picker_mode', providerPickerMode);
  }, [providerPickerMode]);

  const providerPickerOptionsCustom = React.useMemo<ProviderPickerOption[]>(
    () => [
      { value: 'deepseek', title: 'DeepSeek', icon: <ProviderIcon provider="deepseek" size={18} /> },
      { value: 'doubao', title: '豆包', icon: <ProviderIcon provider="doubao" size={18} /> },
      { value: 'qwen', title: '通义千问', icon: <ProviderIcon provider="qwen" size={18} /> },
      { value: 'minimax', title: 'MiniMax', icon: <ProviderIcon provider="minimax" size={18} /> },
      { value: 'spark', title: '讯飞星火', icon: <ProviderIcon provider="spark" size={18} /> },
      { value: 'hunyuan', title: '腾讯混元', icon: <ProviderIcon provider="hunyuan" size={18} /> },
      { value: 'zhipuai', title: '智谱AI GLM', icon: <ProviderIcon provider="zhipuai" size={18} /> },
      { value: 'gemini', title: 'Google Gemini', icon: <ProviderIcon provider="gemini" size={18} /> },
      { value: 'gpt', title: 'GPT', icon: <ProviderIcon provider="gpt" size={18} /> },
      { value: 'grok', title: 'Grok', icon: <ProviderIcon provider="grok" size={18} /> },
    ],
    [],
  );

  const providerPickerOptionsSystem = React.useMemo<ProviderPickerOption[]>(() => {
    const seen = new Set<string>();
    const opts: ProviderPickerOption[] = [];
    for (const m of systemModels) {
      if (seen.has(m.provider)) continue;
      seen.add(m.provider);
      const providerReg = providerRegistry.get(m.provider);
      const displayName = providerReg?.displayName || m.name;
      opts.push({
        value: m.provider,
        title: displayName,
        icon: <ProviderIcon provider={m.provider} size={18} />,
      });
    }
    return opts;
  }, [systemModels]);

  // 用于跟踪当前模型配置键，避免重复切换
  const currentModelConfigKeyRef = useRef<string | null>(null);

  // 高级配置面板的展开状态
  const [advancedPanelActive, setAdvancedPanelActive] = useState<string[]>([]);

  // 监听模型选择变化，自动填充模型默认值
  const modelMode = Form.useWatch('modelMode', form);
  const modelId = Form.useWatch('modelId', form);
  const provider = Form.useWatch('provider', form);
  const modelName = Form.useWatch('modelName', form);

  // 获取当前模型配置键
  const getCurrentModelConfigKey = () => {
    return getModelConfigKey(modelMode || 'system', provider, modelName, modelId);
  };

  // 从节点配置中获取模型配置存储对象
  const getModelConfigs = (): Record<string, any> => {
    const config = node?.data?.config || {};
    const modelConfigs = (config.modelConfigs as Record<string, any>) || {};
    return modelConfigs;
  };

  // 使用 useMemo 生成 modelConfigs 的序列化值，用于监听变化
  const modelConfigsKey = React.useMemo(() => {
    const modelConfigs = getModelConfigs();
    return JSON.stringify(modelConfigs);
  }, [node?.data?.config?.modelConfigs]);


  // 恢复模型配置
  const restoreModelConfig = () => {
    const configKey = getCurrentModelConfigKey();
    if (!configKey) {
      return;
    }

    // 如果配置键没有变化，且已经恢复过，则跳过
    // 但需要检查节点数据是否有更新（modelConfigs 可能已更新）
    const modelConfigs = getModelConfigs();
    const savedConfig = modelConfigs[configKey];

    // 如果配置键相同，但节点数据可能已更新，需要重新恢复
    const shouldRestore = configKey !== currentModelConfigKeyRef.current || savedConfig;

    if (!shouldRestore && configKey === currentModelConfigKeyRef.current) {
      return; // 没有变化且没有保存的配置，不需要恢复
    }

    if (savedConfig) {
      // 恢复保存的配置
      Object.keys(savedConfig).forEach((key) => {
        if (savedConfig[key] !== undefined) {
          form.setFieldValue(key, savedConfig[key]);
        }
      });
      // 修复：确保 provider 值为 qwen（如果之前保存的是 qianwen）
      if (savedConfig.provider === 'qianwen') {
         form.setFieldValue('provider', 'qwen');
      }
    } else {
      // 没有保存的配置，使用默认值
      const currentProvider = provider || (modelMode === 'saved' && modelId
        ? userModels.find(m => m.id === modelId)?.provider
        : null);

      const support = getModelConfigSupport(currentProvider);

      // 清除不支持的配置
      if (!support.stream) {
        form.setFieldValue('stream', undefined);
      }
      if (!support.thinking) {
        form.setFieldValue('thinking', undefined);
        // 通义千问使用 enable_thinking 而不是 thinking
        if (currentProvider === 'qwen') {
          form.setFieldValue('enable_thinking', undefined);
        }
      }
      if (!support.thinkingLevel) {
        form.setFieldValue('thinkingLevel', undefined);
      }
      if (!support.frequencyPenalty) {
        form.setFieldValue('frequencyPenalty', undefined);
      }
      if (!support.presencePenalty) {
        form.setFieldValue('presencePenalty', undefined);
      }
      if (!support.stopSequences) {
        form.setFieldValue('stopSequences', undefined);
      }

      // 设置默认值
      if (support.stream && form.getFieldValue('stream') === undefined) {
        form.setFieldValue('stream', false);
      }
      if (support.thinking && form.getFieldValue('thinking') === undefined) {
        // 通义千问使用 enable_thinking 而不是 thinking
        if (currentProvider === 'qwen') {
          if (form.getFieldValue('enable_thinking') === undefined) {
            form.setFieldValue('enable_thinking', false);
          }
        } else {
          form.setFieldValue('thinking', false);
        }
      }
      if (support.thinkingLevel && form.getFieldValue('thinkingLevel') === undefined) {
        form.setFieldValue('thinkingLevel', 'medium'); // 豆包默认使用 medium 模式
      }
    }

    currentModelConfigKeyRef.current = configKey;
  };

  // 监听模型切换和节点配置变化，恢复配置
  useEffect(() => {
    if (!node) return;

    // 延迟执行，确保表单字段和节点数据已经更新
    const timer = setTimeout(() => {
      restoreModelConfig();
    }, 150);

    return () => clearTimeout(timer);
  }, [
    modelMode,
    modelId,
    provider,
    modelName,
    node?.id,
    modelConfigsKey, // 监听 modelConfigs 的变化
    userModels
  ]);

  // 监听高级配置面板展开，当展开时恢复配置
  useEffect(() => {
    if (!node) return;

    // 如果面板已展开，延迟执行恢复配置（确保表单字段已渲染）
    if (advancedPanelActive.includes('advanced')) {
      const timer = setTimeout(() => {
        restoreModelConfig();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [advancedPanelActive, node?.id, modelMode, modelId, provider, modelName, modelConfigsKey]);

  // 初始化时恢复配置
  useEffect(() => {
    if (node && node.id) {
      const timer = setTimeout(() => {
        restoreModelConfig();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [node?.id]);

  // 加载系统预设模型和供应商模板
  useEffect(() => {
    const loadData = async () => {
      try {
        const [models, templates] = await Promise.all([
          aiApi.getSystemPresetModels(),
          aiApi.getProviderTemplates(),
        ]);
        setSystemModels(models);
        setProviderTemplates(templates);
      } catch (error) {
        // 加载失败
      }
    };
    loadData();
  }, []);

  // 加载用户模型列表的函数
  const loadUserModels = async () => {
    if (loading) return; // 防止重复加载
    setLoading(true);
    try {
      const response = await aiApi.getModels({ page: 1, pageSize: 100 });
      setUserModels(response.list || []);
    } catch (error) {
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
                      <Form.Item label={t('node.config.ai.displayMode') || '展示方式'} className={styles.formItem}>
                        <Radio.Group
                          value={providerPickerMode}
                          onChange={(e) => setProviderPickerMode(e.target.value)}
                        >
                          <Radio.Button value="list">{t('node.config.ai.viewList') || '列表'}</Radio.Button>
                          <Radio.Button value="cards">{t('node.config.ai.viewCards') || '图片'}</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.selectModel')}
                        name="provider"
                        rules={[{ required: true, message: t('node.config.ai.selectProviderRequired') }]}
                        className={styles.formItem}
                        style={providerPickerMode === 'cards' ? { display: 'none' } : {}}
                      >
                        <ProviderPicker
                          mode={providerPickerMode}
                          placeholder={t('node.config.ai.selectSystemPresetModel')}
                          loading={loading}
                          className={styles.modelSelect}
                          options={providerPickerOptionsSystem}
                          onChange={(value) => {
                            form.setFieldValue('provider', value);
                            const selectedModel = systemModels.find(m => m.provider === value);
                            const providerTemplate = providerTemplates.find(t => t.provider === value);
                            const defaultModelName = selectedModel?.modelName || providerTemplate?.supportedModels[0] || '';
                            if (defaultModelName) {
                              form.setFieldValue('modelName', defaultModelName);
                            }
                          }}
                        />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.provider !== curr?.provider}>
                        {({ getFieldValue }) => {
                          const selectedProvider = getFieldValue('provider');
                          const selectedSystemModel = systemModels.find(m => m.provider === selectedProvider);
                          const providerTemplate = providerTemplates.find(t => t.provider === selectedProvider);

                          // 获取支持的模型列表
                          const supportedModels = providerTemplate?.supportedModels || [];
                          // 默认模型名称：优先使用系统预设模型的 modelName，否则使用模板的第一个模型
                          const defaultModelName = selectedSystemModel?.modelName || supportedModels[0] || '';
                          const currentModelName = getFieldValue('modelName');
                          const providerConfigSupport = getModelConfigSupport(selectedProvider);

                          return (
                            <>
                              {providerPickerMode === 'cards' ? (
                                <>
                                  <div className={styles.label}>{t('node.config.ai.modelName')}</div>
                                  <AIModelConfigPopup
                                    value={selectedProvider}
                                    onChange={(val) => {
                                      form.setFieldValue('provider', val);
                                      // 切换服务商时，自动选中默认模型
                                      const selectedModel = systemModels.find(m => m.provider === val);
                                      const template = providerTemplates.find(t => t.provider === val);
                                      const defaultName = selectedModel?.modelName || template?.supportedModels[0] || '';
                                      if (defaultName) {
                                        form.setFieldValue('modelName', defaultName);
                                      }
                                    }}
                                    options={providerPickerOptionsSystem}
                                    supportedModels={supportedModels}
                                    currentModelName={currentModelName}
                                    onModelChange={(val) => form.setFieldValue('modelName', val)}
                                    onOpen={() => restoreModelConfig()}
                                    trigger={
                                      <div className={styles.triggerCard}>
                                        <div className={styles.triggerCardIcon}>
                                          <ProviderIcon provider={selectedProvider} size={24} />
                                        </div>
                                        <div className={styles.triggerCardContent}>
                                          <div className={styles.triggerCardTitle}>
                                            {selectedSystemModel?.name || providerTemplate?.name || selectedProvider}
                                          </div>
                                          <div className={styles.triggerCardDesc}>
                                            {currentModelName || defaultModelName || '请选择模型'}
                                          </div>
                                        </div>
                                        <div className={styles.triggerCardAction}>
                                          <SettingOutlined />
                                        </div>
                                      </div>
                                    }
                                  />
                                  {/* 隐藏字段以确保 Form 数据同步 */}
                                  <Form.Item name="modelName" style={{ display: 'none' }} rules={[{ required: true }]}>
                                    <Input />
                                  </Form.Item>
                                </>
                              ) : (
                                <Form.Item
                                  label={t('node.config.ai.modelName')}
                                  name="modelName"
                                  rules={[{ required: true, message: t('node.config.ai.modelNameRequired') }]}
                                  className={styles.formItem}
                                >
                                  <Select
                                    className={styles.modelSelect}
                                    onChange={(value) => {
                                      form.setFieldValue('modelName', value);
                                    }}
                                  >
                                    {supportedModels.length > 0 ? (
                                      supportedModels.map((modelName) => (
                                        <Option key={modelName} value={modelName}>
                                          {modelName}
                                        </Option>
                                      ))
                                    ) : (
                                      defaultModelName && <Option value={defaultModelName}>{defaultModelName}</Option>
                                    )}
                                  </Select>
                                </Form.Item>
                              )}
                            </>
                          );
                        }}
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
                      <Form.Item label={t('node.config.ai.displayMode') || '展示方式'} className={styles.formItem}>
                        <Radio.Group
                          value={providerPickerMode}
                          onChange={(e) => setProviderPickerMode(e.target.value)}
                        >
                          <Radio.Button value="list">{t('node.config.ai.viewList') || '列表'}</Radio.Button>
                          <Radio.Button value="cards">{t('node.config.ai.viewCards') || '图片'}</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.provider')}
                        name="provider"
                        rules={[{ required: true, message: t('node.config.ai.selectProviderRequired') }]}
                        initialValue="deepseek"
                        className={styles.formItem}
                      >
                        <ProviderPicker
                          mode={providerPickerMode}
                          className={styles.modelSelect}
                          options={providerPickerOptionsCustom}
                          onChange={(value) => {
                            form.setFieldValue('provider', value);
                            const providerTemplate = providerTemplates.find(t => t.provider === value);
                            const supportedModels = providerTemplate?.supportedModels || [];
                            const defaultModelName = supportedModels[0] || '';
                            const defaultBaseUrl = providerTemplate?.defaultBaseUrl || '';
                            if (defaultModelName) form.setFieldValue('modelName', defaultModelName);
                            if (defaultBaseUrl) form.setFieldValue('baseUrl', defaultBaseUrl);
                          }}
                        />
                      </Form.Item>
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.provider !== curr?.provider}>
                        {({ getFieldValue }) => {
                          const selectedProvider = getFieldValue('provider') || 'deepseek';
                          const providerTemplate = providerTemplates.find(t => t.provider === selectedProvider);

                          // 获取支持的模型列表
                          const supportedModels = providerTemplate?.supportedModels || [];
                          const defaultModelName = supportedModels[0] || '';
                          const defaultBaseUrl = providerTemplate?.defaultBaseUrl || 'https://api.deepseek.com';

                          return (
                            <>
                              <Form.Item
                                label={t('node.config.ai.modelName')}
                                name="modelName"
                                rules={[{ required: true, message: t('node.config.ai.modelNameRequired') }]}
                                initialValue={defaultModelName}
                                className={styles.formItem}
                              >
                                {supportedModels.length > 0 ? (
                                  <Select className={styles.modelSelect}>
                                    {supportedModels.map((modelName) => (
                                      <Option key={modelName} value={modelName}>
                                        {modelName}
                                      </Option>
                                    ))}
                                  </Select>
                                ) : (
                                  <Input placeholder="模型名称" />
                                )}
                              </Form.Item>
                              <Form.Item
                                label={t('node.config.ai.apiKey')}
                                name="apiKey"
                                rules={[{ required: true, message: t('node.config.ai.apiKeyRequired') }]}
                                className={styles.formItem}
                                tooltip={t('node.config.ai.apiKeyTooltip')}
                              >
                                <Input.Password
                                  placeholder="API Key"
                                  iconRender={(visible) => (visible ? <EyeInvisibleOutlined /> : <EyeInvisibleOutlined />)}
                                />
                              </Form.Item>
                              <Form.Item
                                label={t('node.config.ai.baseUrl')}
                                name="baseUrl"
                                initialValue={defaultBaseUrl}
                                className={styles.formItem}
                                tooltip={t('node.config.ai.baseUrlTooltip')}
                              >
                                <Input placeholder={defaultBaseUrl} />
                              </Form.Item>
                            </>
                          );
                        }}
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
            <VariableTagTextArea
              rows={5}
              node={node}
              nodes={nodes}
              edges={edges}
              placeholder={t('node.config.ai.promptPlaceholder')}
              className={styles.promptTextArea}
              executionResult={executionResult}
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
      {/* 在系统预设模式且为卡片视图时，高级参数已集成在弹窗中，故此处隐藏 */}
      {!(modelMode === 'system' && providerPickerMode === 'cards') && (
      <div className={styles.advancedSection}>
        <Collapse
          ghost
          activeKey={advancedPanelActive}
          onChange={(keys) => {
            setAdvancedPanelActive(keys as string[]);
          }}
        >
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
            <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.modelMode !== curr?.modelMode || prev?.modelId !== curr?.modelId || prev?.provider !== curr?.provider || prev?.modelName !== curr?.modelName}>
              {({ getFieldValue }) => {
                const currentMode = getFieldValue('modelMode') || 'system';
                const currentModelId = getFieldValue('modelId');
                const currentProvider = getFieldValue('provider');
                const currentModelName = getFieldValue('modelName') || '';

                // 获取当前 provider
                let activeProvider: string | null = null;
                if (currentMode === 'saved' && currentModelId) {
                  const selectedModel = userModels.find(m => m.id === currentModelId);
                  activeProvider = selectedModel?.provider || null;
                } else if (currentMode === 'system' || currentMode === 'custom') {
                  activeProvider = currentProvider || null;
                }

                // 根据提供商和模型确定 maxTokens 的最大值
                let maxTokensLimit = 32768; // 默认值
                if (activeProvider === 'deepseek') {
                  // DeepSeek 不同模型有不同的限制
                  if (currentModelName.includes('reasoner')) {
                    maxTokensLimit = 65536; // deepseek-reasoner 最大 64K
                  } else {
                    maxTokensLimit = 8192; // deepseek-chat 最大 8K
                  }
                } else if (activeProvider === 'doubao') {
                  maxTokensLimit = 32768; // 豆包通常支持较大的 token 数
                } else if (activeProvider === 'zhipuai') {
                  maxTokensLimit = 131072; // 智谱AI GLM-4.7/4.6 最大支持 128K
                } else if (activeProvider === 'gemini') {
                  maxTokensLimit = 32768; // Gemini 限制
                } else if (activeProvider === 'gpt') {
                  maxTokensLimit = 131072; // GPT (OpenRouter) 通常支持更大的 token 数
                } else if (activeProvider === 'grok') {
                  maxTokensLimit = 131072; // Grok 限制
                } else if (activeProvider === 'spark') {
                  maxTokensLimit = 65535; // 讯飞星火 X1.5 最大 65535
                } else if (activeProvider === 'hunyuan') {
                  maxTokensLimit = 32768;
                } else {
                  maxTokensLimit = 32768; // 其他提供商默认值
                }

                return (
                  <Form.Item
                    label={t('node.config.ai.maxTokens')}
                    name="maxTokens"
                    initialValue={2000}
                    tooltip={t('node.config.ai.maxTokensTooltip')}
                    className={styles.formItem}
                  >
                    <InputNumber
                      min={1}
                      max={maxTokensLimit}
                      step={100}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                );
              }}
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(prev, curr) =>
              prev?.modelMode !== curr?.modelMode ||
              prev?.modelId !== curr?.modelId ||
              prev?.provider !== curr?.provider ||
              prev?.modelName !== curr?.modelName
            }>
              {({ getFieldValue }) => {
                const currentMode = getFieldValue('modelMode') || 'system';
                const currentModelId = getFieldValue('modelId');
                const currentProvider = getFieldValue('provider');

                // 获取当前 provider
                let activeProvider: string | null = null;

                if (currentMode === 'saved' && currentModelId) {
                  const selectedModel = userModels.find(m => m.id === currentModelId);
                  activeProvider = selectedModel?.provider || null;
                } else if (currentMode === 'system' || currentMode === 'custom') {
                  activeProvider = currentProvider || null;
                }

                // 获取模型配置支持
                const support = getModelConfigSupport(activeProvider);

                // 只显示当前模型支持的配置项
                return (
                  <>
                    {/* 公共配置：流式输出 */}
                    {support.stream && (
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
                    )}

                    {/* 提供商专属配置：通过注册机制动态加载 */}
                    {activeProvider && (() => {
                      const provider = providerRegistry.get(activeProvider);
                      if (provider && provider.ConfigComponent) {
                        const ConfigComponent = provider.ConfigComponent;
                        return (
                          <ConfigComponent
                            form={form}
                            node={node}
                            nodes={nodes}
                            edges={edges}
                          />
                        );
                      }
                      return null;
                    })()}
                    {support.frequencyPenalty && (
                      <Form.Item
                        label={t('node.config.ai.frequencyPenalty')}
                        name="frequencyPenalty"
                        initialValue={0}
                        tooltip={t('node.config.ai.frequencyPenaltyTooltip')}
                        className={styles.formItem}
                      >
                        <InputNumber
                          min={-2}
                          max={2}
                          step={0.1}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    )}
                    {support.presencePenalty && (
                      <Form.Item
                        label={t('node.config.ai.presencePenalty')}
                        name="presencePenalty"
                        initialValue={0}
                        tooltip={t('node.config.ai.presencePenaltyTooltip')}
                        className={styles.formItem}
                      >
                        <InputNumber
                          min={-2}
                          max={2}
                          step={0.1}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                    )}
                  </>
                );
              }}
            </Form.Item>
          </Panel>
        </Collapse>
      </div>
      )}
    </div>
  );
};

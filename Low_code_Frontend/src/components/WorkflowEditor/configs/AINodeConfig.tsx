import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Radio, Collapse, InputNumber, Tag, App, Segmented } from 'antd';
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
import { StandardProviderConfig } from '../providers/parts/StandardProviderConfig';
import { SegmentedSwitch } from '../providers/parts/SwitchPart';
import partsStyles from '../providers/parts/Parts.module.scss';

const { Option } = Select;

interface AINodeConfigProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  executionResult?: any;
}

const ModeSelector: React.FC<{
  value?: string;
  onChange?: (value: string) => void;
  t: any;
}> = ({ value, onChange, t }) => {
  const options = React.useMemo(() => [
    {
      value: 'system',
      label: (
        <div className={styles.modeLabel}>
          <SettingOutlined />
          <span>{t('node.config.ai.systemPreset')}</span>
        </div>
      ),
    },
    {
      value: 'saved',
      label: (
        <div className={styles.modeLabel}>
          <DatabaseOutlined />
          <span>{t('node.config.ai.savedModel')}</span>
        </div>
      ),
    },
    {
      value: 'custom',
      label: (
        <div className={styles.modeLabel}>
          <KeyOutlined />
          <span>{t('node.config.ai.customConfig')}</span>
        </div>
      ),
    },
  ], [t]);

  return (
    <Segmented
      block
      motion={false}
      value={value}
      onChange={onChange as any}
      className={styles.modeSegmented}
      options={options}
    />
  );
};

export const AINodeConfig: React.FC<AINodeConfigProps> = ({
  node,
  nodes,
  edges,
  executionResult,
}) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [systemModels, setSystemModels] = useState<SystemPresetModel[]>([]);
  const [userModels, setUserModels] = useState<AIModel[]>([]);
  const [providerTemplates, setProviderTemplates] = useState<ProviderTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const form = Form.useFormInstance();

  // 用于跟踪当前模型配置键，避免重复切换
  const currentModelConfigKeyRef = useRef<string | null>(null);

  // 高级配置面板的展开状态
  const [advancedPanelActive, setAdvancedPanelActive] = useState<string[]>([]);

  // 从节点配置中获取模型配置存储对象
  const getModelConfigs = React.useCallback((): Record<string, any> => {
    const config = node?.data?.config || {};
    return (config.modelConfigs as Record<string, any>) || {};
  }, [node?.data?.config?.modelConfigs]);

  // 使用 useMemo 生成 modelConfigs 的序列化值，用于监听变化
  const modelConfigsKey = React.useMemo(() => {
    const modelConfigs = getModelConfigs();
    return JSON.stringify(modelConfigs);
  }, [getModelConfigs]);

  // 恢复模型配置的核心逻辑
  const restoreModelConfig = React.useCallback(() => {
    const values = form.getFieldsValue(['modelMode', 'provider', 'modelName', 'modelId']);
    const mode = values.modelMode || 'system';
    const { provider, modelName, modelId } = values;

    const configKey = getModelConfigKey(mode, provider, modelName, modelId);
    if (!configKey) return;

    const modelConfigs = getModelConfigs();
    const savedConfig = modelConfigs[configKey];

    // 如果配置键相同，但节点数据可能已更新，或者有保存的配置，则恢复
    const shouldRestore = configKey !== currentModelConfigKeyRef.current || savedConfig;
    if (!shouldRestore) return;

    if (savedConfig) {
      Object.keys(savedConfig).forEach((key) => {
        if (savedConfig[key] !== undefined) {
          form.setFieldValue(key, savedConfig[key]);
        }
      });
      if (savedConfig.provider === 'qianwen') {
        form.setFieldValue('provider', 'qwen');
      }
    } else {
      const currentProvider = provider || (mode === 'saved' && modelId
        ? userModels.find(m => m.id === modelId)?.provider
        : null);

      const support = getModelConfigSupport(currentProvider);

      // 清理不支持的字段
      if (!support.stream) form.setFieldValue('stream', undefined);
      if (!support.thinking) {
        form.setFieldValue('thinking', undefined);
        if (currentProvider === 'qwen') form.setFieldValue('enable_thinking', undefined);
      }
      if (!support.thinkingLevel) form.setFieldValue('thinkingLevel', undefined);
      if (!support.frequencyPenalty) form.setFieldValue('frequencyPenalty', undefined);
      if (!support.presencePenalty) form.setFieldValue('presencePenalty', undefined);
      if (!support.stopSequences) form.setFieldValue('stopSequences', undefined);

      // 设置默认值
      if (support.stream && form.getFieldValue('stream') === undefined) {
        form.setFieldValue('stream', false);
      }
      if (support.thinking && form.getFieldValue('thinking') === undefined) {
        if (currentProvider === 'qwen') {
          if (form.getFieldValue('enable_thinking') === undefined) form.setFieldValue('enable_thinking', false);
        } else {
          form.setFieldValue('thinking', false);
        }
      }
      if (support.thinkingLevel && form.getFieldValue('thinkingLevel') === undefined) {
        form.setFieldValue('thinkingLevel', 'medium');
      }
    }
    currentModelConfigKeyRef.current = configKey;
  }, [form, getModelConfigs, userModels]);

  // 内部逻辑组件：处理监听和副作用，不触发 AINodeConfig 全量重渲染
  const ModelConfigWatcher = React.memo(() => {
    const modelMode = Form.useWatch('modelMode', form);
    const modelId = Form.useWatch('modelId', form);
    const provider = Form.useWatch('provider', form);
    const modelName = Form.useWatch('modelName', form);

    useEffect(() => {
      // 模式或模型变化时立即尝试恢复配置
      restoreModelConfig();
    }, [modelMode, modelId, provider, modelName, modelConfigsKey, userModels]);

    useEffect(() => {
      // 初始加载时也尝试恢复配置
      restoreModelConfig();
    }, []);

    useEffect(() => {
      // 面板展开时也尝试恢复配置
      if (advancedPanelActive.includes('advanced')) {
        restoreModelConfig();
      }
    }, [advancedPanelActive]);

    return null;
  });

  const [providerPickerMode, setProviderPickerMode] = useState<ProviderPickerMode>(() => {
    if (typeof window === 'undefined') return 'cards';
    const v = window.localStorage.getItem('ai_provider_picker_mode');
    return v === 'list' ? 'list' : 'cards';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('ai_provider_picker_mode', providerPickerMode);
  }, [providerPickerMode]);

  const displayModeOptions = React.useMemo(() => [
    { label: t('node.config.ai.viewCards') || '图片', value: 'cards' },
    { label: t('node.config.ai.viewList') || '列表', value: 'list' },
  ], [t]);

  const providerPickerOptionsCustom = React.useMemo<ProviderPickerOption[]>(
    () => {
      const allProviders = providerRegistry.getAll();
      const priority = ['deepseek', 'doubao', 'qwen', 'hunyuan', 'spark', 'zhipuai', 'gemini', 'gpt', 'grok'];
      const sorted = [...allProviders].sort((a, b) => {
        const pA = a.name.toLowerCase();
        const pB = b.name.toLowerCase();
        const indexA = priority.indexOf(pA);
        const indexB = priority.indexOf(pB);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return (a.displayName || a.name).localeCompare(b.displayName || b.name);
      });
      return sorted.map(p => ({
        value: p.name,
        title: p.displayName || p.name,
        icon: <ProviderIcon provider={p.name} size={18} />
      }));
    },
    [],
  );

  const providerPickerOptionsSystem = React.useMemo<ProviderPickerOption[]>(() => {
    const seen = new Set<string>();
    const opts: ProviderPickerOption[] = [];
    for (const m of systemModels) {
      if (seen.has(m.provider)) continue;
      seen.add(m.provider);
      const providerReg = providerRegistry.get(m.provider);
      opts.push({
        value: m.provider,
        title: providerReg?.displayName || m.name,
        icon: <ProviderIcon provider={m.provider} size={18} />,
      });
    }
    return opts;
  }, [systemModels]);

  // 初始化加载数据
  useEffect(() => {
    const loadData = async () => {
      try {
        const [models, templates] = await Promise.all([
          aiApi.getSystemPresetModels(),
          aiApi.getProviderTemplates(),
        ]);
        setSystemModels(models);
        setProviderTemplates(templates);
      } catch (error) { }
    };
    loadData();
  }, []);

  // 加载用户模型
  const loadUserModels = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const response = await aiApi.getModels({ page: 1, pageSize: 100 });
      setUserModels(response.list || []);
      
      // 如果节点已配置了已保存模型，自动设置 provider 和 modelName
      const modelId = form.getFieldValue('modelId');
      if (modelId) {
        const selectedModel = response.list?.find(m => m.id === modelId);
        if (selectedModel) {
          // 设置 provider（用于更新节点图标）
          if (!form.getFieldValue('provider')) {
            form.setFieldValue('provider', selectedModel.provider);
          }
          // 如果模型不是 __provider_default__，设置 modelName
          if (selectedModel.modelName !== '__provider_default__' && !form.getFieldValue('modelName')) {
            form.setFieldValue('modelName', selectedModel.modelName);
          }
        }
      }
    } catch (error) {
      message.error(t('node.config.ai.loadUserModelsFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (node?.data?.config?.modelMode === 'saved') {
      loadUserModels();
    }
  }, [node]);

  return (
    <div className={styles.configContainer}>
      <ModelConfigWatcher />
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
          <ModeSelector t={t} />
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
                        <Segmented
                          block
                          motion={false}
                          value={providerPickerMode}
                          onChange={(val) => setProviderPickerMode(val as ProviderPickerMode)}
                          className={partsStyles.segmentedControl}
                          options={displayModeOptions}
                        />
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
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.provider !== curr?.provider || prev?.modelName !== curr?.modelName}>
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
                                    form={form}
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
                      <Form.Item label={t('node.config.ai.displayMode') || '展示方式'} className={styles.formItem}>
                        <Segmented
                          block
                          motion={false}
                          value={providerPickerMode}
                          onChange={(val) => setProviderPickerMode(val as ProviderPickerMode)}
                          className={partsStyles.segmentedControl}
                          options={displayModeOptions}
                        />
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.selectModel')}
                        name="modelId"
                        rules={[{ required: true, message: t('node.config.ai.selectSavedModelRequired') }]}
                        className={styles.formItem}
                        style={providerPickerMode === 'cards' ? { display: 'none' } : {}}
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
                          onChange={(value) => {
                            form.setFieldValue('modelId', value);
                            // 保存 provider 到配置中，以便更新节点图标
                            const selectedModel = userModels.find(m => m.id === value);
                            if (selectedModel) {
                              form.setFieldValue('provider', selectedModel.provider);
                              // 如果选择的模型是 __provider_default__，清空 modelName 让用户重新选择
                              if (selectedModel.modelName === '__provider_default__') {
                                form.setFieldValue('modelName', undefined);
                              } else {
                                form.setFieldValue('modelName', selectedModel.modelName);
                              }
                            }
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
                                <ProviderIcon provider={model.provider} size={16} />
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
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.modelId !== curr?.modelId || prev?.modelName !== curr?.modelName}>
                        {({ getFieldValue }) => {
                          const selectedModelId = getFieldValue('modelId');
                          const selectedModel = userModels.find(m => m.id === selectedModelId);
                          const isProviderDefault = selectedModel?.modelName === '__provider_default__';
                          const supportedModels = selectedModel?.supportedModels || [];
                          const currentModelName = getFieldValue('modelName');
                          const providerTemplate = providerTemplates.find(t => t.provider === selectedModel?.provider);

                          // 调试信息（开发环境）
                          if (process.env.NODE_ENV === 'development' && selectedModel) {
                            console.log('Selected model:', selectedModel);
                            console.log('Is provider default:', isProviderDefault);
                            console.log('Supported models:', supportedModels);
                          }

                          return (
                            <>
                              {providerPickerMode === 'cards' && selectedModel ? (
                                <>
                                  <div className={styles.label}>{t('node.config.ai.modelName')}</div>
                                  <AIModelConfigPopup
                                    form={form}
                                    value={selectedModel.provider}
                                    onChange={(val) => {
                                      // 卡片模式下，用户选择的是已保存的模型，不应该改变 provider
                                      // 这里只是为了兼容 AIModelConfigPopup 的接口
                                      // 但确保 provider 被设置
                                      form.setFieldValue('provider', selectedModel.provider);
                                    }}
                                    options={[{
                                      value: selectedModel.provider,
                                      title: selectedModel.name,
                                      icon: <ProviderIcon provider={selectedModel.provider} size={18} />
                                    }]}
                                    supportedModels={isProviderDefault ? supportedModels : []}
                                    currentModelName={currentModelName || selectedModel.modelName}
                                    onModelChange={(val) => {
                                      form.setFieldValue('modelName', val);
                                      // 确保 provider 也被设置
                                      form.setFieldValue('provider', selectedModel.provider);
                                    }}
                                    onOpen={() => {
                                      restoreModelConfig();
                                      // 打开时确保 provider 被设置
                                      if (selectedModel) {
                                        form.setFieldValue('provider', selectedModel.provider);
                                        if (!isProviderDefault && selectedModel.modelName) {
                                          form.setFieldValue('modelName', selectedModel.modelName);
                                        }
                                      }
                                    }}
                                    trigger={
                                      <div className={styles.triggerCard}>
                                        <div className={styles.triggerCardIcon}>
                                          <ProviderIcon provider={selectedModel.provider} size={24} />
                                        </div>
                                        <div className={styles.triggerCardContent}>
                                          <div className={styles.triggerCardTitle}>
                                            {selectedModel.name}
                                          </div>
                                          <div className={styles.triggerCardDesc}>
                                            {isProviderDefault
                                              ? (currentModelName || '请选择模型版本')
                                              : (selectedModel.modelName || '请选择模型')}
                                          </div>
                                        </div>
                                        <div className={styles.triggerCardAction}>
                                          <SettingOutlined />
                                        </div>
                                      </div>
                                    }
                                  />
                                  {/* 隐藏字段以确保 Form 数据同步 */}
                                  <Form.Item name="provider" style={{ display: 'none' }}>
                                    <Input />
                                  </Form.Item>
                                  <Form.Item name="modelName" style={{ display: 'none' }} rules={[{ required: true }]}>
                                    <Input />
                                  </Form.Item>
                                </>
                              ) : (
                                <>
                                  {/* 当选择的模型是 __provider_default__ 时，显示子模型选择器 */}
                                  {isProviderDefault && supportedModels.length > 0 && (
                                    <Form.Item
                                      label={t('node.config.ai.modelName') || '模型版本'}
                                      name="modelName"
                                      rules={[{ required: true, message: t('node.config.ai.modelNameRequired') || '请选择模型版本' }]}
                                      className={styles.formItem}
                                    >
                                      <Select
                                        className={styles.modelSelect}
                                        placeholder={t('node.config.ai.selectModelVersion') || '请选择模型版本'}
                                        onChange={(value) => {
                                          form.setFieldValue('modelName', value);
                                        }}
                                      >
                                        {supportedModels.map((modelName) => (
                                          <Option key={modelName} value={modelName}>
                                            {modelName}
                                          </Option>
                                        ))}
                                      </Select>
                                    </Form.Item>
                                  )}
                                </>
                              )}
                            </>
                          );
                        }}
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
                        <Segmented
                          block
                          value={providerPickerMode}
                          onChange={(val) => setProviderPickerMode(val as ProviderPickerMode)}
                          className={partsStyles.segmentedControl}
                          options={displayModeOptions}
                        />
                      </Form.Item>
                      <Form.Item
                        label={t('node.config.ai.provider')}
                        name="provider"
                        rules={[{ required: true, message: t('node.config.ai.selectProviderRequired') }]}
                        initialValue="deepseek"
                        className={styles.formItem}
                        style={providerPickerMode === 'cards' ? { display: 'none' } : {}}
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
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.provider !== curr?.provider || prev?.modelName !== curr?.modelName}>
                        {({ getFieldValue }) => {
                          const selectedProvider = getFieldValue('provider') || 'deepseek';
                          const providerTemplate = providerTemplates.find(t => t.provider === selectedProvider);

                          // 获取支持的模型列表
                          const supportedModels = providerTemplate?.supportedModels || [];
                          const defaultModelName = supportedModels[0] || '';
                          const currentModelName = getFieldValue('modelName');
                          const defaultBaseUrl = providerTemplate?.defaultBaseUrl || 'https://api.deepseek.com';

                          return (
                            <>
                              {providerPickerMode === 'cards' ? (
                                <>
                                  <div className={styles.label}>{t('node.config.ai.modelName')}</div>
                                  <AIModelConfigPopup
                                    form={form}
                                    value={selectedProvider}
                                    showConnectionParams={true}
                                    onChange={(val) => {
                                      form.setFieldValue('provider', val);
                                      const template = providerTemplates.find(t => t.provider === val);
                                      const defaultName = template?.supportedModels[0] || '';
                                      const defaultUrl = template?.defaultBaseUrl || '';
                                      if (defaultName) form.setFieldValue('modelName', defaultName);
                                      if (defaultUrl) form.setFieldValue('baseUrl', defaultUrl);
                                    }}
                                    options={providerPickerOptionsCustom}
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
                                            {providerTemplate?.name || selectedProvider}
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
                              )}
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
      {/* 在系统预设模式或自定义配置模式且为卡片视图时，高级参数已集成在弹窗中，故此处隐藏 */}
      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.modelMode !== curr?.modelMode}>
        {({ getFieldValue }) => {
          const modelMode = getFieldValue('modelMode') || 'system';
          if (providerPickerMode === 'cards' && (modelMode === 'system' || modelMode === 'custom')) {
            return null;
          }

          return (
            <div className={styles.advancedSection}>
              <Collapse
                activeKey={advancedPanelActive}
                onChange={(keys) => {
                  setAdvancedPanelActive(keys as string[]);
                }}
                items={[{
                  key: 'advanced',
                  label: t('node.config.ai.advancedParams'),
                  children: (
                    <>
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

                          const providerReg = activeProvider ? providerRegistry.get(activeProvider) : null;

                          // 新架构：如果提供商定义了配置项列表，直接使用 StandardProviderConfig
                          if (providerReg?.configuration) {
                            return <StandardProviderConfig form={form} options={providerReg.configuration} />;
                          }

                          // 旧架构：使用硬编码逻辑 + ConfigComponent

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

                          const support = getModelConfigSupport(activeProvider);

                          return (
                            <>
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
                                  max={maxTokensLimit}
                                  step={100}
                                  style={{ width: '100%' }}
                                />
                              </Form.Item>

                              {/* 公共配置：流式输出 */}
                              {support.stream && (
                                <Form.Item
                                  label={t('node.config.ai.stream')}
                                  name="stream"
                                  initialValue={false}
                                  tooltip={t('node.config.ai.streamTooltip')}
                                  className={styles.formItem}
                                >
                                  <SegmentedSwitch />
                                </Form.Item>
                              )}

                              {/* 提供商专属配置：通过注册机制动态加载 */}
                              {providerReg && providerReg.ConfigComponent && (
                                <providerReg.ConfigComponent
                                  form={form}
                                  node={node}
                                  nodes={nodes}
                                  edges={edges}
                                />
                              )}
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
                    </>
                  ),
                }]}
              />
            </div>
          );
        }}
      </Form.Item>
    </div>
  );
};

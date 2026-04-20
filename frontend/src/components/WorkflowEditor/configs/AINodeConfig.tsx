import React, { useState, useEffect, useRef } from 'react';
import { Form, Input, Select, Collapse, InputNumber, Tag, App, Segmented } from 'antd';
import { useTranslation } from 'react-i18next';
import { Node, Edge } from 'reactflow';
import { VariableSelectField, VariableTagTextArea } from '../variables';
import { AITooltips } from '../utils/configTooltips';
import { aiApi } from '@/api/ai';
import type { AIModel, ModelCapability, SystemPresetModel, ProviderTemplate } from '@/types/ai';
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
  getMaxTokensLimitFromCapability,
  getMaxTokensLimitFallback,
  filterProviderOptionsBySupport,
} from './modelConfigSupport';
// 导入 providers 以触发注册
import '../providers';
import { providerRegistry } from '../providers';
import { AIModelConfigPopup } from './AIModelConfigPopup';
import { AIIcon } from '../../Icons/AIIcon';
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
      motion={undefined}
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

  // 按需加载：当前展示的 provider+model 对应的能力（点哪个模型加载哪个，减轻负载）
  const [currentCapability, setCurrentCapability] = useState<ModelCapability | null>(null);
  const [capabilityKey, setCapabilityKey] = useState<string>('');
  const capabilityCacheRef = useRef<Record<string, ModelCapability | null>>({});

  // 用于跟踪当前模型配置键，避免重复切换
  const currentModelConfigKeyRef = useRef<string | null>(null);

  // 当前展示的 provider / modelName（用于按需拉取能力）
  const watchedModelMode = Form.useWatch('modelMode', form) || 'system';
  const watchedModelId = Form.useWatch('modelId', form);
  const watchedProvider = Form.useWatch('provider', form);
  const watchedModelName = Form.useWatch('modelName', form);
  const activeProviderForFetch = watchedModelMode === 'saved' && watchedModelId
    ? (userModels.find(m => m.id === watchedModelId)?.provider ?? watchedProvider)
    : watchedProvider;
  const activeModelNameForFetch = watchedModelMode === 'saved' && watchedModelId
    ? (() => {
        const m = userModels.find(m => m.id === watchedModelId);
        return m?.modelName === '__provider_default__' ? (watchedModelName ?? '') : (m?.modelName ?? '');
      })()
    : (watchedModelName ?? '');

  // 点哪个模型就拉取哪个模型的能力，拉完后更新 state 并触发高级参数区重渲染
  useEffect(() => {
    if (!activeProviderForFetch || !activeModelNameForFetch) {
      setCapabilityKey('');
      setCurrentCapability(null);
      return;
    }
    const key = `${activeProviderForFetch}|${activeModelNameForFetch}`;
    if (capabilityCacheRef.current[key] !== undefined) {
      setCurrentCapability(capabilityCacheRef.current[key]);
      setCapabilityKey(key);
      return;
    }
    let cancelled = false;
    aiApi.getModelCapability(activeProviderForFetch, activeModelNameForFetch).then((cap) => {
      if (cancelled) return;
      capabilityCacheRef.current[key] = cap ?? null;
      setCurrentCapability(cap ?? null);
      setCapabilityKey(key);
      form.setFieldValue('_capabilityVersion', Date.now());
    });
    return () => { cancelled = true; };
  }, [activeProviderForFetch, activeModelNameForFetch, form]);

  // 高级配置面板的展开状态
  const [advancedPanelActive, setAdvancedPanelActive] = useState<string[]>([]);

  const getDisplayModelLabel = React.useCallback((provider?: string | null, modelName?: string | null) => {
    if (!modelName) return '';
    const templateModel = providerTemplates
      .find((item) => item.provider === provider)
      ?.models?.find((item) => item.modelName === modelName);
    if (templateModel?.displayName) return templateModel.displayName;
    const templateDisplayName = providerTemplates.find((item) => item.provider === provider)?.modelDisplayNames?.[modelName];
    if (templateDisplayName) return templateDisplayName;
    return (
      systemModels.find((item) => item.provider === provider && item.modelName === modelName)?.name ||
      userModels.find((item) => item.provider === provider && item.modelName === modelName)?.name ||
      modelName
    );
  }, [providerTemplates, systemModels, userModels]);

  const getProviderDisplayLabel = React.useCallback((provider?: string | null, fallbackName?: string | null) => {
    if (!provider) return fallbackName || '';
    const templateName = providerTemplates.find((item) => item.provider === provider)?.name;
    if (templateName) return templateName;
    const providerReg = providerRegistry.get(provider);
    return providerReg?.displayName || fallbackName || provider;
  }, [providerTemplates]);

  const getTemplateModelIcon = React.useCallback((provider?: string | null, modelName?: string | null) => {
    if (!provider || !modelName) return undefined;
    const templateModel = providerTemplates
      .find((item) => item.provider === provider)
      ?.models?.find((item) => item.modelName === modelName);
    if (templateModel?.modelIcon) return templateModel.modelIcon;
    const iconKey = providerTemplates.find((item) => item.provider === provider)?.modelIcons?.[modelName];
    return iconKey || undefined;
  }, [providerTemplates]);

  const syncIconFields = React.useCallback((params?: {
    mode?: string;
    provider?: string | null;
    modelName?: string | null;
    modelId?: number | null;
  }) => {
    const mode = params?.mode ?? form.getFieldValue('modelMode') ?? 'system';
    const modelId = params?.modelId ?? form.getFieldValue('modelId');
    const provider = params?.provider ?? form.getFieldValue('provider');
    const modelName = params?.modelName ?? form.getFieldValue('modelName');

    const setIcons = (providerIcon?: string, modelIcon?: string) => {
      form.setFieldValue('providerIcon', providerIcon || undefined);
      form.setFieldValue('modelIcon', modelIcon || undefined);
    };

    if (mode === 'saved' && modelId) {
      const selectedModel = userModels.find((item) => item.id === modelId);
      const effectiveModelName = selectedModel?.modelName === '__provider_default__' ? modelName : selectedModel?.modelName;
      setIcons(
        selectedModel?.providerIcon,
        getTemplateModelIcon(selectedModel?.provider, effectiveModelName) || selectedModel?.modelIcon,
      );
      return;
    }

    const providerTemplate = provider
      ? providerTemplates.find((item) => item.provider === provider)
      : undefined;

    if (mode === 'system') {
      const matchedSystemModel = systemModels.find((item) => item.provider === provider && item.modelName === modelName)
        || systemModels.find((item) => item.provider === provider);
      setIcons(
        matchedSystemModel?.providerIcon || providerTemplate?.icon,
        matchedSystemModel?.modelIcon || getTemplateModelIcon(provider, modelName),
      );
      return;
    }

    if (mode === 'custom') {
      setIcons(providerTemplate?.icon, getTemplateModelIcon(provider, modelName));
      return;
    }

    setIcons(providerTemplate?.icon, undefined);
  }, [form, getTemplateModelIcon, providerTemplates, systemModels, userModels]);

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
      // 优先使用后端模板（数据库驱动），避免仍然依赖前端写死的 providerRegistry
      if (Array.isArray(providerTemplates) && providerTemplates.length > 0) {
        const priority = ['deepseek', 'doubao', 'qwen', 'hunyuan', 'spark', 'zhipuai', 'claude', 'gemini', 'gpt', 'grok', 'openai'];
        const sorted = [...providerTemplates].sort((a, b) => {
          const pA = (a.provider || '').toLowerCase();
          const pB = (b.provider || '').toLowerCase();
          const indexA = priority.indexOf(pA);
          const indexB = priority.indexOf(pB);
          if (indexA !== -1 && indexB !== -1) return indexA - indexB;
          if (indexA !== -1) return -1;
          if (indexB !== -1) return 1;
          return (a.name || a.provider).localeCompare(b.name || b.provider);
        });

        return sorted.map(tpl => ({
          value: tpl.provider,
          title: tpl.name || tpl.provider,
          icon: <AIIcon iconKey={tpl.icon} fallbackProvider={tpl.provider} size={18} />,
        }));
      }

      // fallback：老版本/接口失败时回退到前端注册表
      const allProviders = providerRegistry.getAll();
      const priority = ['deepseek', 'doubao', 'qwen', 'hunyuan', 'spark', 'zhipuai', 'claude', 'gemini', 'gpt', 'grok', 'openai'];
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
        icon: <AIIcon fallbackProvider={p.name} size={18} />
      }));
    },
    [providerTemplates],
  );

  const providerPickerOptionsSystem = React.useMemo<ProviderPickerOption[]>(() => {
    const seen = new Set<string>();
    const opts: ProviderPickerOption[] = [];
    for (const m of systemModels) {
      if (seen.has(m.provider)) continue;
      seen.add(m.provider);
      opts.push({
        value: m.provider,
        title: getProviderDisplayLabel(m.provider, m.name),
        icon: <AIIcon iconKey={m.providerIcon} fallbackProvider={m.provider} size={18} />,
      });
    }
    return opts;
  }, [getProviderDisplayLabel, systemModels]);

  // 初始化加载数据（模板含 modelCapabilities，加载后需触发高级参数区重渲染）
  useEffect(() => {
    const loadData = async () => {
      try {
        const [models, templates] = await Promise.all([
          aiApi.getSystemPresetModels(),
          aiApi.getProviderTemplates(),
        ]);
        setSystemModels(models);
        setProviderTemplates(templates);
        // 触发表单 shouldUpdate，使依赖 providerTemplates 的高级参数区用最新能力重新渲染
        form.setFieldValue('_capabilityVersion', Date.now());
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

  useEffect(() => {
    syncIconFields();
  }, [syncIconFields, watchedModelMode, watchedModelId, watchedProvider, watchedModelName]);

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
        <Form.Item name="providerIcon" style={{ display: 'none' }}>
          <Input />
        </Form.Item>
        <Form.Item name="modelIcon" style={{ display: 'none' }}>
          <Input />
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
                          motion={undefined}
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
                            syncIconFields({ mode: 'system', provider: value, modelName: defaultModelName || undefined });
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
                                      syncIconFields({ mode: 'system', provider: val, modelName: defaultName || undefined });
                                    }}
                                    options={providerPickerOptionsSystem}
                                    supportedModels={supportedModels}
                                    getModelLabel={(model) => getDisplayModelLabel(selectedProvider, model)}
                                    currentModelName={currentModelName}
                                    onModelChange={(val) => {
                                      form.setFieldValue('modelName', val);
                                      syncIconFields({ mode: 'system', provider: selectedProvider, modelName: val });
                                    }}
                                    onOpen={() => restoreModelConfig()}
                                    trigger={
                                  <div className={styles.triggerCard}>
                                    <div className={styles.triggerCardIcon}>
                                          <AIIcon
                                            iconKey={
                                              getTemplateModelIcon(selectedProvider, currentModelName || defaultModelName)
                                              || selectedSystemModel?.modelIcon
                                              || selectedSystemModel?.providerIcon
                                              || providerTemplate?.icon
                                            }
                                            fallbackProvider={selectedProvider}
                                            size={24}
                                          />
                                    </div>
                                        <div className={styles.triggerCardContent}>
                                          <div className={styles.triggerCardTitle}>
                                            {getProviderDisplayLabel(selectedProvider, selectedSystemModel?.provider)}
                                          </div>
                                          <div className={styles.triggerCardDesc}>
                                            {getDisplayModelLabel(selectedProvider, currentModelName || defaultModelName) || '请选择模型'}
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
                                      syncIconFields({ mode: 'system', provider: selectedProvider, modelName: value });
                                    }}
                                  >
                                    {supportedModels.length > 0 ? (
                                      supportedModels.map((modelName) => (
                                        <Option key={modelName} value={modelName}>
                                          {getDisplayModelLabel(selectedProvider, modelName)}
                                        </Option>
                                      ))
                                    ) : (
                                      defaultModelName && <Option value={defaultModelName}>{getDisplayModelLabel(selectedProvider, defaultModelName)}</Option>
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
                          motion={undefined}
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
                              syncIconFields({
                                mode: 'saved',
                                modelId: value,
                                provider: selectedModel.provider,
                                modelName: selectedModel.modelName === '__provider_default__' ? undefined : selectedModel.modelName,
                              });
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
                                <AIIcon
                                  iconKey={
                                    getTemplateModelIcon(
                                      model.provider,
                                      model.modelName === '__provider_default__' ? undefined : model.modelName,
                                    ) || model.modelIcon || model.providerIcon
                                  }
                                  fallbackProvider={model.provider}
                                  size={16}
                                />
                                <Tag color="green" className={styles.optionTag} title={model.name}>
                                  {model.name}
                                </Tag>
                                <span className={styles.optionText} title={`${model.provider} / ${model.modelName}`}>
                                  {model.provider} / {model.name || getDisplayModelLabel(model.provider, model.modelName)}
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
                          return (
                            <>
                              {providerPickerMode === 'cards' && selectedModel ? (
                                <>
                                  <div className={styles.label}>{t('node.config.ai.modelName')}</div>
                                  <AIModelConfigPopup
                                    form={form}
                                    value={selectedModel.provider}
                                    onChange={() => {
                                      // 卡片模式下，用户选择的是已保存的模型，不应该改变 provider
                                      // 这里只是为了兼容 AIModelConfigPopup 的接口
                                      // 但确保 provider 被设置
                                      form.setFieldValue('provider', selectedModel.provider);
                                      syncIconFields({
                                        mode: 'saved',
                                        modelId: selectedModel.id,
                                        provider: selectedModel.provider,
                                        modelName: currentModelName || selectedModel.modelName,
                                      });
                                    }}
                                    options={[{
                                      value: selectedModel.provider,
                                      title: selectedModel.name,
                                      icon: (
                                        <AIIcon
                                          iconKey={
                                            getTemplateModelIcon(
                                              selectedModel.provider,
                                              isProviderDefault ? currentModelName : selectedModel.modelName,
                                            ) || selectedModel.modelIcon || selectedModel.providerIcon
                                          }
                                          fallbackProvider={selectedModel.provider}
                                          size={18}
                                        />
                                      )
                                    }]}
                                    supportedModels={isProviderDefault ? supportedModels : []}
                                    getModelLabel={(model) => getDisplayModelLabel(selectedModel.provider, model)}
                                    currentModelName={currentModelName || selectedModel.modelName}
                                    onModelChange={(val) => {
                                      form.setFieldValue('modelName', val);
                                      // 确保 provider 也被设置
                                      form.setFieldValue('provider', selectedModel.provider);
                                      syncIconFields({
                                        mode: 'saved',
                                        modelId: selectedModel.id,
                                        provider: selectedModel.provider,
                                        modelName: val,
                                      });
                                    }}
                                    onOpen={() => {
                                      restoreModelConfig();
                                      // 打开时确保 provider 被设置
                                      if (selectedModel) {
                                        form.setFieldValue('provider', selectedModel.provider);
                                        if (!isProviderDefault && selectedModel.modelName) {
                                          form.setFieldValue('modelName', selectedModel.modelName);
                                        }
                                        syncIconFields({
                                          mode: 'saved',
                                          modelId: selectedModel.id,
                                          provider: selectedModel.provider,
                                          modelName: !isProviderDefault ? selectedModel.modelName : currentModelName,
                                        });
                                      }
                                    }}
                                    trigger={
                                      <div className={styles.triggerCard}>
                                        <div className={styles.triggerCardIcon}>
                                          <AIIcon
                                            iconKey={
                                              getTemplateModelIcon(
                                                selectedModel.provider,
                                                isProviderDefault ? currentModelName : selectedModel.modelName,
                                              ) || selectedModel.modelIcon || selectedModel.providerIcon
                                            }
                                            fallbackProvider={selectedModel.provider}
                                            size={24}
                                          />
                                        </div>
                                        <div className={styles.triggerCardContent}>
                                          <div className={styles.triggerCardTitle}>
                                            {selectedModel.name}
                                          </div>
                                          <div className={styles.triggerCardDesc}>
                                            {isProviderDefault
                                              ? (getDisplayModelLabel(selectedModel.provider, currentModelName) || '请选择模型版本')
                                              : (getDisplayModelLabel(selectedModel.provider, selectedModel.modelName) || '请选择模型')}
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
                                          syncIconFields({
                                            mode: 'saved',
                                            modelId: selectedModel?.id,
                                            provider: selectedModel?.provider,
                                            modelName: value,
                                          });
                                        }}
                                      >
                                        {supportedModels.map((modelName) => (
                                          <Option key={modelName} value={modelName}>
                                            {getDisplayModelLabel(selectedModel.provider, modelName)}
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
                            syncIconFields({ mode: 'custom', provider: value, modelName: defaultModelName || undefined });
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
                                      syncIconFields({ mode: 'custom', provider: val, modelName: defaultName || undefined });
                                    }}
                                    options={providerPickerOptionsCustom}
                                    supportedModels={supportedModels}
                                    getModelLabel={(model) => getDisplayModelLabel(selectedProvider, model)}
                                    currentModelName={currentModelName}
                                    onModelChange={(val) => {
                                      form.setFieldValue('modelName', val);
                                      syncIconFields({ mode: 'custom', provider: selectedProvider, modelName: val });
                                    }}
                                    onOpen={() => restoreModelConfig()}
                                    trigger={
                                      <div className={styles.triggerCard}>
                                        <div className={styles.triggerCardIcon}>
                                          <AIIcon
                                            iconKey={getTemplateModelIcon(selectedProvider, currentModelName || defaultModelName) || providerTemplate?.icon}
                                            fallbackProvider={selectedProvider}
                                            size={24}
                                          />
                                        </div>
                                        <div className={styles.triggerCardContent}>
                                          <div className={styles.triggerCardTitle}>
                                            {providerTemplate?.name || selectedProvider}
                                          </div>
                                          <div className={styles.triggerCardDesc}>
                                            {getDisplayModelLabel(selectedProvider, currentModelName || defaultModelName) || '请选择模型'}
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
                                      <Select
                                        className={styles.modelSelect}
                                        onChange={(value) => {
                                          form.setFieldValue('modelName', value);
                                          syncIconFields({ mode: 'custom', provider: selectedProvider, modelName: value });
                                        }}
                                      >
                                        {supportedModels.map((modelName) => (
                                          <Option key={modelName} value={modelName}>
                                            {getDisplayModelLabel(selectedProvider, modelName)}
                                          </Option>
                                        ))}
                                      </Select>
                                    ) : (
                                      <Input
                                        placeholder="模型名称"
                                        onChange={() => syncIconFields({ mode: 'custom', provider: selectedProvider })}
                                      />
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
                      <Form.Item noStyle shouldUpdate={(prev, curr) => prev?.modelMode !== curr?.modelMode || prev?.modelId !== curr?.modelId || prev?.provider !== curr?.provider || prev?.modelName !== curr?.modelName || prev?._capabilityVersion !== curr?._capabilityVersion}>
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

                          // 优先用按需加载的当前模型能力（点哪个模型加载哪个）；未命中时回退到模板
                          const useFetched = capabilityKey === `${activeProvider}|${currentModelName}`;
                          const template = activeProvider ? providerTemplates.find(t => t.provider === activeProvider) : null;
                          const capability = useFetched ? currentCapability : (template?.modelCapabilities?.[currentModelName] ?? null);

                          const maxTokensLimit = capability != null
                            ? getMaxTokensLimitFromCapability(capability)
                            : getMaxTokensLimitFallback(activeProvider, currentModelName);
                          const support = getModelConfigSupport(activeProvider, capability);

                          // 新架构：如果提供商定义了配置项列表，按后端能力过滤后再渲染（数据库改 support_stream 等才会生效）
                          if (providerReg?.configuration) {
                            const filteredOptions = filterProviderOptionsBySupport(
                              providerReg.configuration,
                              support,
                              maxTokensLimit
                            );
                            return <StandardProviderConfig form={form} options={filteredOptions} />;
                          }

                          // 旧架构：使用能力配置驱动的表单项 + ConfigComponent

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

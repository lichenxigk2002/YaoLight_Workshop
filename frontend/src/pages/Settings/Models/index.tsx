import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Modal,
  Form,
  Input,
  App,
  Typography,
  InputNumber,
  Row,
  Col,
  List,
  Select,
  Tag
} from 'antd';
import {
  PlusOutlined,
  SettingOutlined,
  RightOutlined,
  SearchOutlined,
  CloudServerOutlined
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiApi } from '@/api/ai';
import { userApi } from '@/api/user';
import { useAuthStore } from '@/store/auth';
import { AIIcon, StardustIcon } from '@/components/Icons';
import SettingsPageTitle from '@/components/SettingsPageTitle';
import type { AIModel, ProviderTemplate, CreateModelRequest, SystemPresetModel } from '@/types/ai';
import styles from './index.module.scss';

const { Text } = Typography;

export default function ModelProviders() {
  const { t } = useTranslation();
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [systemModels, setSystemModels] = useState<SystemPresetModel[]>([]);
  const [templates, setTemplates] = useState<ProviderTemplate[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModelsListOpen, setIsModelsListOpen] = useState(false);
  const [isSystemModelsOpen, setIsSystemModelsOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [viewingProvider, setViewingProvider] = useState<ProviderTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [form] = Form.useForm();
  const watchedModelName = Form.useWatch('modelName', form);
  const currentModelName = watchedModelName || '__provider_default__';
  const { user, setUser } = useAuthStore();

  const getDisplayModelLabel = (provider?: string | null, modelName?: string | null) => {
    if (!modelName) return '';
    return (
      systemModels.find(item => item.provider === provider && item.modelName === modelName)?.name ||
      models.find(item => item.provider === provider && item.modelName === modelName)?.name ||
      modelName
    );
  };

  // 刷新用户信息以获取最新 Token 余额
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const userData = await userApi.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Failed to fetch user info:', error);
      }
    };
    fetchUser();
  }, [setUser]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const res = await aiApi.getModels();
      setModels(res.list);
    } catch (error: any) {
      message.error(t('workflowEditor.ai.loadUserModelsFailed'));
    } finally {
      setLoading(false);
    }
  };

  const fetchSystemModels = async () => {
    try {
      const res = await aiApi.getSystemPresetModels();
      setSystemModels(res);
    } catch (error: any) {
      console.error('Failed to fetch system preset models', error);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await aiApi.getProviderTemplates();
      setTemplates(res);
    } catch (error: any) {
      console.error('Failed to fetch provider templates', error);
    }
  };

  useEffect(() => {
    fetchModels();
    fetchSystemModels();
    fetchTemplates();
  }, []);

  // 将供应商分类：已配置、待配置
  const providerSections = useMemo(() => {
    const configured: ProviderTemplate[] = [];
    const toBeConfigured: ProviderTemplate[] = [];

    const filteredTemplates = templates.filter(t =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.provider.toLowerCase().includes(searchQuery.toLowerCase())
    );

    filteredTemplates.forEach(template => {
      const isUserConfigured = models.some(m => m.provider === template.provider);
      // 仅当用户自己配置了 Key 时，才算作“已配置”
      // 业务逻辑：每个用户都可以配置自己的模型，最初都应该是待配置
      const isConfigured = isUserConfigured;

      if (isConfigured) {
        configured.push(template);
      } else {
        // 所有未配置的都放入待配置列表
        toBeConfigured.push(template);
      }
    });

    return { configured, toBeConfigured };
  }, [templates, models, systemModels, searchQuery]);

  const handleOpenModal = (provider: string, modelName?: string) => {
    // 优先查找特定模型的配置，如果没有则查找供应商级别配置
    const specificModel = modelName ? models.find(m => m.provider === provider && m.modelName === modelName) : null;
    const providerDefault = models.find(m => m.provider === provider && m.modelName === '__provider_default__');
    const existingModel = specificModel || providerDefault;

    setEditingProvider(provider);

    if (existingModel) {
      form.setFieldsValue({
        ...existingModel,
        modelName: modelName || (existingModel.modelName === '__provider_default__' ? '__provider_default__' : existingModel.modelName),
        apiKey: '', // 不回显 API Key
      });
    } else {
      const template = templates.find(t => t.provider === provider);
      form.resetFields();
      form.setFieldsValue({
        provider,
        baseUrl: template?.defaultBaseUrl,
        name: template?.name,
        modelName: modelName || '__provider_default__', // 默认使用供应商级别
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProvider(null);
    form.resetFields();
  };

  const handleOpenModelsList = (template: ProviderTemplate) => {
    setViewingProvider(template);
    setIsModelsListOpen(true);
  };

  const handleCloseModelsList = () => {
    setIsModelsListOpen(false);
    setViewingProvider(null);
  };

  const handleSubmit = async (values: any) => {
    try {
      setLoading(true);
      // 检查是否是供应商级别的配置（modelName 为空或特殊值）
      const isProviderConfig = !values.modelName || values.modelName === '__provider_default__';

      const existingModel = models.find(m =>
        m.provider === editingProvider &&
        (isProviderConfig ? m.modelName === '__provider_default__' : m.modelName === values.modelName)
      );

      if (existingModel) {
        const updateData: any = {
          ...values,
          modelName: isProviderConfig ? '__provider_default__' : values.modelName,
        };
        // 如果 API Key 为空字符串，说明用户不想修改，不要发送该字段
        if (!values.apiKey) {
          delete updateData.apiKey;
        }
        await aiApi.updateModel(existingModel.id, updateData);
        message.success(t('dashboard.updateSuccess'));
      } else {
        const createData: CreateModelRequest = {
          ...values,
          modelName: isProviderConfig ? '__provider_default__' : values.modelName,
          // 创建时默认 active，这里不需要传 status 因为接口默认 active，但如果 createData 定义支持 status 也可以传
        };
        await aiApi.createModel(createData);
        message.success(t('dashboard.createSuccess'));
      }
      handleCloseModal();
      fetchModels();
    } catch (error: any) {
      message.error(error.message || t('common.operationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const renderProviderCard = (template: ProviderTemplate) => {
    const isUserConfigured = models.some(m => m.provider === template.provider);
    const isSystemConfigured = systemModels.some(sm => sm.provider === template.provider);
    // 仅当用户自己配置了 Key 时，才算作“已配置”
    const isConfigured = isUserConfigured;

    return (
      <div key={template.provider} className={`${styles.providerCard} ${!isConfigured ? styles.toBeConfigured : ''}`}>
        <div className={styles.cardMain}>
          <div className={styles.providerInfo}>
            <div className={styles.iconWrapper}>
              <AIIcon iconKey={template.icon} fallbackProvider={template.provider} size={24} />
            </div>
            <div className={styles.nameAndTags}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{template.name}</span>
                {isSystemConfigured && (
                  <Tag color="gold" style={{ marginLeft: '8px', borderRadius: '4px', fontSize: '10px' }}>
                    {t('workflowEditor.ai.systemPreset')}
                  </Tag>
                )}
              </div>
              <div className={styles.tags}>
                {(template.capabilities || ['LLM']).map(cap => (
                  <Tag key={cap} bordered={false} style={{ borderRadius: '4px', fontSize: '11px' }}>{cap}</Tag>
                ))}
              </div>
            </div>
          </div>
          <div className={styles.statusAndActions}>
            <div className={styles.status}>
              {isConfigured ? t('settings.authorized') : t('settings.unauthorized')}
              <div className={`${styles.dot} ${isConfigured ? styles.active : styles.error}`} />
            </div>
            <Button
              size="small"
              onClick={() => handleOpenModal(template.provider)}
              icon={<SettingOutlined />}
            >
              {isUserConfigured ? t('settings.configure') : t('settings.setup')}
            </Button>
          </div>
        </div>
        <div className={styles.cardFooter}>
          <div className={styles.expandLink} onClick={() => handleOpenModelsList(template)}>
            {t('settings.showModels')} <RightOutlined style={{ fontSize: '10px' }} />
          </div>
          <div className={styles.addLink} onClick={() => handleOpenModal(template.provider)}>
            <PlusOutlined /> {t('settings.addModel')}
          </div>
        </div>
      </div>
    );
  };

  const handleDeleteModel = async () => {
    if (!editingProvider) return;

    const modelToDelete = models.find(m => m.provider === editingProvider && m.modelName === currentModelName);

    if (!modelToDelete) {
      message.warning(t('common.operationFailed'));
      return;
    }

    modal.confirm({
      zIndex: 2000,
      title: t('common.deleteConfirm'),
      content: t('settings.deleteModelWarning'),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      okType: 'danger',
      onOk: async () => {
        try {
          setLoading(true);
          await aiApi.deleteModel(modelToDelete.id);
          message.success(t('dashboard.deleteSuccess'));
          handleCloseModal();
          fetchModels();
        } catch (error: any) {
          message.error(error.message || t('common.operationFailed'));
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <div className={styles.container}>
      <SettingsPageTitle title={t('settings.modelProviders')} />
      <div className={styles.searchRow}>
        <Input
          className={styles.searchBox}
          placeholder={t('common.search')}
          prefix={<SearchOutlined style={{ color: 'rgba(0,0,0,0.25)' }} />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {/* 星尘余额卡片 */}
      <div className={styles.quotaCard}>
        <div className={styles.quotaInfo}>
          <div className={styles.quotaLabel}>
            {t('settings.quota')}
          </div>
          <div className={styles.quotaValue}>
            {user?.token_balance?.toLocaleString() || 0} <StardustIcon size={18} style={{ marginLeft: '6px', verticalAlign: 'middle' }} />
          </div>
        </div>
      </div>

      {/* 模型列表部分 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>{t('settings.modelList')}</h3>
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={() => setIsSystemModelsOpen(true)}
          >
            {t('workflowEditor.ai.systemPreset')}
          </Button>
        </div>
        <div className={styles.cardGrid}>
          {providerSections.configured.map(t => renderProviderCard(t))}
        </div>
      </div>

      {/* 待配置部分 */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>{t('settings.toBeConfigured')}</h3>
        </div>
        <div className={styles.cardGrid}>
          {providerSections.toBeConfigured.map(t => renderProviderCard(t))}
        </div>
      </div>

      {/* 配置模态框 */}
      <Modal
        title={`${t('settings.configure')} ${editingProvider ? templates.find(t => t.provider === editingProvider)?.name : ''}`}
        open={isModalOpen}
        onCancel={handleCloseModal}
        wrapClassName={styles.configModal}
        footer={[
          <Button key="cancel" onClick={handleCloseModal}>
            {t('common.cancel')}
          </Button>,
          <Button key="submit" type="primary" loading={loading} onClick={() => form.submit()}>
            {t('common.confirm')}
          </Button>
        ]}
        width={560}
      >
        {!!models.find(m => m.provider === editingProvider && m.modelName === currentModelName) && (
          <Button
            type="link"
            danger
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDeleteModel();
            }}
            className={styles.removeConfigurationBtn}
          >
            {t('settings.removeConfiguration')}
          </Button>
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item name="provider" hidden>
            <Input />
          </Form.Item>

          <Form.Item
            name="name"
            label={t('workflowEditor.ai.modelName')}
            rules={[{ required: true, message: t('workflowEditor.ai.modelNameRequired') }]}
          >
            <Input placeholder="e.g. OpenAI Config" />
          </Form.Item>

          <Form.Item
            name="modelName"
            label={t('workflowEditor.ai.modelType')}
            tooltip={t('settings.providerLevelTooltip')}
          >
            <Select
              placeholder={t('workflowEditor.ai.selectModel')}
              allowClear
            >
              <Select.Option value="__provider_default__">{t('settings.allModels')}</Select.Option>
              {editingProvider && templates.find(t => t.provider === editingProvider)?.supportedModels?.map(model => (
                <Select.Option key={model} value={model}>{getDisplayModelLabel(editingProvider, model)}</Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="apiKey"
            label={t('workflowEditor.ai.apiKey')}
            rules={[
              // 如果是新增配置（无existingModel），或者是更新但没有已存在的Key，则必填
              // 如果是编辑模式且已有Key（后端返回空字符串），则非必填
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const modelName = getFieldValue('modelName');
                  const isProviderConfig = !modelName || modelName === '__provider_default__';

                  // 尝试找到已存在的配置
                  const existingModel = models.find(m =>
                    m.provider === editingProvider &&
                    (isProviderConfig ? m.modelName === '__provider_default__' : m.modelName === modelName)
                  );

                  // 如果是新建，必须填
                  if (!existingModel) {
                    if (!value) return Promise.reject(new Error(t('workflowEditor.ai.apiKeyRequired')));
                  }
                  // 如果是编辑，且之前没有Key（不应该发生，但为了健壮性），或者用户想清空Key（也不允许空）
                  // 注意：后端返回的APIKeyEncrypted是空的，所以existingModel.apiKey是undefined/empty
                  // 这里的逻辑是：如果不填，就代表不修改Key；如果填了，就更新Key。
                  // 但是，如果是首次创建，必须填。

                  return Promise.resolve();
                },
              }),
            ]}
          >
            <Input.Password placeholder={models.find(m => m.provider === editingProvider) ? t('settings.apiKeyPlaceholder') : "sk-..."} />
          </Form.Item>

          <Form.Item
            name="baseUrl"
            label={t('workflowEditor.ai.baseUrl')}
            tooltip={t('workflowEditor.ai.baseUrlTooltip')}
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="temperature" label={t('workflowEditor.ai.temperature')}>
                <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="maxTokens" label={t('workflowEditor.ai.maxTokens')}>
                <InputNumber min={1} max={32000} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* 模型列表模态框 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className={styles.iconWrapperSmall}>
              {viewingProvider ? <AIIcon iconKey={viewingProvider.icon} fallbackProvider={viewingProvider.provider} size={20} /> : <CloudServerOutlined />}
            </div>
            <span>{viewingProvider?.name} {t('settings.modelList')}</span>
          </div>
        }
        open={isModelsListOpen}
        onCancel={handleCloseModelsList}
        footer={null}
        width={460}
      >
        <div className={styles.modelsListContent}>
          <div className={styles.listSection}>
            <div className={styles.listHeader}>{t('workflowEditor.ai.llm')}</div>
            <List
              dataSource={viewingProvider?.supportedModels}
              renderItem={(model) => {
                const specificModel = models.find(m => m.provider === viewingProvider?.provider && m.modelName === model);
                const providerDefault = models.find(m => m.provider === viewingProvider?.provider && m.modelName === '__provider_default__');
                const systemModel = systemModels.find(sm => sm.provider === viewingProvider?.provider && sm.modelName === model);
                const isConfigured = !!(specificModel || providerDefault || systemModel);

                return (
                  <List.Item className={styles.modelItem}>
                    <div className={styles.modelInfo}>
                      <span className={styles.modelName}>{getDisplayModelLabel(viewingProvider?.provider, model)}</span>
                      <div className={styles.tags}>
                        <Tag color="blue" bordered={false}>Chat</Tag>
                        {systemModel && (
                          <Tag color="gold" bordered={false}>
                            {t('workflowEditor.ai.systemPreset')}
                          </Tag>
                        )}
                        {isConfigured && !systemModel && (
                          <Tag color="success" bordered={false}>
                            {specificModel ? t('settings.authorized') : t('settings.providerAuthorized')}
                          </Tag>
                        )}
                      </div>
                    </div>
                    <Button type="link" size="small" onClick={() => {
                      handleCloseModelsList();
                      handleOpenModal(viewingProvider!.provider, model);
                    }}>
                      {specificModel ? t('settings.configure') : t('settings.setup')}
                    </Button>
                  </List.Item>
                );
              }}
            />
          </div>
        </div>
      </Modal>

      {/* 系统预设模型模态框 */}
      <Modal
        title={t('workflowEditor.ai.systemPreset')}
        open={isSystemModelsOpen}
        onCancel={() => setIsSystemModelsOpen(false)}
        footer={null}
        width={560}
      >
        <List
          dataSource={systemModels}
          renderItem={(model) => (
            <List.Item className={styles.modelItem}>
              <div className={styles.modelInfo}>
                <div className={styles.iconWrapperSmall}>
                  <AIIcon iconKey={model.modelIcon || model.providerIcon} fallbackProvider={model.provider} size={20} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className={styles.modelName}>{model.name}</span>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {model.provider}
                  </Text>
                  {model.description && (
                    <Text type="secondary" style={{ fontSize: '11px', marginTop: '4px' }}>
                      {model.description}
                    </Text>
                  )}
                </div>
              </div>
              <Tag color="gold">{t('workflowEditor.ai.systemPreset')}</Tag>
            </List.Item>
          )}
          locale={{ emptyText: t('workflowEditor.ai.noSystemModels') }}
        />
      </Modal>
    </div>
  );
}

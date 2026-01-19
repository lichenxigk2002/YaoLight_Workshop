import { useEffect, useRef, useMemo } from 'react';
import { FormInstance } from 'antd';
import { Node } from 'reactflow';
import { workflowApi } from '@/api/workflow';
import {
  getModelConfigSupport,
  getModelConfigKey,
  filterSupportedConfig,
} from '../../configs/modelConfigSupport';

interface UseNodeConfigFormOptions {
  node: Node | null;
  form: FormInstance;
  autoTest?: boolean;
  onAutoTest?: () => void;
}

/**
 * 节点配置表单 Hook
 * 处理表单初始化、数据填充等逻辑
 */
export function useNodeConfigForm({
  node,
  form,
  autoTest = false,
  onAutoTest,
}: UseNodeConfigFormOptions) {
  // 使用 ref 跟踪当前已初始化的节点ID和配置，避免重复填充表单
  const initializedNodeIdRef = useRef<string | null>(null);
  const initializedConfigRef = useRef<string | null>(null);

  // 使用 useMemo 生成配置的序列化值，用于检测配置变化
  const configKey = useMemo(() => {
    if (!node) return null;
    return JSON.stringify(node.data.config || {});
  }, [node?.data?.config]);

  useEffect(() => {
    if (node) {
      // 如果节点ID和配置都没有变化，且不是自动测试，则跳过
      const configChanged = initializedConfigRef.current !== configKey;
      if (initializedNodeIdRef.current === node.id && !autoTest && !configChanged) {
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

      // 判断节点类型
      const nodeType = node.data?.type || node.type;
      const isAINode = nodeType === 'ai';
      const isCrawlerNode = nodeType === 'crawler';

      // 为AI节点的高级参数设置默认值（如果配置中没有）
      if (isAINode) {
        if (formConfig.temperature === undefined) {
          formConfig.temperature = 0.7;
        }
        if (formConfig.maxTokens === undefined) {
          formConfig.maxTokens = 2000;
        }
        if (formConfig.stream === undefined) {
          formConfig.stream = false;
        }
        if (formConfig.thinking === undefined) {
          formConfig.thinking = false;
        }
      }

      // 为爬虫节点设置默认值（如果配置中没有）
      if (isCrawlerNode) {
        // 如果配置中没有 useAdvanced，根据是否有高级配置内容自动判断
        if (formConfig.useAdvanced === undefined) {
          const hasAdvanced = !!(
            (formConfig.headers && typeof formConfig.headers === 'string' && formConfig.headers.trim() !== '' && formConfig.headers.trim() !== '{}') ||
            (formConfig.cookies && typeof formConfig.cookies === 'string' && formConfig.cookies.trim() !== '' && formConfig.cookies.trim() !== '{}') ||
            (formConfig.headers && typeof formConfig.headers === 'object' && Object.keys(formConfig.headers).length > 0) ||
            (formConfig.cookies && typeof formConfig.cookies === 'object' && Object.keys(formConfig.cookies).length > 0) ||
            formConfig.proxy ||
            (formConfig.timeout !== undefined && formConfig.timeout !== 30) ||
            (formConfig.retryCount !== undefined && formConfig.retryCount !== 3)
          );
          formConfig.useAdvanced = hasAdvanced;
        }
        // 设置其他默认值（如果配置中没有）
        if (formConfig.timeout === undefined) {
          formConfig.timeout = 30;
        }
        if (formConfig.retryCount === undefined) {
          formConfig.retryCount = 3;
        }
        if (formConfig.useHeadless === undefined) {
          formConfig.useHeadless = false;
        }
        if (formConfig.testCleanEnable === undefined) {
          formConfig.testCleanEnable = false;
        }
        if (formConfig.testCleanRemoveHTML === undefined) {
          formConfig.testCleanRemoveHTML = true;
        }
        if (formConfig.testCleanTrim === undefined) {
          formConfig.testCleanTrim = true;
        }
      }

      // 填充表单数据
      form.setFieldsValue({
        label: node.data.label || '',
        connectionDirection: node.data.connectionDirection || 'vertical',
        ...formConfig,
      });

      initializedNodeIdRef.current = node.id;
      initializedConfigRef.current = configKey;

      // 如果需要自动测试，则延迟触发测试
      if (autoTest && onAutoTest) {
        setTimeout(() => {
          onAutoTest();
        }, 100);
      }
    } else {
      initializedNodeIdRef.current = null;
      initializedConfigRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, configKey, autoTest]);

  /**
   * 从表单构建节点配置（不保存，仅处理配置数据）
   * 这个函数可以被测试和保存功能共享使用
   */
  const buildNodeConfig = async (validate: boolean = true): Promise<any | null> => {
    try {
      // 如果需要验证，先验证必填字段
      if (validate) {
        await form.validateFields();
      }
      // 然后获取所有字段值（包括折叠区域中的字段）
      // 注意：Collapse 只是视觉隐藏，Form.Item 仍然在 DOM 中，getFieldsValue() 可以获取到所有字段
      const values = form.getFieldsValue();
      if (!node) {
        return null;
      }

      const nodeType = node.data?.type || node.type;
      const isAINode = nodeType === 'ai';

      const config: any = { ...values };
      const existingConfig = node.data?.config || {};

      // 为AI节点处理模型配置
      if (isAINode) {
        const modelMode = config.modelMode || 'system';
        const modelId = config.modelId;
        let provider = config.provider;
        let modelName = config.modelName || '';

        // 对于已保存的模型，如果配置中没有 provider 和 modelName，尝试从节点配置中读取
        if (modelMode === 'saved' && modelId) {
          if (!provider && existingConfig.provider) {
            provider = existingConfig.provider;
            config.provider = provider;
          }
          if (!modelName && existingConfig.modelName) {
            modelName = existingConfig.modelName;
            config.modelName = modelName;
          }
        }

        // 获取当前模型配置键
        const modelConfigKey = getModelConfigKey(modelMode, provider, modelName, modelId);

        // 获取模型配置支持
        const support = getModelConfigSupport(provider);

        // 获取或创建 modelConfigs 对象
        const modelConfigs: Record<string, any> = existingConfig.modelConfigs || {};

        // 如果表单中没有高级参数的值（可能因为从未展开过面板），从节点配置中读取
        // 优先使用表单中的值，如果表单中没有，则从节点配置中读取，最后使用默认值
        if (support.temperature && config.temperature === undefined) {
          // 尝试从节点配置中读取
          if (existingConfig.temperature !== undefined) {
            config.temperature = existingConfig.temperature;
          }
        }
        if (support.maxTokens && config.maxTokens === undefined) {
          if (existingConfig.maxTokens !== undefined) {
            config.maxTokens = existingConfig.maxTokens;
          }
        }
        if (support.topP && config.topP === undefined) {
          if (existingConfig.topP !== undefined) {
            config.topP = existingConfig.topP;
          }
        }
        if (support.stream && config.stream === undefined) {
          if (existingConfig.stream !== undefined) {
            config.stream = existingConfig.stream;
          }
        }
        if (support.thinking && config.thinking === undefined) {
          if (existingConfig.thinking !== undefined) {
            config.thinking = existingConfig.thinking;
          }
        }
        if (support.thinkingLevel && config.thinkingLevel === undefined) {
          if (existingConfig.thinkingLevel !== undefined) {
            config.thinkingLevel = existingConfig.thinkingLevel;
          }
        }
        if (support.frequencyPenalty && config.frequencyPenalty === undefined) {
          if (existingConfig.frequencyPenalty !== undefined) {
            config.frequencyPenalty = existingConfig.frequencyPenalty;
          }
        }
        if (support.presencePenalty && config.presencePenalty === undefined) {
          if (existingConfig.presencePenalty !== undefined) {
            config.presencePenalty = existingConfig.presencePenalty;
          }
        }
        if (support.stopSequences && config.stopSequences === undefined) {
          if (existingConfig.stopSequences !== undefined) {
            config.stopSequences = existingConfig.stopSequences;
          }
        }
        // 通义千问使用 enable_thinking
        if (support.thinking && config.enable_thinking === undefined) {
          if (existingConfig.enable_thinking !== undefined) {
            config.enable_thinking = existingConfig.enable_thinking;
          }
        }

        // 保存当前模型的高级配置到 modelConfigs（使用处理后的值）
        const advancedConfig: Record<string, any> = {};
        if (support.temperature && config.temperature !== undefined) {
          advancedConfig.temperature = config.temperature;
        }
        if (support.maxTokens && config.maxTokens !== undefined) {
          advancedConfig.maxTokens = config.maxTokens;
        }
        if (support.topP && config.topP !== undefined) {
          advancedConfig.topP = config.topP;
        }
        if (support.stream && config.stream !== undefined) {
          advancedConfig.stream = config.stream;
        }
        if (support.thinking && config.thinking !== undefined) {
          advancedConfig.thinking = config.thinking;
        }
        if (support.thinkingLevel && config.thinkingLevel !== undefined) {
          advancedConfig.thinkingLevel = config.thinkingLevel;
        }
        if (support.frequencyPenalty && config.frequencyPenalty !== undefined) {
          advancedConfig.frequencyPenalty = config.frequencyPenalty;
        }
        if (support.presencePenalty && config.presencePenalty !== undefined) {
          advancedConfig.presencePenalty = config.presencePenalty;
        }
        if (support.stopSequences && config.stopSequences !== undefined) {
          advancedConfig.stopSequences = config.stopSequences;
        }
        // 通义千问使用 enable_thinking
        if (support.thinking && config.enable_thinking !== undefined) {
          advancedConfig.enable_thinking = config.enable_thinking;
        }

        // 保存到 modelConfigs
        if (modelConfigKey) {
          modelConfigs[modelConfigKey] = advancedConfig;
        }

        // 在配置中保存 modelConfigs
        config.modelConfigs = modelConfigs;

        // 过滤配置，只保留当前模型支持的参数
        const filteredConfig = filterSupportedConfig(config, support);

        // 为支持的参数设置默认值（如果为 undefined）
        if (support.temperature && filteredConfig.temperature === undefined) {
          filteredConfig.temperature = 0.7;
        }
        if (support.maxTokens && filteredConfig.maxTokens === undefined) {
          filteredConfig.maxTokens = 2000;
        }
        if (support.stream && filteredConfig.stream === undefined) {
          filteredConfig.stream = false;
        }
        if (support.thinking && filteredConfig.thinking === undefined) {
          filteredConfig.thinking = false;
        }
        // 通义千问使用 enable_thinking 而不是 thinking
        if (support.thinking && filteredConfig.enable_thinking === undefined) {
          filteredConfig.enable_thinking = false;
        }
        if (support.thinkingLevel && filteredConfig.thinkingLevel === undefined) {
          filteredConfig.thinkingLevel = 'medium'; // 豆包默认使用 medium 模式
        }

        // 使用过滤后的配置
        Object.assign(config, filteredConfig);
      }

      const parseJsonField = (field: string) => {
        const v = config[field];
        if (typeof v === 'string') {
          const s = v.trim();
          if (s.startsWith('{') && s.endsWith('}')) {
            try {
              config[field] = JSON.parse(s);
            } catch {
              // 解析失败，保持原值
            }
          }
        }
      };
      parseJsonField('headers');
      parseJsonField('cookies');

      // 删除节点级别的属性
      delete config.label;
      delete config.connectionDirection;

      return config;
    } catch (error) {
      return null;
    }
  };

  /**
   * 处理保存逻辑
   */
  const handleSave = async (
    onSave: (nodeId: string, config: any) => void,
    onSaveToBackend?: () => Promise<boolean>,
    workflowId?: string,
    validate: boolean = true,
  ) => {
    try {
      // 使用 buildNodeConfig 构建配置（已经处理了所有配置逻辑，包括AI节点模型配置、JSON字段解析等）
      const config = await buildNodeConfig(validate);
      if (!config || !node) {
        return false;
      }

      const values = form.getFieldsValue();
      const nodeType = node.data?.type || node.type;

      // 先更新本地状态
      onSave(node.id, {
        label: values.label,
        connectionDirection: values.connectionDirection || 'vertical',
        config: config,
      });

      // 如果提供了 workflowId，保存单个节点到后端
      if (workflowId) {
        try {
          // 构建节点数据（使用当前节点的 position）
          const nodeData = {
            id: node.id,
            type: nodeType,
            position: node.position || { x: 0, y: 0 },
            data: {
              label: values.label,
              type: nodeType,
              config: config,
              connectionDirection: values.connectionDirection || 'vertical',
            },
          };

          await workflowApi.saveWorkflowNode(Number(workflowId), node.id, nodeData);
          // 单个节点保存成功，不显示消息（避免频繁提示）
        } catch (error: any) {
          console.error('保存单个节点失败:', error);
          // 单个节点保存失败，不显示错误消息（避免干扰用户）
          // 用户可以使用面板上的保存按钮保存所有节点
        }
      } else if (onSaveToBackend) {
        // 如果没有 workflowId 但有 onSaveToBackend，使用原来的逻辑
        setTimeout(async () => {
          try {
            const saved = await onSaveToBackend();
            if (!saved) {
              // message.warning('配置已保存，但保存到后端失败，请手动保存');
            }
          } catch (error) {
            // message.warning('配置已保存，但保存到后端失败，请手动保存');
          }
        }, 100);
      }

      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    handleSave,
    buildNodeConfig, // 导出构建配置函数，供测试使用
  };
}

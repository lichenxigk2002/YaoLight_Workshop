import { useEffect, useRef } from 'react';
import { FormInstance } from 'antd';
import { Node } from 'reactflow';
import { workflowApi } from '@/api/workflow';

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
  // 使用 ref 跟踪当前已初始化的节点ID，避免重复填充表单
  const initializedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (node) {
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

      // 判断节点类型
      const nodeType = node.data?.type || node.type;
      const isAINode = nodeType === 'ai';

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

      // 填充表单数据
      form.setFieldsValue({
        label: node.data.label || '',
        connectionDirection: node.data.connectionDirection || 'vertical',
        timeout: 30,
        retryCount: 3,
        useAdvanced: hasAdvanced,
        ...formConfig,
      });

      initializedNodeIdRef.current = node.id;

      // 如果需要自动测试，则延迟触发测试
      if (autoTest && onAutoTest) {
        setTimeout(() => {
          onAutoTest();
        }, 100);
      }
    } else {
      initializedNodeIdRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, autoTest]);

  /**
   * 处理保存逻辑
   */
  const handleSave = async (onSave: (nodeId: string, config: any) => void, onSaveToBackend?: () => Promise<boolean>, workflowId?: string) => {
    try {
      // 先验证必填字段
      await form.validateFields();
      // 然后获取所有字段值（包括折叠区域中的字段）
      const values = form.getFieldsValue();
      if (node) {
        const nodeType = node.data?.type || node.type;
        const isAINode = nodeType === 'ai';

        const config = { ...values };

        // 为AI节点的高级参数确保有值（如果为undefined，使用默认值）
        if (isAINode) {
          if (config.temperature === undefined || config.temperature === null) {
            config.temperature = 0.7;
          }
          if (config.maxTokens === undefined || config.maxTokens === null) {
            config.maxTokens = 2000;
          }
          if (config.stream === undefined || config.stream === null) {
            config.stream = false;
          }
          if (config.thinking === undefined || config.thinking === null) {
            config.thinking = false;
          }
        }

        const parseJsonField = (field: string) => {
          const v = (config as any)[field];
          if (typeof v === 'string') {
            const s = v.trim();
            if (s.startsWith('{') && s.endsWith('}')) {
              try {
                (config as any)[field] = JSON.parse(s);
              } catch {
                // 解析失败，保持原值
              }
            }
          }
        };
        parseJsonField('headers');
        parseJsonField('cookies');
        delete config.label;
        delete config.connectionDirection;
        delete (config as any).testCleanEnable;
        delete (config as any).testCleanRemoveHTML;
        delete (config as any).testCleanTrim;

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
      }
    } catch (error) {
      return false;
    }
    return false;
  };

  return {
    handleSave,
  };
}


import { useEffect, useRef } from 'react';
import { FormInstance } from 'antd';
import { Node } from 'reactflow';

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

        // 等待状态更新后，再保存到后端
        if (workflowId && onSaveToBackend) {
          setTimeout(async () => {
            try {
              const saved = await onSaveToBackend();
              if (!saved) {
                // message.warning('配置已保存，但保存到后端失败，请手动保存');
              }
            } catch (error) {
              console.error('保存到后端失败:', error);
              // message.warning('配置已保存，但保存到后端失败，请手动保存');
            }
          }, 100);
        }

        return true;
      }
    } catch (error) {
      console.error('表单验证失败:', error);
      return false;
    }
    return false;
  };

  return {
    handleSave,
  };
}


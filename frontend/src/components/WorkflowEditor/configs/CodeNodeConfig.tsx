import React, { useEffect, useState } from 'react';
import { Button, Form, InputNumber, Select, Space, Switch, App } from 'antd';
import { useTranslation } from 'react-i18next';
import { aiApi, type CodeRepairResponse } from '@/api/ai';
import { ScriptCodeEditor } from '../utils/ScriptCodeEditor';
import { CodeRepairModal } from './CodeRepairModal';

interface CodeNodeConfigProps {
  lastTestResult?: any;
}

export const CodeNodeConfig: React.FC<CodeNodeConfigProps> = ({ lastTestResult }) => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const form = Form.useFormInstance();
  const language = (Form.useWatch('language', form) || 'javascript') as 'javascript' | 'python';
  const sourceValue = Form.useWatch('source', form);
  const jsSource = Form.useWatch('sourceJavascript', form);
  const pySource = Form.useWatch('sourcePython', form);
  const [repairLoading, setRepairLoading] = useState(false);
  const [repairOpen, setRepairOpen] = useState(false);
  const [repairResult, setRepairResult] = useState<CodeRepairResponse | null>(null);

  const getSourceField = (targetLanguage: 'javascript' | 'python') =>
    targetLanguage === 'javascript' ? 'sourceJavascript' : 'sourcePython';

  useEffect(() => {
    const currentSource = form?.getFieldValue('source') || '';
    const currentField = getSourceField(language);
    if (!form?.getFieldValue(currentField) && currentSource) {
      form?.setFieldValue(currentField, currentSource);
    }
  }, [form, language, jsSource, pySource]);

  useEffect(() => {
    form?.setFieldValue(getSourceField(language), sourceValue || '');
  }, [form, language, sourceValue]);

  const applyTemplate = (template: string) => {
    form?.setFieldValue('source', template);
    form?.setFieldValue(getSourceField(language), template);
  };

  const handleLanguageChange = (nextLanguage: 'javascript' | 'python') => {
    const currentSource = form?.getFieldValue('source') || '';
    form?.setFieldValue(getSourceField(language), currentSource);
    const nextSource = form?.getFieldValue(getSourceField(nextLanguage)) || '';
    form?.setFieldsValue({
      language: nextLanguage,
      source: nextSource,
    });
  };

  const handleRepair = async () => {
    const source = form?.getFieldValue('source');
    if (!source || !String(source).trim()) {
      message.warning(t('node.config.code.sourceRequired'));
      return;
    }

    try {
      setRepairLoading(true);
      const runtimeData = lastTestResult?.data || {};
      const response = await aiApi.repairCode({
        language,
        source,
        error: lastTestResult?.error,
        stdout: Array.isArray(runtimeData.stdout) ? runtimeData.stdout : [],
        stderr: Array.isArray(runtimeData.stderr) ? runtimeData.stderr : [],
        outputSample: runtimeData.result,
      });
      setRepairResult(response);
      setRepairOpen(true);
    } catch (error: any) {
      message.error(error?.message || t('node.config.code.aiRepairFailed'));
    } finally {
      setRepairLoading(false);
    }
  };

  const handleApplyRepair = () => {
    if (!repairResult?.fixedSource) return;
    form?.setFieldValue('source', repairResult.fixedSource);
    form?.setFieldValue(getSourceField(language), repairResult.fixedSource);
    setRepairOpen(false);
    message.success(t('node.config.code.aiRepairApplied'));
  };

  const templates = language === 'python'
    ? [
      {
        key: 'passthrough',
        label: t('node.config.code.templatePassthrough'),
        value: "return input",
      },
      {
        key: 'stats',
        label: t('node.config.code.templateStats'),
        value: "items = input.get('items') if isinstance(input, dict) else []\nitems = items if isinstance(items, list) else []\nreturn {\n    'total': len(items),\n    'first': items[0] if items else None,\n}",
      },
      {
        key: 'vars',
        label: t('node.config.code.templateVars'),
        value: "source = vars.get('start.data') or input\nreturn {\n    'title': source.get('title') if isinstance(source, dict) else None,\n    'summary': source.get('summary') if isinstance(source, dict) else None,\n    'source': source,\n}",
      },
    ]
    : [
      {
        key: 'passthrough',
        label: t('node.config.code.templatePassthrough'),
        value: "return input;",
      },
      {
        key: 'stats',
        label: t('node.config.code.templateStats'),
        value: "const items = Array.isArray(input?.items) ? input.items : [];\nconsole.log('items', items.length);\nreturn { total: items.length, first: items[0] ?? null };",
      },
      {
        key: 'vars',
        label: t('node.config.code.templateVars'),
        value: "const source = vars['start.data'] || input;\nreturn {\n  title: source?.title ?? null,\n  summary: source?.summary ?? null,\n  source,\n};",
      },
    ];

  return (
    <>
      <Form.Item name="language" initialValue="javascript" hidden>
        <input />
      </Form.Item>
      <Form.Item name="sourceJavascript" hidden>
        <input />
      </Form.Item>
      <Form.Item name="sourcePython" hidden>
        <input />
      </Form.Item>
      <Form.Item
        label={t('node.config.code.inputMode')}
        name="inputMode"
        initialValue="merged"
      >
        <Select
          options={[
            { value: 'merged', label: t('node.config.code.inputModeMerged') },
            { value: 'primary', label: t('node.config.code.inputModePrimary') },
          ]}
        />
      </Form.Item>

      <Form.Item
        label={t('node.config.code.timeoutMs')}
        name="timeoutMs"
        initialValue={3000}
        tooltip={t('node.config.code.timeoutTooltip')}
      >
        <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item
        label={t('node.config.code.consoleEnabled')}
        name="consoleEnabled"
        valuePropName="checked"
        initialValue={true}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        label={t('node.config.code.source')}
        name="source"
        rules={[{ required: true, message: t('node.config.code.sourceRequired') }]}
        tooltip={t('node.config.code.sourceTooltip')}
      >
        <ScriptCodeEditor
          rows={14}
          placeholder={t('node.config.code.sourcePlaceholder')}
          language={language}
          onLanguageChange={handleLanguageChange}
          onAiRepair={handleRepair}
          aiRepairLoading={repairLoading}
        />
      </Form.Item>

      <Form.Item label={t('node.config.code.templates')}>
        <Space wrap>
          {templates.map((template) => (
            <Button key={template.key} size="small" onClick={() => applyTemplate(template.value)}>
              {template.label}
            </Button>
          ))}
        </Space>
      </Form.Item>

      <CodeRepairModal
        open={repairOpen}
        onClose={() => setRepairOpen(false)}
        onApply={handleApplyRepair}
        repairResult={repairResult}
        language={language}
      />
    </>
  );
};

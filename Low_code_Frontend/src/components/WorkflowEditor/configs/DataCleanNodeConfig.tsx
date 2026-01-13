import React from 'react';
import { Form, Input, Select, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import { Node, Edge } from 'reactflow';
import { VariableSelectField } from '../variables';
import { DataCleanTooltips } from '../utils/configTooltips';

const { Option } = Select;

interface DataCleanNodeConfigProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  executionResult?: any;
}

export const DataCleanNodeConfig: React.FC<DataCleanNodeConfigProps> = ({
  node,
  nodes,
  edges,
  executionResult,
}) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label="数据变量"
        name="dataVariable"
        tooltip={DataCleanTooltips.dataVariable}
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
};


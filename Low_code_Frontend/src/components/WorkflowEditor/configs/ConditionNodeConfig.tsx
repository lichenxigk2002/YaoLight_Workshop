import React from 'react';
import { Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';
import { Node, Edge } from 'reactflow';
import { VariableSelectField } from '../variables';
import { ConditionTooltips } from '../utils/configTooltips';

const { Option } = Select;

interface ConditionNodeConfigProps {
  node: Node | null;
  nodes: Node[];
  edges: Edge[];
  executionResult?: any;
}

export const ConditionNodeConfig: React.FC<ConditionNodeConfigProps> = ({
  node,
  nodes,
  edges,
  executionResult,
}) => {
  const { t } = useTranslation();


  const needsCompareValue = (operator?: string) => {
    return operator !== 'empty' && operator !== 'notEmpty';
  };

  return (
    <>
      <Form.Item
        label={t('node.config.condition.conditionType')}
        name="conditionType"
        initialValue="equals"
      >
        <Select>
          <Option value="equals">{t('node.config.condition.equals')}</Option>
          <Option value="contains">{t('node.config.condition.contains')}</Option>
          <Option value="greater">{t('node.config.condition.greater')}</Option>
          <Option value="less">{t('node.config.condition.less')}</Option>
          <Option value="regex">{t('node.config.condition.regex')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.condition.fieldName')}
        name="field"
        rules={[{ required: true, message: t('node.config.condition.fieldNameRequired') }]}
        tooltip={t('node.config.condition.fieldNameTooltip')}
      >
        <Input placeholder="data.count" />
      </Form.Item>
      <Form.Item
        label="字段变量"
        name="fieldVariable"
        tooltip={ConditionTooltips.fieldVariable}
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="选择字段变量（可选，通常直接在上方输入字段名）"
          executionResult={executionResult}
        />
      </Form.Item>
      <Form.Item
        label={t('node.config.condition.operator')}
        name="operator"
        initialValue="=="
      >
        <Select>
          <Option value="==">{t('node.config.condition.operatorEquals')}</Option>
          <Option value="!=">{t('node.config.condition.operatorNotEquals')}</Option>
          <Option value=">">{t('node.config.condition.operatorGreater')}</Option>
          <Option value="<">{t('node.config.condition.operatorLess')}</Option>
          <Option value=">=">{t('node.config.condition.operatorGreaterEqual')}</Option>
          <Option value="<=">{t('node.config.condition.operatorLessEqual')}</Option>
          <Option value="contains">{t('node.config.condition.operatorContains')}</Option>
          <Option value="startsWith">{t('node.config.condition.operatorStartsWith')}</Option>
          <Option value="endsWith">{t('node.config.condition.operatorEndsWith')}</Option>
          <Option value="regex">{t('node.config.condition.operatorRegex')}</Option>
          <Option value="in">{t('node.config.condition.operatorIn')}</Option>
          <Option value="notIn">{t('node.config.condition.operatorNotIn')}</Option>
          <Option value="empty">{t('node.config.condition.operatorEmpty')}</Option>
          <Option value="notEmpty">{t('node.config.condition.operatorNotEmpty')}</Option>
        </Select>
      </Form.Item>

      <Form.Item
        label={t('node.config.condition.missingAs')}
        name="missingAs"
        initialValue="false"
        tooltip={t('node.config.condition.missingAsTooltip')}
      >
        <Select>
          <Option value="false">{t('node.config.condition.missingAsFalse')}</Option>
          <Option value="true">{t('node.config.condition.missingAsTrue')}</Option>
          <Option value="error">{t('node.config.condition.missingAsError')}</Option>
        </Select>
      </Form.Item>

      <Form.Item shouldUpdate noStyle>
        {({ getFieldValue }) => {
          const operator = getFieldValue('operator');
          const required = needsCompareValue(operator);
          return (
            <Form.Item
              label={t('node.config.condition.compareValue')}
              name="value"
              rules={required ? [{ required: true, message: t('node.config.condition.compareValueRequired') }] : []}
              tooltip={t('node.config.condition.compareValueTooltip')}
            >
              <Input placeholder={operator === 'in' || operator === 'notIn' ? 'a,b,c' : '100'} />
            </Form.Item>
          );
        }}
      </Form.Item>
      <Form.Item
        label="比较值变量"
        name="valueVariable"
        tooltip={ConditionTooltips.valueVariable}
      >
        <VariableSelectField
          node={node}
          nodes={nodes}
          edges={edges}
          placeholder="选择比较值变量（可选，通常直接在上方输入固定值）"
          executionResult={executionResult}
        />
      </Form.Item>
    </>
  );
};


import React from 'react';
import { Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

export const LoopNodeConfig: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.loop.loopType')}
        name="loopType"
        initialValue="foreach"
      >
        <Select>
          <Option value="foreach">{t('node.config.loop.foreach')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.loop.dataSource')}
        name="items"
        tooltip={t('node.config.loop.dataSourceTooltip')}
      >
        <Input placeholder="data.items 或 {{node-1.data.items}}" />
      </Form.Item>
    </>
  );
};


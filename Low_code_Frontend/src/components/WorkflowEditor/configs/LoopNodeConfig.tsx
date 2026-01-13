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
          <Option value="while">{t('node.config.loop.while')}</Option>
          <Option value="for">{t('node.config.loop.for')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.loop.dataSource')}
        name="items"
        tooltip={t('node.config.loop.dataSourceTooltip')}
      >
        <Input placeholder="data.items" />
      </Form.Item>
      <Form.Item
        label={t('node.config.loop.loopCondition')}
        name="condition"
      >
        <Input placeholder="data.count < 10" />
      </Form.Item>
    </>
  );
};


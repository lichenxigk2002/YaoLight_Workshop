import React from 'react';
import { Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

export const DelayNodeConfig: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.delay.delayType')}
        name="delayType"
        initialValue="fixed"
      >
        <Select>
          <Option value="fixed">{t('node.config.delay.fixed')}</Option>
          <Option value="random">{t('node.config.delay.random')}</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.delay.delayTime')}
        name="seconds"
        initialValue={1}
        rules={[{ required: true, message: t('node.config.delay.delayTimeRequired') }]}
      >
        <Input type="number" min={0} max={3600} />
      </Form.Item>
    </>
  );
};


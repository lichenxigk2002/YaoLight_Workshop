import React from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

export const OutputNodeConfig: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.output.format')}
        name="format"
        initialValue="json"
      >
        <Select>
          <Option value="json">JSON</Option>
          <Option value="csv">CSV</Option>
          <Option value="txt">TXT</Option>
        </Select>
      </Form.Item>
      <Form.Item
        label={t('node.config.output.destination')}
        name="destination"
        initialValue="file"
      >
        <Select>
          <Option value="file">{t('node.config.output.file')}</Option>
          <Option value="database">{t('node.config.output.database')}</Option>
          <Option value="api">API</Option>
        </Select>
      </Form.Item>
    </>
  );
};


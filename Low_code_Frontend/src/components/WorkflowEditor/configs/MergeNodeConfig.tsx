import React from 'react';
import { Form, Select } from 'antd';
import { useTranslation } from 'react-i18next';

const { Option } = Select;

export const MergeNodeConfig: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item label={t('node.config.merge.mergeType')} name="mergeType" initialValue="concat">
        <Select>
          <Option value="concat">{t('node.config.merge.concat')}</Option>
          <Option value="union">{t('node.config.merge.union')}</Option>
          <Option value="intersect">{t('node.config.merge.intersect')}</Option>
        </Select>
      </Form.Item>
    </>
  );
};


import React from 'react';
import { Form, Input, Select } from 'antd';
import { useTranslation } from 'react-i18next';

const { Option } = Select;
const { TextArea } = Input;

export const TransformNodeConfig: React.FC = () => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.transform.transformType')}
        name="transformType"
        initialValue="map"
      >
        <Select>
          <Option value="passthrough">{t('node.config.transform.passthrough')}</Option>
          <Option value="map">{t('node.config.transform.map')}</Option>
          <Option value="filter">{t('node.config.transform.filter')}</Option>
          <Option value="sort">{t('node.config.transform.sort')}</Option>
          <Option value="group">{t('node.config.transform.group')}</Option>
        </Select>
      </Form.Item>

      <Form.Item shouldUpdate noStyle>
        {({ getFieldValue }) => {
          const transformType = getFieldValue('transformType');
          if (transformType === 'passthrough') {
            return (
              <Form.Item
                label={t('node.config.transform.script')}
                name="script"
                tooltip={t('node.config.transform.passthroughTooltip')}
              >
                <TextArea rows={3} placeholder="" disabled />
              </Form.Item>
            );
          }
          const placeholder =
            transformType === 'map'
              ? '{"title":"data.title","url":"data.url"}'
              : transformType === 'filter'
              ? '{"field":"name","operator":"contains","value":"abc"}'
              : transformType === 'sort'
              ? '{"field":"score","order":"asc"}'
              : '{"field":"category"}';
          return (
            <Form.Item
              label={t('node.config.transform.script')}
              name="script"
              tooltip={t('node.config.transform.scriptTooltip')}
            >
              <TextArea rows={4} placeholder={placeholder} />
            </Form.Item>
          );
        }}
      </Form.Item>
    </>
  );
};

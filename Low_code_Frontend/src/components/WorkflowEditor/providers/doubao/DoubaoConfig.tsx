/**
 * 豆包专属配置组件
 */

import React from 'react';
import { Form, Select } from 'antd';
import { ProviderConfigProps } from '../types';
import styles from './DoubaoConfig.module.scss';

const { Option } = Select;

export const DoubaoConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  return (
    <>
      <Form.Item
        label="思考长度"
        name="thinkingLevel"
        initialValue="medium"
        tooltip="选择思考长度模式：minimal（最少）、low（低）、medium（中等）、high（高）"
        className={styles.formItem}
      >
        <Select>
          <Option value="minimal">minimal（最少）</Option>
          <Option value="low">low（低）</Option>
          <Option value="medium">medium（中等）</Option>
          <Option value="high">high（高）</Option>
        </Select>
      </Form.Item>
    </>
  );
};


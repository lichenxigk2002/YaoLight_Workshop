/**
 * DeepSeek 专属配置组件
 */

import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './DeepSeekConfig.module.scss';
import { SegmentedSwitch } from '../parts/SwitchPart';

export const DeepSeekConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <>
      <Form.Item
        label={t('node.config.ai.thinking')}
        name="thinking"
        initialValue={false}
        tooltip={t('node.config.ai.thinkingTooltip')}
        className={styles.formItem}
      >
        <SegmentedSwitch />
      </Form.Item>
    </>
  );
};


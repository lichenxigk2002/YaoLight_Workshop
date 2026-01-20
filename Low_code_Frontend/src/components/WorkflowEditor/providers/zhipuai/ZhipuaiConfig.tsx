/**
 * 智谱AI GLM 专属配置组件
 */

import React from 'react';
import { Form } from 'antd';
import { useTranslation } from 'react-i18next';
import { ProviderConfigProps } from '../types';
import styles from './ZhipuaiConfig.module.scss';
import { SegmentedSwitch } from '../parts/SwitchPart';

export const ZhipuaiConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _form = form; // 保留 form 参数以保持接口一致性

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


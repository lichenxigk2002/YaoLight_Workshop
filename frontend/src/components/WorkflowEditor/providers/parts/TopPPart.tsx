import React from 'react';
import { Form, InputNumber, Slider, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';

export const TopPPart: React.FC<{
  name?: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}> = ({
  name = 'topP',
  label,
  min = 0,
  max = 1,
  step = 0.05,
  defaultValue = 1,
}) => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={label || t('node.config.ai.topP') || 'Top P'}
      name={name}
      initialValue={defaultValue}
      tooltip={t('node.config.ai.topPTooltip') || '控制输出的多样性'}
    >
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name={name} noStyle>
            <Slider
              min={min}
              max={max}
              step={step}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name={name} noStyle>
            <InputNumber
              min={min}
              max={max}
              step={step}
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Col>
      </Row>
    </Form.Item>
  );
};

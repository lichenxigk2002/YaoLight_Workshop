import React from 'react';
import { Form, InputNumber, Slider, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';

export const TemperaturePart: React.FC<{
  name?: string;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
}> = ({
  name = 'temperature',
  label,
  min = 0,
  max = 1,
  step = 0.1,
  defaultValue = 0.7,
}) => {
  const { t } = useTranslation();

  return (
    <Form.Item
      label={label || t('node.config.ai.temperature')}
      name={name}
      initialValue={defaultValue}
      tooltip={t('node.config.ai.temperatureTooltip')}
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

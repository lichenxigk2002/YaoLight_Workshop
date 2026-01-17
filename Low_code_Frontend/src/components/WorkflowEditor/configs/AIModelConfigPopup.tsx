import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Form, Popover, InputNumber, Switch, Button, Tooltip, Select } from 'antd';
import { DownOutlined, InfoCircleOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ProviderIcon } from '../../Icons/ProviderIcon';
import styles from './AIModelConfigPopup.module.scss';
import { ProviderPickerOption } from './ProviderPicker';
import { getModelConfigSupport } from './modelConfigSupport';

const { Option } = Select;

// 内部组件：平滑高度包装器
const SmoothHeightWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => {
      // 使用 offsetHeight 确保包含 padding 和 border，防止内容被截断
      if (contentRef.current) {
        setHeight(contentRef.current.offsetHeight);
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      className={styles.smoothContainer} 
      style={{ height }}
    >
      <div ref={contentRef} className={styles.smoothContent}>
        {children}
      </div>
    </div>
  );
};

interface AIModelConfigPopupProps {
  value?: string; // Current provider value
  onChange?: (value: string) => void;
  options: ProviderPickerOption[]; // Provider options
  supportedModels: string[]; // Models for current provider
  currentModelName?: string;
  onModelChange: (model: string) => void;
  trigger?: React.ReactNode;
}

export const AIModelConfigPopup: React.FC<AIModelConfigPopupProps> = ({
  value: currentProvider,
  onChange: onProviderChange,
  options,
  supportedModels,
  currentModelName,
  onModelChange,
  trigger,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();

  // 获取当前选中提供商的配置支持情况
  const support = useMemo(() => getModelConfigSupport(currentProvider), [currentProvider]);

  // Popover 内容
  const content = (
    <SmoothHeightWrapper>
      <div className={styles.popupContainer}>
        {/* 1. 提供商选择 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {t('node.config.ai.selectProvider') || '模型服务商'}
        </div>
        <div className={styles.providerGrid}>
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`${styles.providerCard} ${currentProvider === opt.value ? styles.active : ''}`}
              onClick={() => onProviderChange?.(opt.value)}
              title={opt.title}
            >
                <div className={styles.providerIcon}>
                  {/* 直接渲染 ProviderIcon 以确保状态更新和避免上下文丢失 */}
                  <ProviderIcon provider={opt.value} />
                </div>
                <div className={styles.providerName}>{opt.title}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 模型版本选择 */}
      {supportedModels.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            {t('node.config.ai.modelName') || '模型版本'}
          </div>
          <div className={styles.modelGroup}>
            {supportedModels.map((model) => (
              <div
                key={model}
                className={`${styles.modelBtn} ${currentModelName === model ? styles.active : ''}`}
                onClick={() => onModelChange(model)}
              >
                {model}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 高级参数配置 */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {t('node.config.ai.advancedParams') || '高级参数'}
        </div>
        <div className={styles.paramsGrid}>
          {/* Temperature */}
          <div className={styles.paramItem}>
            <div className={styles.paramLabel}>
              <span>Temperature</span>
              <Tooltip title={t('node.config.ai.temperatureTooltip')}>
                <InfoCircleOutlined className={styles.infoIcon} />
              </Tooltip>
            </div>
            <Form.Item name="temperature" noStyle>
              <InputNumber
                min={0}
                max={1}
                step={0.1}
                size="small"
                className={styles.paramInput}
              />
            </Form.Item>
          </div>

          {/* Max Tokens */}
          <div className={styles.paramItem}>
            <div className={styles.paramLabel}>
              <span>Max Tokens</span>
              <Tooltip title={t('node.config.ai.maxTokensTooltip')}>
                <InfoCircleOutlined className={styles.infoIcon} />
              </Tooltip>
            </div>
            <Form.Item name="maxTokens" noStyle>
              <InputNumber
                min={1}
                step={100}
                size="small"
                className={styles.paramInput}
              />
            </Form.Item>
          </div>

          {/* Stream Switch */}
          {support.stream && (
             <div className={styles.paramItemRow}>
               <div className={styles.paramLabel}>
                 <span>{t('node.config.ai.stream') || '流式输出'}</span>
               </div>
               <Form.Item name="stream" valuePropName="checked" noStyle>
                 <Switch size="small" />
               </Form.Item>
             </div>
          )}

          {/* Thinking Switch */}
          {support.thinking && (
             <div className={styles.paramItemRow}>
               <div className={styles.paramLabel}>
                 <span>{t('node.config.ai.thinking') || '深度思考/推理'}</span>
                 <Tooltip title={t('node.config.ai.thinkingTooltip')}>
                   <InfoCircleOutlined className={styles.infoIcon} />
                 </Tooltip>
               </div>
               <Form.Item
                 name={currentProvider === 'qwen' ? 'enable_thinking' : 'thinking'}
                 valuePropName="checked"
                 noStyle
               >
                 <Switch size="small" />
               </Form.Item>
             </div>
          )}

          {/* Thinking Level */}
          {support.thinkingLevel && (
            <div className={styles.paramItem}>
              <div className={styles.paramLabel}>
                <span>{t('node.config.ai.thinkingLevel') || '思考程度'}</span>
              </div>
              <Form.Item name="thinkingLevel" noStyle>
                 <Select size="small" className={styles.paramInput}>
                    <Option value="low">Low</Option>
                    <Option value="medium">Medium</Option>
                    <Option value="high">High</Option>
                 </Select>
              </Form.Item>
            </div>
          )}

           {/* Frequency Penalty */}
           {support.frequencyPenalty && (
            <div className={styles.paramItem}>
              <div className={styles.paramLabel}>
                <span>{t('node.config.ai.frequencyPenalty') || '频率惩罚'}</span>
              </div>
              <Form.Item name="frequencyPenalty" noStyle>
                <InputNumber
                  min={-2}
                  max={2}
                  step={0.1}
                  size="small"
                  className={styles.paramInput}
                />
              </Form.Item>
            </div>
          )}

          {/* Presence Penalty */}
          {support.presencePenalty && (
            <div className={styles.paramItem}>
              <div className={styles.paramLabel}>
                <span>{t('node.config.ai.presencePenalty') || '存在惩罚'}</span>
              </div>
              <Form.Item name="presencePenalty" noStyle>
                <InputNumber
                  min={-2}
                  max={2}
                  step={0.1}
                  size="small"
                  className={styles.paramInput}
                />
              </Form.Item>
            </div>
          )}
        </div>
      </div>
    </div>
    </SmoothHeightWrapper>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement="left"
      overlayClassName={styles.configPopover}
      arrow={false}
    >
      {trigger || (
        <div className={styles.defaultTrigger}>
           <SettingOutlined />
           <span>{t('node.config.ai.configureModel') || '配置模型'}</span>
        </div>
      )}
    </Popover>
  );
};

import React from 'react';
import { CheckOutlined, LoadingOutlined, CloseOutlined, MinusOutlined } from '@ant-design/icons';
import styles from './ProcessLoader.module.scss';

export interface ProcessStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'completed' | 'failed';
}

interface ProcessLoaderProps {
  steps: ProcessStep[];
  visible: boolean;
}

const ProcessLoader: React.FC<ProcessLoaderProps> = ({ steps, visible }) => {
  if (!visible) return null;

  return (
    <div className={styles.processLoader}>
      {steps.map((step, index) => (
        <div key={step.id} className={`${styles.step} ${styles[step.status]}`}>
          <div className={styles.iconWrapper}>
            {step.status === 'completed' ? (
              <div className={styles.circleIcon}>
                <CheckOutlined className={styles.completedIcon} />
              </div>
            ) : step.status === 'failed' ? (
              <div className={styles.circleIcon}>
                <CloseOutlined className={styles.failedIcon} />
              </div>
            ) : step.status === 'loading' ? (
              <div className={styles.circleIcon}>
                <LoadingOutlined className={styles.loadingIcon} />
              </div>
            ) : (
              <div className={styles.circleIcon}>
                <MinusOutlined className={styles.pendingIcon} />
              </div>
            )}
          </div>
          <span className={styles.label}>{step.label}</span>
          {index < steps.length - 1 && (
            <div className={`${styles.line} ${steps[index + 1].status !== 'pending' ? styles.active : ''}`} />
          )}
        </div>
      ))}
    </div>
  );
};

export default ProcessLoader;


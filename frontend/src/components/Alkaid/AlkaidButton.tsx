import React from 'react';
import { AlkaidIcon } from '@/components/Icons';
import styles from './AlkaidAssistant.module.scss';

interface AlkaidButtonProps {
  onClick?: () => void;
}

const AlkaidButton: React.FC<AlkaidButtonProps> = ({ onClick }) => {
  return (
    <button
      className={styles.alkaidButton}
      onClick={onClick}
      type="button"
      aria-label="瑶光星助手"
    >
      <AlkaidIcon size={26} />
    </button>
  );
};

export default AlkaidButton;


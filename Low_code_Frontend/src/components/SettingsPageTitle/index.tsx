import type { ReactNode } from 'react';
import styles from './index.module.scss';

interface SettingsPageTitleProps {
  title: string;
  desc?: string;
  icon?: ReactNode;
}

/**
 * 设置 / 个人中心子页统一标题组件，保持样式一致
 */
export default function SettingsPageTitle({ title, desc, icon }: SettingsPageTitleProps) {
  return (
    <header className={styles.header}>
      {icon != null && <div className={styles.icon}>{icon}</div>}
      <div className={styles.text}>
        <h1 className={styles.title}>{title}</h1>
        {desc != null && <p className={styles.desc}>{desc}</p>}
      </div>
    </header>
  );
}

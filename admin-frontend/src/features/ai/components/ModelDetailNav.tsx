import { NavLink } from 'react-router-dom';
import { MODEL_DETAIL_TABS } from '../constants';
import { buildModelPath } from '../utils';
import styles from '../AIWorkspace.module.scss';

interface ModelDetailNavProps {
  provider: string;
  modelName: string;
  active: 'overview' | 'capability' | 'pricing';
}

export default function ModelDetailNav({ provider, modelName, active }: ModelDetailNavProps) {
  return (
    <div className={styles.modelTabs}>
      {MODEL_DETAIL_TABS.map((item) => (
        <NavLink
          key={item.key}
          to={buildModelPath(provider, modelName, item.key as 'overview' | 'capability' | 'pricing')}
          className={`${styles.modelTab} ${active === item.key ? styles.modelTabActive : ''}`.trim()}
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}

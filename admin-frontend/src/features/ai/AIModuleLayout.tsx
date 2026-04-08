import { Alert } from 'antd';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AI_MODULE_TABS } from './constants';
import styles from './AIModuleLayout.module.scss';

export default function AIModuleLayout() {
  const location = useLocation();

  return (
    <div className={styles.shell}>
      <Alert
        className={styles.workspaceAlert}
        type="info"
        showIcon
        message="AI admin workspace"
        description="Provider templates come from the current backend. Admin edits are stored in a local workspace until /api/admin/ai-models endpoints are added."
      />
      <nav className={styles.nav}>
        {AI_MODULE_TABS.map((item) => {
          const isActive =
            location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);

          return (
            <NavLink
              key={item.key}
              to={item.path}
              className={`${styles.navLink} ${isActive ? styles.navLinkActive : ''}`.trim()}
            >
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <Outlet />
    </div>
  );
}

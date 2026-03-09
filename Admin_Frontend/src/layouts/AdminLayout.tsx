import { useEffect, useMemo, useState } from 'react';
import { LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { adminMenuItems } from '@/constants/menu';
import type { AdminMenuItem } from '@/types/menu';
import { clearAdminSession, getAdminSession } from '@/utils/storage';
import styles from './AdminLayout.module.scss';

const { Header, Sider, Content } = Layout;

const ADMIN_BASENAME = '/admin';

/** 去掉 basename 得到相对路径，用于与 menu path 匹配 */
function pathnameWithoutBasename(pathname: string): string {
  if (pathname === ADMIN_BASENAME) return '/';
  if (pathname.startsWith(`${ADMIN_BASENAME}/`)) return pathname.slice(ADMIN_BASENAME.length);
  return pathname;
}

function flattenMenu(
  items: AdminMenuItem[],
  parents: AdminMenuItem[] = [],
): Array<{ item: AdminMenuItem; chain: AdminMenuItem[] }> {
  return items.flatMap((item) => {
    const chain = [...parents, item];
    return [{ item, chain }, ...flattenMenu(item.children ?? [], chain)];
  });
}

function matchesPath(pathname: string, item: AdminMenuItem) {
  const candidates = [item.path, ...(item.aliases ?? [])].filter(Boolean) as string[];
  return candidates.some(
    (candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`),
  );
}

function matchMenuChain(pathname: string) {
  const relative = pathnameWithoutBasename(pathname);
  return flattenMenu(adminMenuItems)
    .filter(({ item }) => item.path && matchesPath(relative, item))
    .sort((left, right) => (right.item.path?.length ?? 0) - (left.item.path?.length ?? 0))[0]
    ?.chain;
}

function buildBreadcrumb(pathname: string) {
  const items = [{ title: '管理后台' }];
  const chain = matchMenuChain(pathname) ?? [];

  for (const item of chain) {
    if (item.key === 'dashboard') {
      continue;
    }
    items.push({ title: item.label });
  }

  return items;
}

function buildMenuItems(
  items: AdminMenuItem[],
  navigate: ReturnType<typeof useNavigate>,
): ItemType[] {
  return items.map((item) => {
    if (item.children?.length) {
      return {
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: buildMenuItems(item.children, navigate),
      };
    }

    return {
      key: item.key,
      icon: item.icon,
      label: item.label,
      onClick: () => item.path && navigate(item.path),
    };
  });
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAdminSession();
  const activeChain = matchMenuChain(location.pathname) ?? [];
  const selectedKey = activeChain.at(-1)?.key ?? 'dashboard';
  const routeOpenKeys = activeChain
    .filter((item) => (item.children?.length ?? 0) > 0)
    .map((item) => item.key);
  const [openKeys, setOpenKeys] = useState<string[]>(routeOpenKeys);
  const menuItems = useMemo(() => buildMenuItems(adminMenuItems, navigate), [navigate]);

  useEffect(() => {
    setOpenKeys((current) => Array.from(new Set([...current, ...routeOpenKeys])));
  }, [location.pathname]);

  return (
    <Layout className={styles.shell}>
      <Sider width={264} className={styles.sider}>
        <div className={styles.brand} onClick={() => navigate('/')}>
          <div className={styles.brandMark}>YL</div>
          <div>
            <div className={styles.brandTitle}>瑶光管理后台</div>
            <div className={styles.brandSub}>平台运营控制台</div>
          </div>
        </div>
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys as string[])}
          items={menuItems}
          className={styles.menu}
        />
      </Sider>
      <Layout>
        <Header className={styles.header}>
          <div>
            <div className={styles.headerTitle}>瑶光管理后台</div>
            <Breadcrumb items={buildBreadcrumb(location.pathname)} />
          </div>
          <Dropdown
            menu={{
              items: [
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  label: '退出登录',
                  onClick: () => {
                    clearAdminSession();
                    navigate('/login', { replace: true });
                  },
                },
              ],
            }}
            trigger={['click']}
          >
            <Button className={styles.userButton} type="text">
              <Avatar size={34} icon={<UserOutlined />} />
              <span>{session?.user.username ?? '管理员'}</span>
            </Button>
          </Dropdown>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}

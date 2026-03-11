import { useEffect, useMemo, useState } from 'react';
import { DownOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeSwitch from '@/components/ThemeSwitch';
import { adminMenuItems } from '@/constants/menu';
import { useI18n } from '@/i18n';
import type { AdminMenuItem } from '@/types/menu';
import { clearAdminSession, getAdminSession } from '@/utils/storage';
import styles from './AdminLayout.module.scss';

const { Header, Sider, Content, Footer } = Layout;
const ADMIN_BASENAME = '/admin';

function pathnameWithoutBasename(pathname: string) {
  if (pathname === ADMIN_BASENAME) return '/';
  if (pathname.startsWith(`${ADMIN_BASENAME}/`)) return pathname.slice(ADMIN_BASENAME.length);
  return pathname;
}

function flattenMenu(items: AdminMenuItem[], parents: AdminMenuItem[] = []): Array<{ item: AdminMenuItem; chain: AdminMenuItem[] }> {
  return items.flatMap((item) => {
    const chain = [...parents, item];
    return [{ item, chain }, ...flattenMenu(item.children ?? [], chain)];
  });
}

function matchesPath(pathname: string, item: AdminMenuItem) {
  const candidates = [item.path, ...(item.aliases ?? [])].filter(Boolean) as string[];
  return candidates.some((candidate) => pathname === candidate || pathname.startsWith(`${candidate}/`));
}

function matchMenuChain(pathname: string) {
  const relative = pathnameWithoutBasename(pathname);
  return flattenMenu(adminMenuItems)
    .filter(({ item }) => item.path && matchesPath(relative, item))
    .sort((left, right) => (right.item.path?.length ?? 0) - (left.item.path?.length ?? 0))[0]
    ?.chain;
}

function getMenuItemPath(item: AdminMenuItem) {
  if (item.path) return item.path;
  return item.children?.find((child) => child.path)?.path;
}

function buildBreadcrumb(pathname: string, t: (key: string) => string) {
  const relativePath = pathnameWithoutBasename(pathname);
  const items = [
    {
      title:
        relativePath === '/' ? (
          <span className={styles.breadcrumbCurrent}>{t('layout.breadcrumbHome')}</span>
        ) : (
          <Link to="/" className={styles.breadcrumbLink}>
            {t('layout.breadcrumbHome')}
          </Link>
        ),
    },
  ];
  const chain = matchMenuChain(pathname) ?? [];

  chain.forEach((item, index) => {
    if (item.key === 'dashboard') return;
    const target = getMenuItemPath(item);
    const isLast = index === chain.length - 1;

    items.push({
      title:
        !isLast && target ? (
          <Link to={target} className={styles.breadcrumbLink}>
            {t(item.label)}
          </Link>
        ) : (
          <span className={styles.breadcrumbCurrent}>{t(item.label)}</span>
        ),
    });
  });

  return items;
}

function buildMenuItems(items: AdminMenuItem[], navigate: ReturnType<typeof useNavigate>, t: (key: string) => string): ItemType[] {
  return items.map((item) => {
    if (item.children?.length) {
      return {
        key: item.key,
        icon: item.icon,
        label: t(item.label),
        children: buildMenuItems(item.children, navigate, t),
      };
    }

    return {
      key: item.key,
      icon: item.icon,
      label: t(item.label),
      onClick: () => item.path && navigate(item.path),
    };
  });
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const session = getAdminSession();
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();
  const activeChain = matchMenuChain(location.pathname) ?? [];
  const selectedKey = activeChain.at(-1)?.key ?? 'dashboard';
  const routeOpenKeys = activeChain.filter((item) => (item.children?.length ?? 0) > 0).map((item) => item.key);
  const [openKeys, setOpenKeys] = useState<string[]>(routeOpenKeys);
  const menuItems = useMemo(() => buildMenuItems(adminMenuItems, navigate, t), [navigate, t]);
  const breadcrumbItems = useMemo(() => buildBreadcrumb(location.pathname, t), [location.pathname, t]);

  useEffect(() => {
    setOpenKeys((current) => Array.from(new Set([...current, ...routeOpenKeys])));
  }, [location.pathname]);

  return (
    <Layout className={styles.shell}>
      <Sider width={264} className={styles.sider}>
        <div className={styles.brand} onClick={() => navigate('/')}>
          <div className={styles.brandMark}>YL</div>
          <div>
            <div className={styles.brandTitle}>{t('layout.brandTitle')}</div>
            <div className={styles.brandSub}>{t('layout.brandSubtitle')}</div>
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
      <Layout className={styles.main}>
        <Header className={styles.header}>
          <div className={styles.headerInfo}>
            <div className={styles.headerTitle}>{t('layout.headerTitle')}</div>
            <Breadcrumb className={styles.breadcrumb} items={breadcrumbItems} />
          </div>
          <div className={styles.headerActions}>
            <div className={styles.headerTools}>
              <ThemeSwitch />
              <LocaleSwitch />
            </div>
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'logout',
                    icon: <LogoutOutlined />,
                    label: t('layout.logout'),
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
                <Avatar size={30} icon={<UserOutlined />} />
                <span>{session?.user.username ?? t('layout.adminUser')}</span>
                <DownOutlined className={styles.userChevron} />
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className={styles.content}>
          <Outlet />
        </Content>
        <Footer className={styles.footer}>
          <div className={styles.footerMeta}>
            <span>YaoLight Workshop Admin</span>
            <span>{currentYear}</span>
          </div>
          <div className={styles.footerLinks}>
            <Link to="/" className={styles.footerLink}>
              {t('menu.dashboard')}
            </Link>
            <Link to="/notifications" className={styles.footerLink}>
              {t('menu.notifications')}
            </Link>
            <Link to="/operation-logs" className={styles.footerLink}>
              {t('menu.operationLogs')}
            </Link>
          </div>
        </Footer>
      </Layout>
    </Layout>
  );
}

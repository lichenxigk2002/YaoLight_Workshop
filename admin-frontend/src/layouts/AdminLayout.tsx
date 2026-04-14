import { useEffect, useMemo, useState } from 'react';
import { DownOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import { Avatar, Breadcrumb, Button, Dropdown, Layout, Menu, Result, Spin } from 'antd';
import type { ItemType } from 'antd/es/menu/interface';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { getCurrentAdminUser } from '@/api/adminAuth';
import LocaleSwitch from '@/components/LocaleSwitch';
import ThemeSwitch from '@/components/ThemeSwitch';
import { adminMenuItems } from '@/constants/menu';
import { useI18n } from '@/i18n';
import { canViewResource, filterMenuByPermissions, findFirstAccessiblePath, resolveResourceFromPath } from '@/utils/permissions';
import type { AdminMenuItem } from '@/types/menu';
import { clearAdminSession, getAdminSession, updateAdminSessionUser } from '@/utils/storage';
import styles from './AdminLayout.module.scss';

const { Header, Sider, Content, Footer } = Layout;
const ADMIN_BASENAME = '/admin';
const BRAND_LOGO_SRC = `${import.meta.env.BASE_URL}YaoLight_White.png`;

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

function matchMenuChain(pathname: string, items: AdminMenuItem[]) {
  const relative = pathnameWithoutBasename(pathname);
  return flattenMenu(items)
    .filter(({ item }) => item.path && matchesPath(relative, item))
    .sort((left, right) => (right.item.path?.length ?? 0) - (left.item.path?.length ?? 0))[0]
    ?.chain;
}

function getMenuItemPath(item: AdminMenuItem) {
  if (item.path) return item.path;
  return item.children?.find((child) => child.path)?.path;
}

function buildBreadcrumb(pathname: string, menuItems: AdminMenuItem[], t: (key: string) => string) {
  const relativePath = pathnameWithoutBasename(pathname);
  const breadcrumbItems = [
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
  const chain = matchMenuChain(pathname, menuItems) ?? [];

  chain.forEach((item, index) => {
    if (item.key === 'dashboard') return;
    const target = getMenuItemPath(item);
    const isLast = index === chain.length - 1;

    breadcrumbItems.push({
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

  return breadcrumbItems;
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
  const initialSession = getAdminSession();
  const { t } = useI18n();
  const currentYear = new Date().getFullYear();
  const [collapsed, setCollapsed] = useState(false);
  const [sessionUser, setSessionUser] = useState(initialSession?.user ?? null);
  const [syncingPermissions, setSyncingPermissions] = useState(true);
  const permissions = sessionUser?.permissions ?? [];
  const visibleMenu = useMemo(() => filterMenuByPermissions(adminMenuItems, permissions), [permissions]);
  const fallbackPath = useMemo(() => findFirstAccessiblePath(visibleMenu), [visibleMenu]);
  const activeChain = matchMenuChain(location.pathname, visibleMenu) ?? [];
  const selectedKey = activeChain.at(-1)?.key ?? 'dashboard';
  const routeOpenKeys = activeChain.filter((item) => (item.children?.length ?? 0) > 0).map((item) => item.key);
  const [openKeys, setOpenKeys] = useState<string[]>(routeOpenKeys);
  const menuItems = useMemo(() => buildMenuItems(visibleMenu, navigate, t), [visibleMenu, navigate, t]);
  const breadcrumbItems = useMemo(() => buildBreadcrumb(location.pathname, visibleMenu, t), [location.pathname, visibleMenu, t]);
  const currentResource = resolveResourceFromPath(pathnameWithoutBasename(location.pathname));
  const canAccessCurrentRoute = currentResource ? canViewResource(permissions, currentResource) : true;
  const hasAnyAccessibleRoute = Boolean(fallbackPath);
  const avatarFallback = (sessionUser?.username ?? t('layout.adminUser')).slice(0, 1).toUpperCase();

  useEffect(() => {
    setOpenKeys((current) => Array.from(new Set([...current, ...routeOpenKeys])));
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function syncCurrentAdmin() {
      try {
        const user = await getCurrentAdminUser();
        if (cancelled) return;
        setSessionUser(user);
        updateAdminSessionUser(user);
      } catch {
        if (cancelled) return;
        clearAdminSession();
        navigate('/login', { replace: true });
      } finally {
        if (!cancelled) {
          setSyncingPermissions(false);
        }
      }
    }

    void syncCurrentAdmin();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  let contentNode = <Outlet />;
  if (syncingPermissions) {
    contentNode = (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 320 }}>
        <Spin tip={t('layout.syncingPermissions')} />
      </div>
    );
  } else if (!hasAnyAccessibleRoute) {
    contentNode = (
      <Result
        status="403"
        title={t('layout.noPermissionTitle')}
        subTitle={t('layout.noPermissionDescription')}
        extra={
          <Button
            onClick={() => {
              clearAdminSession();
              navigate('/login', { replace: true });
            }}
          >
            {t('layout.logout')}
          </Button>
        }
      />
    );
  } else if (!canAccessCurrentRoute) {
    contentNode =
      fallbackPath && fallbackPath !== pathnameWithoutBasename(location.pathname) ? (
        <Navigate to={fallbackPath} replace />
      ) : (
        <Result status="403" title={t('layout.accessDeniedTitle')} subTitle={t('layout.accessDeniedDescription')} />
      );
  }

  return (
    <Layout className={styles.shell}>
      <Sider width={264} collapsedWidth={88} collapsed={collapsed} trigger={null} className={styles.sider}>
        <div
          className={`${styles.brand} ${collapsed ? styles.brandCollapsed : ''}`}
          onClick={() => navigate('/')}
        >
          <div className={styles.brandMark} aria-hidden="true">
            <img src={BRAND_LOGO_SRC} alt="" className={styles.brandLogo} />
          </div>
          <div className={styles.brandText}>
            <div className={styles.brandTitleRow}>
              <div className={styles.brandTitle}>YaoLight</div>
              <span className={styles.brandBadge}>Admin</span>
            </div>
            <div className={styles.brandSub}>{t('layout.brandSubtitle')}</div>
          </div>
        </div>
        <div className={styles.siderMenuWrap}>
          <Menu
            mode="inline"
            theme="light"
            inlineCollapsed={collapsed}
            selectedKeys={[selectedKey]}
            openKeys={collapsed ? undefined : openKeys}
            onOpenChange={collapsed ? undefined : (keys) => setOpenKeys(keys as string[])}
            items={menuItems}
            className={styles.menu}
          />
        </div>
      </Sider>
      <Layout className={styles.main}>
        <Header className={styles.header}>
          <div className={styles.headerLead}>
            <Button
              type="text"
              className={styles.collapseButton}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((current) => !current)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            />
            <div className={styles.headerInfo}>
              <div className={styles.headerTitle}>{t('layout.headerTitle')}</div>
              <Breadcrumb className={styles.breadcrumb} items={breadcrumbItems} />
            </div>
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
                <Avatar size={30} src={sessionUser?.avatar_url ?? undefined}>
                  {avatarFallback}
                </Avatar>
                <span>{sessionUser?.username ?? t('layout.adminUser')}</span>
                <DownOutlined className={styles.userChevron} />
              </Button>
            </Dropdown>
          </div>
        </Header>
        <Content className={styles.content}>
          {contentNode}
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
            <Link to="/notifications/send" className={styles.footerLink}>
              {t('menu.notifications')}
            </Link>
            <Link to="/logs/operation" className={styles.footerLink}>
              {t('menu.operationLogs')}
            </Link>
          </div>
        </Footer>
      </Layout>
    </Layout>
  );
}

import { Layout as AntLayout, Dropdown, Avatar, Button } from 'antd';
import {
  UserOutlined,
  LogoutOutlined,
  SunOutlined,
  MoonOutlined,
  SettingOutlined,
  CloudServerOutlined,
  FileTextOutlined,
  GithubOutlined,
  LinkOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/theme';
import NotificationBell from './NotificationBell';
import styles from './index.module.scss';

const GITHUB_URL = 'https://github.com/lichenxigk2002/YaoLight_Workshop';
const BLOG_URL = 'https://www.gfbzsblog.site/';

const { Header, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();
  const isZh = i18n.language === 'zh-CN';

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleUserMenu = (key: string) => {
    if (key === 'models') {
      navigate('/settings/models');
    } else if (key === 'help') {
      navigate('/help');
    } else if (key === 'github') {
      window.open(GITHUB_URL, '_blank', 'noopener,noreferrer');
    } else if (key === 'contact') {
      window.open(BLOG_URL, '_blank', 'noopener,noreferrer');
    } else if (key === 'profile') {
      navigate('/settings');
    } else if (key === 'logout') {
      handleLogout();
    }
  };

  const handleLanguageToggle = () => {
    const newLanguage = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN';
    i18n.changeLanguage(newLanguage);
  };

  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      if (user.avatar_url.startsWith('http')) {
        return user.avatar_url;
      }
      const baseURL = import.meta.env.VITE_BASE_URL || '/api';
      return `${baseURL}/uploads/${user.avatar_url}`;
    }
    return undefined;
  };

  const menuRows = [
    { key: 'models', icon: <CloudServerOutlined />, label: t('layout.modelProviders'), external: false },
    { key: 'help', icon: <FileTextOutlined />, label: t('layout.helpDocs'), external: false },
    { key: 'github', icon: <GithubOutlined />, label: t('layout.githubStar'), external: true },
    { key: 'contact', icon: <LinkOutlined />, label: t('layout.contactMe'), external: true },
  ];

  const dropdownContent = (
    <div className={styles.userDropdownPanel}>
      <div className={styles.userDropdownHead}>
        <Avatar
          src={getAvatarUrl()}
          className={styles.userDropdownAvatar}
          icon={<UserOutlined />}
        />
        <span className={styles.userDropdownName}>{user?.username || '用户'}</span>
      </div>
      <div className={styles.userDropdownDivider} />
      {menuRows.map(({ key, icon, label, external }) => (
        <button
          key={key}
          type="button"
          className={styles.userDropdownItem}
          onClick={() => handleUserMenu(key)}
        >
          <span className={styles.userDropdownItemLeft}>
            {icon}
            <span>{label}</span>
          </span>
          {external ? (
            <LinkOutlined className={styles.userDropdownItemRight} />
          ) : (
            <RightOutlined className={styles.userDropdownItemRight} />
          )}
        </button>
      ))}
      <div className={styles.userDropdownDivider} />
      <button
        type="button"
        className={styles.userDropdownItem}
        onClick={() => handleUserMenu('profile')}
      >
        <span className={styles.userDropdownItemLeft}>
          <SettingOutlined />
          <span>{t('layout.userCenter')}</span>
        </span>
        <RightOutlined className={styles.userDropdownItemRight} />
      </button>
      <div className={styles.userDropdownDivider} />
      <button
        type="button"
        className={styles.userDropdownItem}
        onClick={() => handleUserMenu('logout')}
      >
        <span className={styles.userDropdownItemLeft}>
          <LogoutOutlined />
          <span>{t('layout.logout')}</span>
        </span>
      </button>
    </div>
  );

  return (
    <AntLayout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.headerInner}>
          <button type="button" className={styles.logo} onClick={handleLogoClick}>
            <span className={styles.brandMark}>
              <img
                src={theme === 'dark' ? '/YaoLight_White.png' : '/YaoLight_Black.png'}
                alt="YaoLight"
                className={styles.logoImage}
              />
            </span>
            <span className={styles.brandBlock}>
              <span className={styles.brandText}>{t('common.brandName')}</span>
              <span className={styles.brandCaption}>Workspace</span>
            </span>
          </button>

          <div className={styles.headerRight}>
            <div className={styles.toolDock}>
              <Button
                className={styles.headerIconBtn}
                shape="circle"
                size="middle"
                onClick={toggleTheme}
                icon={theme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
              />
              <span className={styles.dockDivider} />
              <Button
                className={styles.headerIconBtn}
                shape="circle"
                size="middle"
                onClick={handleLanguageToggle}
              >
                {i18n.language === 'zh-CN' ? 'CN' : 'US'}
              </Button>
              <span className={styles.dockDivider} />
              <NotificationBell />
            </div>

            <Dropdown
              dropdownRender={() => dropdownContent}
              placement="bottomRight"
              trigger={['hover', 'click']}
            >
              <span className={styles.headerAvatarWrap}>
                <span className={styles.profileButton}>
                  <Avatar
                    src={getAvatarUrl()}
                    className={styles.headerAvatar}
                    icon={<UserOutlined />}
                  />
                  <span className={styles.profileMeta}>
                    <span className={styles.headerUserText}>{user?.username || t('layout.userCenter')}</span>
                    <span className={styles.profileHint}>{isZh ? '个人中心' : 'Account'}</span>
                  </span>
                </span>
              </span>
            </Dropdown>
          </div>
        </div>
      </Header>
      <Content className={styles.content}>
        {children}
      </Content>
    </AntLayout>
  );
}

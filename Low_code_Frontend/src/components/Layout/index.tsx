import { Layout as AntLayout, Dropdown, Avatar, Space, Button } from 'antd';
import { UserOutlined, LogoutOutlined, SunOutlined, MoonOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '@/store/theme';
import type { MenuProps } from 'antd';
import styles from './index.module.scss';

const { Header, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useThemeStore();

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      navigate('/settings');
    } else if (key === 'logout') {
      handleLogout();
    }
  };

  const handleLanguageToggle = () => {
    const newLanguage = i18n.language === 'zh-CN' ? 'en-US' : 'zh-CN';
    i18n.changeLanguage(newLanguage);
  };

  // 获取头像 URL
  const getAvatarUrl = () => {
    if (user?.avatar_url) {
      // 如果是绝对路径（http/https），直接返回
      if (user.avatar_url.startsWith('http')) {
        return user.avatar_url;
      }
      // 如果是相对路径，拼接 API 基础路径
      const baseURL = import.meta.env.VITE_BASE_URL || '/api';
      return `${baseURL}/uploads/${user.avatar_url}`;
    }
    return undefined;
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          <span>{t('layout.userCenter')}</span>
        </Space>
      ),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: (
        <Space>
          <LogoutOutlined />
          <span>{t('layout.logout')}</span>
        </Space>
      ),
    },
  ];

  return (
    <AntLayout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.logo} onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
          <img
            src={theme === 'dark' ? '/YaoLight_White.png' : '/YaoLight_Black.png'}
            alt="YaoLight"
            className={styles.logoImage}
          />
          <span className={styles.brandText}>{t('common.brandName')}</span>
        </div>
        <Space>
          <Button
            className={styles.themeToggle}
            shape="circle"
            size="middle"
            onClick={toggleTheme}
            icon={theme === 'dark' ? <MoonOutlined /> : <SunOutlined />}
          />
          <Button
            className={styles.languageToggle}
            shape="circle"
            size="middle"
            onClick={handleLanguageToggle}
          >
            {i18n.language === 'zh-CN' ? 'CN' : 'US'}
          </Button>
          <span className={styles.username}>{user?.username || '用户'}</span>
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            placement="bottomRight"
          >
            <Avatar
              src={getAvatarUrl()}
              className={styles.headerAvatar}
              icon={<UserOutlined />}
            />
          </Dropdown>
        </Space>
      </Header>
      <Content className={styles.content}>
        {children}
      </Content>
    </AntLayout>
  );
}

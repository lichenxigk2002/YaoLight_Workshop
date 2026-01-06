import { Layout as AntLayout, Dropdown, Avatar, Space } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/redux/auth';
import { useTranslation } from 'react-i18next';
import SettingsButton from '@/components/SettingsButton';
import type { MenuProps } from 'antd';
import styles from './index.module.scss';

const { Header, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { t } = useTranslation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'profile') {
      navigate('/profile');
    } else if (key === 'logout') {
      handleLogout();
    }
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
        <div className={styles.logo}>
          {t('common.brandName')}
        </div>
        <Space>
          <span className={styles.username}>{user?.username || '用户'}</span>
          <Dropdown
            menu={{ items: menuItems, onClick: handleMenuClick }}
            placement="bottomRight"
          >
            <Avatar
              style={{ backgroundColor: '#000', cursor: 'pointer' }}
              icon={<UserOutlined />}
            />
          </Dropdown>
        </Space>
      </Header>
      <Content className={styles.content}>
        {children}
      </Content>
      <SettingsButton />
    </AntLayout>
  );
}


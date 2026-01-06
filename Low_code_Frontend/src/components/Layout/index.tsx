import { Layout as AntLayout, Dropdown, Avatar, Space } from 'antd';
import { UserOutlined, LogoutOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/redux/auth';
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

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: (
        <Space>
          <UserOutlined />
          <span>个人中心</span>
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
          <span>退出登录</span>
        </Space>
      ),
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout className={styles.layout}>
      <Header className={styles.header}>
        <div className={styles.logo}>
          工作流管理系统
        </div>
        <Space>
          <span className={styles.username}>{user?.username || '用户'}</span>
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Avatar
              style={{ backgroundColor: '#1890ff', cursor: 'pointer' }}
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


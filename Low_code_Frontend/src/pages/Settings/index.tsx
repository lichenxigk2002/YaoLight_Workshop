import { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import {
  UserOutlined,
  CloudServerOutlined,
  CreditCardOutlined,
  GlobalOutlined,
  FileTextOutlined,
  BellOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import styles from './index.module.scss';

const { Sider, Content } = Layout;

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: 'workspace',
      label: t('settings.groupWorkspace'),
      type: 'group',
      children: [
        {
          key: 'models',
          icon: <CloudServerOutlined />,
          label: t('settings.modelProviders'),
        },
        {
          key: 'recharge',
          icon: <CreditCardOutlined />,
          label: t('settings.recharge'),
        },
        {
          key: 'orders',
          icon: <FileTextOutlined />,
          label: t('settings.orders', '我的订单'),
        },
        {
          key: 'billing',
          icon: <FileTextOutlined />,
          label: t('settings.billingOverview', '账单概览'),
        },
        {
          key: 'token-transactions',
          icon: <FileTextOutlined />,
          label: t('settings.tokenTransactionsTitle', 'Token 流水'),
        },
        {
          key: 'invite',
          icon: <TeamOutlined />,
          label: t('settings.inviteFriends', '邀请好友'),
        },
        {
          key: 'notifications',
          icon: <BellOutlined />,
          label: t('settings.notificationConfig'),
        },
      ],
    },
    {
      key: 'general',
      label: t('settings.groupGeneral'),
      type: 'group',
      children: [
        {
          key: 'profile',
          icon: <UserOutlined />,
          label: t('settings.profile'),
        },
        {
          key: 'language',
          icon: <GlobalOutlined />,
          label: t('settings.language'),
        },
        {
          key: 'assistant',
          icon: <Sparkles size={16} />,
          label: '瑶光星AI助手',
        },
      ],
    },
  ];

  // 从路径中提取当前选中的 key
  const getSelectedKey = () => {
    const pathParts = location.pathname.split('/');
    return pathParts[pathParts.length - 1] || 'models';
  };

  const selectedKey = getSelectedKey();

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(`/settings/${key}`);
  };

  return (
    <div className={styles.container}>
      <Layout className={styles.layout}>
        <Sider width={240} className={styles.sider} theme="light">
          <div className={styles.sidebarTitle}>{t('settings.title')}</div>
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            items={menuItems}
            onClick={handleMenuClick}
            className={styles.menu}
          />
        </Sider>
        <Content className={styles.content}>
          <div className={styles.scrollContainer}>
            <Outlet />
          </div>
        </Content>
      </Layout>
    </div>
  );
}

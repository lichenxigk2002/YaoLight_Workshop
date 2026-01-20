import { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import {
  UserOutlined,
  CloudServerOutlined,
  CreditCardOutlined,
  DatabaseOutlined,
  ApiOutlined,
  SettingOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
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
          key: 'members',
          icon: <UserOutlined />,
          label: t('settings.members'),
        },
        {
          key: 'billing',
          icon: <CreditCardOutlined />,
          label: t('settings.billing'),
        },
        {
          key: 'datasources',
          icon: <DatabaseOutlined />,
          label: t('settings.datasources'),
        },
        {
          key: 'extensions',
          icon: <ApiOutlined />,
          label: t('settings.extensions'),
        },
        {
          key: 'customization',
          icon: <SettingOutlined />,
          label: t('settings.customization'),
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

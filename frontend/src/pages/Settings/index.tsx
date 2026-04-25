import { Layout, Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  BellOutlined,
  CloudServerOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  GlobalOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import styles from './index.module.scss';

const { Sider, Content } = Layout;

export default function Settings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems: MenuProps['items'] = [
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
          label: t('settings.orders'),
        },
        {
          key: 'billing',
          icon: <FileTextOutlined />,
          label: t('settings.billingOverview'),
        },
        {
          key: 'token-transactions',
          icon: <FileTextOutlined />,
          label: t('settings.tokenTransactionsTitle'),
        },
        {
          key: 'invite',
          icon: <TeamOutlined />,
          label: t('settings.inviteFriends'),
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
          label: t('settings.assistant'),
        },
      ],
    },
  ];

  const getSelectedKey = () => {
    const pathParts = location.pathname.split('/');
    return pathParts[pathParts.length - 1] || 'models';
  };

  const selectedKey = getSelectedKey();
  const isProfilePage = selectedKey === 'profile';

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(`/settings/${key}`);
  };

  return (
    <div className={`${styles.container} ${isProfilePage ? styles.profileMode : ''}`}>
      <div className={styles.glow} />
      <div className={styles.shell}>
        <div className={styles.pageIntro}>
          <span className={styles.eyebrow}>{t('settings.title')}</span>
          <div className={styles.pageTitle}>{t('settings.title')}</div>
          <div className={styles.pageSubtitle}>
            {t('settings.pageSubtitle')}
          </div>
        </div>

        <Layout className={styles.layout}>
          <Sider width={228} className={styles.sider} theme="light">
            <div className={styles.sidebarPanel}>
              <div className={styles.sidebarTitle}>{t('settings.title')}</div>
              <div className={styles.sidebarHint}>
                {t('settings.sidebarHint')}
              </div>
              <Menu
                mode="inline"
                selectedKeys={[selectedKey]}
                items={menuItems}
                onClick={handleMenuClick}
                className={styles.menu}
              />
            </div>
          </Sider>
          <Content className={styles.content}>
            <div className={styles.contentSurface}>
              <div className={styles.scrollContainer}>
                <Outlet />
              </div>
            </div>
          </Content>
        </Layout>
      </div>
    </div>
  );
}

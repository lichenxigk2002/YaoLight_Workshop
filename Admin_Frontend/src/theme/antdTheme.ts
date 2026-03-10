import type { ThemeConfig } from 'antd';

export const adminAntdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#8b5cf6',
    colorInfo: '#60a5fa',
    colorSuccess: '#15803d',
    colorWarning: '#b45309',
    colorError: '#b91c1c',
    borderRadius: 14,
    fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif',
    colorBgLayout: '#f5f3ff',
    colorBgContainer: '#fafaff',
    colorText: '#1f2937',
    colorTextSecondary: '#5b6472',
    boxShadowSecondary: '0 20px 40px rgba(139, 92, 246, 0.08)',
  },
  components: {
    Layout: {
      headerBg: '#faf5ff',
      siderBg: '#e9d5ff',
      bodyBg: '#f5f3ff',
      triggerBg: '#e9d5ff',
      triggerColor: '#6b21a8',
    },
    Menu: {
      itemBg: '#e9d5ff',
      subMenuItemBg: '#e9d5ff',
      itemSelectedBg: '#ddd6fe',
      itemHoverBg: '#ede9fe',
      itemColor: '#5b21b6',
      itemSelectedColor: '#4c1d95',
    },
    Card: {
      borderRadiusLG: 20,
    },
    Table: {
      headerBg: '#f5f3ff',
      rowHoverBg: '#faf5ff',
    },
    Tabs: {
      itemSelectedColor: '#5b21b6',
      itemHoverColor: '#7c3aed',
      itemActiveColor: '#5b21b6',
      inkBarColor: '#8b5cf6',
    },
  },
};


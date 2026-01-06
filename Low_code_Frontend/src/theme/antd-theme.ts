import type { ThemeConfig } from 'antd';

// 黑白主题配置
export const blackWhiteTheme: ThemeConfig = {
  token: {
    // 主色调改为黑色
    colorPrimary: '#000000',
    colorPrimaryHover: '#333333',
    colorPrimaryActive: '#000000',
    
    // 链接颜色
    colorLink: '#000000',
    colorLinkHover: '#333333',
    colorLinkActive: '#000000',
    
    // 成功/警告/错误保持原样（便于区分状态）
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    
    // 边框圆角
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    
    // 字体
    fontSize: 14,
    fontSizeHeading1: 38,
    fontSizeHeading2: 30,
    fontSizeHeading3: 24,
    fontSizeHeading4: 20,
    fontSizeHeading5: 16,
  },
  components: {
    Button: {
      primaryColor: '#ffffff',
      colorPrimary: '#000000',
      colorPrimaryHover: '#333333',
      colorPrimaryActive: '#000000',
      borderRadius: 12,
      controlHeight: 44,
      controlHeightLG: 52,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 12,
      controlHeight: 44,
      controlHeightLG: 52,
      activeBorderColor: '#000000',
      hoverBorderColor: '#333333',
    },
    Select: {
      borderRadius: 12,
      controlHeight: 44,
      colorPrimary: '#000000',
      colorPrimaryHover: '#333333',
    },
    Tabs: {
      colorPrimary: '#000000',
      inkBarColor: '#000000',
      itemColor: '#999999',
      itemHoverColor: '#000000',
      itemSelectedColor: '#000000',
      itemActiveColor: '#000000',
    },
    Card: {
      borderRadius: 16,
    },
    Modal: {
      borderRadius: 16,
    },
    Table: {
      borderRadius: 12,
      colorPrimary: '#000000',
      rowHoverBg: '#f5f5f5',
      rowSelectedBg: '#f0f0f0',
      rowSelectedHoverBg: '#e8e8e8',
    },
    Pagination: {
      colorPrimary: '#000000',
      colorPrimaryHover: '#333333',
    },
    Switch: {
      colorPrimary: '#000000',
      colorPrimaryHover: '#333333',
    },
  },
};


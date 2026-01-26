import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export const getThemeConfig = (mode: 'light' | 'dark'): ThemeConfig => {
  const isDark = mode === 'dark';
  
  // 基础颜色定义
  const primaryColor = isDark ? '#ffffff' : '#000000';
  const primaryHoverColor = isDark ? '#e6e6e6' : '#333333';
  const componentBg = isDark ? '#141414' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';

  return {
    // 自动应用 Ant Design 的亮色或暗色算法
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    
    token: {
      // 主色调
      colorPrimary: primaryColor,
      colorPrimaryHover: primaryHoverColor,
      colorPrimaryActive: primaryColor,

      // 链接颜色
      colorLink: primaryColor,
      colorLinkHover: primaryHoverColor,
      colorLinkActive: primaryColor,

      // 成功/警告/错误保持原样
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
      
      // 暗色模式下的基础背景色
      colorBgBase: isDark ? '#000000' : '#ffffff',
      colorTextBase: isDark ? '#ffffff' : '#000000',
    },
    components: {
      Button: {
        primaryColor: isDark ? '#000000' : '#ffffff', // 按钮文字颜色反转
        colorPrimary: primaryColor,
        colorPrimaryHover: primaryHoverColor,
        colorPrimaryActive: primaryColor,
        borderRadius: 12,
        controlHeight: 44,
        controlHeightLG: 52,
        fontWeight: 500,
      },
      Input: {
        borderRadius: 12,
        controlHeight: 44,
        controlHeightLG: 52,
        activeBorderColor: primaryColor,
        hoverBorderColor: primaryHoverColor,
        colorBgContainer: isDark ? '#1f1f1f' : '#ffffff',
      },
      Select: {
        borderRadius: 12,
        controlHeight: 44,
        colorPrimary: primaryColor,
        colorPrimaryHover: primaryHoverColor,
        selectorBg: isDark ? '#1f1f1f' : '#ffffff',
        optionSelectedBg: isDark ? '#333333' : '#e6f7ff',
      },
      Tabs: {
        colorPrimary: primaryColor,
        inkBarColor: primaryColor,
        itemColor: isDark ? '#999999' : '#999999',
        itemHoverColor: primaryColor,
        itemSelectedColor: primaryColor,
        itemActiveColor: primaryColor,
      },
      Card: {
        borderRadius: 16,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        // 覆盖 filled 变体的背景色，使用与容器相同的背景色
        colorFillSecondary: isDark ? '#141414' : '#ffffff',
        colorFillTertiary: isDark ? '#141414' : '#ffffff',
      },
      Modal: {
        borderRadius: 16,
        contentBg: isDark ? '#1f1f1f' : '#ffffff',
        headerBg: isDark ? '#1f1f1f' : '#ffffff',
      },
      Table: {
        borderRadius: 12,
        colorPrimary: primaryColor,
        colorBgContainer: isDark ? '#141414' : '#ffffff',
        headerBg: isDark ? '#1f1f1f' : '#fafafa',
        rowHoverBg: isDark ? '#333333' : '#f5f5f5',
        rowSelectedBg: isDark ? '#262626' : '#f0f0f0',
        rowSelectedHoverBg: isDark ? '#303030' : '#e8e8e8',
      },
      Pagination: {
        colorPrimary: primaryColor,
        colorPrimaryHover: primaryHoverColor,
        itemActiveBg: isDark ? '#333333' : '#ffffff',
      },
      Switch: {
        colorPrimary: primaryColor,
        colorPrimaryHover: primaryHoverColor,
      },
      Tooltip: {
        colorBgSpotlight: isDark ? '#333333' : '#ffffff',
        colorTextLightSolid: isDark ? '#ffffff' : '#000000',
      },
      Form: {
        labelColor: textColor, // 确保表单标签颜色正确
      }
    },
  };
};

// 保持向下兼容（如果其他地方用了这个变量）
export const blackWhiteTheme = getThemeConfig('light');

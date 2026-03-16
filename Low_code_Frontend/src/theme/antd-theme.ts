import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export const getThemeConfig = (mode: 'light' | 'dark'): ThemeConfig => {
  const isDark = mode === 'dark';

  const primaryColor = isDark ? '#ffffff' : '#000000';
  const primaryHoverColor = isDark ? '#e6e6e6' : '#333333';
  const componentBg = isDark ? '#181818' : '#ffffff';
  const elevatedBg = isDark ? '#202020' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#000000';
  const borderColor = isDark ? '#3a3a3a' : '#d9d9d9';
  const borderColorSecondary = isDark ? '#2f2f2f' : '#e8e8e8';

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: primaryColor,
      colorPrimaryHover: primaryHoverColor,
      colorPrimaryActive: primaryColor,
      colorLink: primaryColor,
      colorLinkHover: primaryHoverColor,
      colorLinkActive: primaryColor,
      colorSuccess: '#52c41a',
      colorWarning: '#faad14',
      colorError: '#ff4d4f',
      borderRadius: 12,
      borderRadiusLG: 16,
      borderRadiusSM: 8,
      fontSize: 14,
      fontFamily:
        '"Avenir Next", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Source Han Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif',
      fontFamilyCode:
        '"SFMono-Regular", "JetBrains Mono", "Cascadia Code", "Consolas", "Liberation Mono", monospace',
      fontSizeHeading1: 38,
      fontSizeHeading2: 30,
      fontSizeHeading3: 24,
      fontSizeHeading4: 20,
      fontSizeHeading5: 16,
      colorBgBase: isDark ? '#000000' : '#ffffff',
      colorTextBase: isDark ? '#ffffff' : '#000000',
      colorBgContainer: componentBg,
      colorBgElevated: elevatedBg,
      colorBorder: borderColor,
      colorBorderSecondary: borderColorSecondary,
    },
    components: {
      Button: {
        primaryColor: isDark ? '#000000' : '#ffffff',
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
        colorBgContainer: isDark ? '#232323' : '#ffffff',
        colorText: textColor,
        colorTextPlaceholder: isDark ? 'rgba(255,255,255,0.34)' : 'rgba(0,0,0,0.38)',
      },
      Select: {
        borderRadius: 12,
        controlHeight: 44,
        colorPrimary: primaryColor,
        colorPrimaryHover: primaryHoverColor,
        selectorBg: isDark ? '#232323' : '#ffffff',
        optionSelectedBg: isDark ? '#2b2b2b' : '#f3f4f6',
        colorText: textColor,
      },
      Tabs: {
        colorPrimary: primaryColor,
        inkBarColor: primaryColor,
        itemColor: '#999999',
        itemHoverColor: primaryColor,
        itemSelectedColor: primaryColor,
        itemActiveColor: primaryColor,
      },
      Card: {
        borderRadius: 16,
        colorBgContainer: componentBg,
        colorFillSecondary: componentBg,
        colorFillTertiary: componentBg,
      },
      Modal: {
        borderRadius: 16,
        contentBg: componentBg,
        headerBg: componentBg,
        titleColor: textColor,
      },
      Table: {
        borderRadius: 12,
        colorPrimary: primaryColor,
        colorBgContainer: componentBg,
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
        labelColor: textColor,
        labelFontSize: 14,
      },
    },
  };
};

export const blackWhiteTheme = getThemeConfig('light');

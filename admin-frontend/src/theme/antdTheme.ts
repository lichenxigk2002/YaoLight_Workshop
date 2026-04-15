import { theme, type ThemeConfig } from 'antd';
import type { AdminThemeResolvedPreset, AdminThemeMode } from './presets';

export function createAdminAntdTheme(preset: AdminThemeResolvedPreset, mode: AdminThemeMode): ThemeConfig {
  const primaryColor = preset.id === 'white' && mode === 'light' ? preset.brandInk : preset.brand;
  const infoColor = preset.id === 'white' && mode === 'light' ? preset.inkSoft : preset.accent;

  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: primaryColor,
      colorInfo: infoColor,
      colorSuccess: preset.success,
      colorWarning: preset.warning,
      colorError: preset.error,
      borderRadius: 14,
      fontFamily: '"IBM Plex Sans", "Aptos", "Segoe UI", sans-serif',
      colorBgLayout: preset.bg,
      colorBgContainer: preset.panel,
      colorText: preset.ink,
      colorTextSecondary: preset.inkSoft,
      colorBorder: preset.line,
      colorBorderSecondary: preset.line,
      boxShadowSecondary: preset.shadow,
    },
    components: {
      Layout: {
        headerBg: preset.headerBg,
        siderBg: preset.siderBg,
        bodyBg: preset.bg,
        triggerBg: preset.siderBg,
        triggerColor: primaryColor,
      },
      Menu: {
        itemBg: preset.siderBg,
        subMenuItemBg: preset.siderBg,
        itemSelectedBg: preset.menuSelectedBg,
        itemHoverBg: preset.menuHoverBg,
        itemColor: preset.menuColor,
        itemSelectedColor: primaryColor,
      },
      Card: {
        borderRadiusLG: 20,
      },
      Table: {
        headerBg: preset.tableHeaderBg,
        rowHoverBg: preset.tableRowHoverBg,
      },
      Tabs: {
        itemSelectedColor: primaryColor,
        itemHoverColor: infoColor,
        itemActiveColor: primaryColor,
        inkBarColor: primaryColor,
      },
      Segmented: {
        itemSelectedBg: preset.segmentedSelectedBg,
      },
    },
  };
}

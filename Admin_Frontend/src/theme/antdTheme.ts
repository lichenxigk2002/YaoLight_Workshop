import { theme, type ThemeConfig } from 'antd';
import type { AdminThemeResolvedPreset, AdminThemeMode } from './presets';

export function createAdminAntdTheme(preset: AdminThemeResolvedPreset, mode: AdminThemeMode): ThemeConfig {
  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: preset.brand,
      colorInfo: preset.accent,
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
        triggerColor: preset.brand,
      },
      Menu: {
        itemBg: preset.siderBg,
        subMenuItemBg: preset.siderBg,
        itemSelectedBg: preset.menuSelectedBg,
        itemHoverBg: preset.menuHoverBg,
        itemColor: preset.menuColor,
        itemSelectedColor: preset.brand,
      },
      Card: {
        borderRadiusLG: 20,
      },
      Table: {
        headerBg: preset.tableHeaderBg,
        rowHoverBg: preset.tableRowHoverBg,
      },
      Tabs: {
        itemSelectedColor: preset.brand,
        itemHoverColor: preset.accent,
        itemActiveColor: preset.brand,
        inkBarColor: preset.brand,
      },
      Segmented: {
        itemSelectedBg: preset.segmentedSelectedBg,
      },
    },
  };
}

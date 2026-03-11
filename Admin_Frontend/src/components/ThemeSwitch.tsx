import { BgColorsOutlined, BulbOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons';
import { Button, Popover, Space, Tooltip } from 'antd';
import { useI18n } from '@/i18n';
import { useAdminTheme } from '@/theme';
import type { AdminThemeMode, AdminThemePaletteId } from '@/theme/presets';
import styles from './ThemeSwitch.module.scss';

const paletteLabels: Record<'zh-CN' | 'en-US', Record<AdminThemePaletteId, string>> = {
  'zh-CN': {
    blue: '蓝',
    green: '绿',
    yellow: '黄',
    purple: '紫',
    red: '红',
    pink: '粉',
    orange: '橙',
  },
  'en-US': {
    blue: 'Blue',
    green: 'Green',
    yellow: 'Yellow',
    purple: 'Purple',
    red: 'Red',
    pink: 'Pink',
    orange: 'Orange',
  },
};

const modeLabels: Record<'zh-CN' | 'en-US', Record<AdminThemeMode, string>> = {
  'zh-CN': {
    light: '昼间',
    dark: '夜间',
  },
  'en-US': {
    light: 'Light',
    dark: 'Dark',
  },
};

const panelLabels: Record<'zh-CN' | 'en-US', { title: string; mode: string; palette: string }> = {
  'zh-CN': {
    title: '主题外观',
    mode: '昼夜模式',
    palette: '调色板',
  },
  'en-US': {
    title: 'Theme',
    mode: 'Mode',
    palette: 'Palette',
  },
};

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(' ');
}

export default function ThemeSwitch() {
  const { locale } = useI18n();
  const { mode, setMode, paletteId, setPaletteId, palettes } = useAdminTheme();

  const content = (
    <div className={styles.panel}>
      <div className={styles.title}>{panelLabels[locale].title}</div>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>{panelLabels[locale].mode}</div>
        <div className={styles.modeGroup}>
          <button
            type="button"
            className={cx(styles.modeButton, mode === 'light' && styles.modeButtonActive)}
            onClick={() => setMode('light')}
            aria-pressed={mode === 'light'}
          >
            <SunOutlined />
            <span>{modeLabels[locale].light}</span>
          </button>
          <button
            type="button"
            className={cx(styles.modeButton, mode === 'dark' && styles.modeButtonActive)}
            onClick={() => setMode('dark')}
            aria-pressed={mode === 'dark'}
          >
            <MoonOutlined />
            <span>{modeLabels[locale].dark}</span>
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionLabel}>{panelLabels[locale].palette}</div>
        <div className={styles.paletteGrid}>
          {palettes.map((palette) => {
            const active = palette.id === paletteId;
            return (
              <button
                key={palette.id}
                type="button"
                className={cx(styles.paletteButton, active && styles.paletteButtonActive)}
                onClick={() => setPaletteId(palette.id)}
                aria-pressed={active}
              >
                <span
                  className={styles.swatch}
                  style={{ background: `linear-gradient(135deg, ${palette.brand}, ${palette.accent})` }}
                />
                <span>{paletteLabels[locale][palette.id]}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );

  return (
    <Popover trigger="click" placement="bottomRight" content={content} overlayClassName={styles.popover}>
      <Tooltip title={panelLabels[locale].title}>
        <Button
          type="text"
          aria-label={panelLabels[locale].title}
          className={styles.trigger}
          icon={mode === 'dark' ? <MoonOutlined /> : <BgColorsOutlined />}
        >
          <Space size={6} className={styles.triggerLabel}>
            <BulbOutlined style={{ color: 'var(--admin-brand)' }} />
            <span>{paletteLabels[locale][paletteId]}</span>
          </Space>
        </Button>
      </Tooltip>
    </Popover>
  );
}

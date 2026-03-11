import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createAdminAntdTheme } from './antdTheme';
import {
  adminThemePalettes,
  getAdminThemePalette,
  resolveAdminTheme,
  type AdminThemeMode,
  type AdminThemePaletteId,
} from './presets';

const PALETTE_STORAGE_KEY = 'yaolight_admin_theme_palette';
const MODE_STORAGE_KEY = 'yaolight_admin_theme_mode';

type AdminThemeContextValue = {
  paletteId: AdminThemePaletteId;
  setPaletteId: (paletteId: AdminThemePaletteId) => void;
  mode: AdminThemeMode;
  setMode: (mode: AdminThemeMode) => void;
  palettes: typeof adminThemePalettes;
  resolvedTheme: ReturnType<typeof resolveAdminTheme>;
  antdTheme: ReturnType<typeof createAdminAntdTheme>;
};

const AdminThemeContext = createContext<AdminThemeContextValue | null>(null);

function getStoredPaletteId(): AdminThemePaletteId {
  if (typeof window === 'undefined') {
    return 'blue';
  }

  const raw = window.localStorage.getItem(PALETTE_STORAGE_KEY);
  return (adminThemePalettes.some((palette) => palette.id === raw) ? raw : 'blue') as AdminThemePaletteId;
}

function getStoredMode(): AdminThemeMode {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
  return raw === 'dark' ? 'dark' : 'light';
}

function applyThemeVariables(themeState: ReturnType<typeof resolveAdminTheme>) {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.dataset.themeMode = themeState.mode;
  root.dataset.themePalette = themeState.id;
  root.style.setProperty('--admin-bg', themeState.bg);
  root.style.setProperty('--admin-panel', themeState.panel);
  root.style.setProperty('--admin-panel-alt', themeState.panelAlt);
  root.style.setProperty('--admin-ink', themeState.ink);
  root.style.setProperty('--admin-ink-soft', themeState.inkSoft);
  root.style.setProperty('--admin-line', themeState.line);
  root.style.setProperty('--admin-brand', themeState.brand);
  root.style.setProperty('--admin-accent', themeState.accent);
  root.style.setProperty('--admin-brand-soft', themeState.soft);
  root.style.setProperty('--admin-brand-soft-strong', themeState.softStrong);
  root.style.setProperty('--admin-brand-ink', themeState.brandInk);
  root.style.setProperty('--admin-shadow', themeState.shadow);
}

export function AdminThemeProvider({ children }: { children: ReactNode }) {
  const [paletteId, setPaletteIdState] = useState<AdminThemePaletteId>(getStoredPaletteId);
  const [mode, setModeState] = useState<AdminThemeMode>(getStoredMode);

  const resolvedTheme = useMemo(() => resolveAdminTheme(paletteId, mode), [paletteId, mode]);
  const antdTheme = useMemo(() => createAdminAntdTheme(resolvedTheme, mode), [resolvedTheme, mode]);

  useEffect(() => {
    applyThemeVariables(resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo<AdminThemeContextValue>(() => {
    return {
      paletteId,
      setPaletteId: (nextPaletteId) => {
        window.localStorage.setItem(PALETTE_STORAGE_KEY, nextPaletteId);
        setPaletteIdState(getAdminThemePalette(nextPaletteId).id);
      },
      mode,
      setMode: (nextMode) => {
        window.localStorage.setItem(MODE_STORAGE_KEY, nextMode);
        setModeState(nextMode);
      },
      palettes: adminThemePalettes,
      resolvedTheme,
      antdTheme,
    };
  }, [antdTheme, mode, paletteId, resolvedTheme]);

  return <AdminThemeContext.Provider value={value}>{children}</AdminThemeContext.Provider>;
}

export function useAdminTheme() {
  const context = useContext(AdminThemeContext);
  if (!context) {
    throw new Error('useAdminTheme must be used within AdminThemeProvider');
  }
  return context;
}

export type AdminThemeMode = 'light' | 'dark';
export type AdminThemePaletteId = 'blue' | 'green' | 'yellow' | 'purple' | 'red' | 'pink' | 'orange';

type AdminThemePalette = {
  id: AdminThemePaletteId;
  label: string;
  brand: string;
  accent: string;
  soft: string;
  softStrong: string;
  brandInk: string;
};

export type AdminThemeResolvedPreset = {
  id: AdminThemePaletteId;
  label: string;
  mode: AdminThemeMode;
  brand: string;
  accent: string;
  brandInk: string;
  bg: string;
  panel: string;
  panelAlt: string;
  headerBg: string;
  siderBg: string;
  ink: string;
  inkSoft: string;
  line: string;
  success: string;
  warning: string;
  error: string;
  shadow: string;
  soft: string;
  softStrong: string;
  menuSelectedBg: string;
  menuHoverBg: string;
  menuColor: string;
  tableHeaderBg: string;
  tableRowHoverBg: string;
  segmentedSelectedBg: string;
};

export const adminThemePalettes: AdminThemePalette[] = [
  { id: 'blue', label: 'Blue', brand: '#1677ff', accent: '#4096ff', soft: '#edf5ff', softStrong: '#d9eaff', brandInk: '#1d4f91' },
  { id: 'green', label: 'Green', brand: '#16a34a', accent: '#22c55e', soft: '#eefcf3', softStrong: '#d7f8e2', brandInk: '#166534' },
  { id: 'yellow', label: 'Yellow', brand: '#ca8a04', accent: '#f59e0b', soft: '#fff8e6', softStrong: '#ffefbf', brandInk: '#854d0e' },
  { id: 'purple', label: 'Purple', brand: '#7c3aed', accent: '#a855f7', soft: '#f5efff', softStrong: '#eadcff', brandInk: '#5b21b6' },
  { id: 'red', label: 'Red', brand: '#dc2626', accent: '#f87171', soft: '#fff1f2', softStrong: '#ffd9dd', brandInk: '#991b1b' },
  { id: 'pink', label: 'Pink', brand: '#db2777', accent: '#f472b6', soft: '#fff0f7', softStrong: '#ffd6ea', brandInk: '#9d174d' },
  { id: 'orange', label: 'Orange', brand: '#ea580c', accent: '#fb923c', soft: '#fff4eb', softStrong: '#ffe0cb', brandInk: '#9a3412' },
];

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getAdminThemePalette(paletteId: AdminThemePaletteId) {
  return adminThemePalettes.find((palette) => palette.id == paletteId) ?? adminThemePalettes[0];
}

export function resolveAdminTheme(paletteId: AdminThemePaletteId, mode: AdminThemeMode): AdminThemeResolvedPreset {
  const palette = getAdminThemePalette(paletteId);

  if (mode === 'dark') {
    return {
      ...palette,
      mode,
      bg: '#0b1220',
      panel: '#101a2c',
      panelAlt: '#0f1e33',
      headerBg: '#101a2c',
      siderBg: '#0f1e33',
      ink: '#e5eefb',
      inkSoft: '#9fb3cf',
      line: 'rgba(148, 163, 184, 0.18)',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      shadow: `0 24px 48px ${hexToRgba(palette.brand, 0.18)}`,
      soft: hexToRgba(palette.brand, 0.14),
      softStrong: hexToRgba(palette.brand, 0.24),
      menuSelectedBg: hexToRgba(palette.brand, 0.22),
      menuHoverBg: hexToRgba(palette.brand, 0.12),
      menuColor: '#c8d7ee',
      tableHeaderBg: '#10213a',
      tableRowHoverBg: '#132844',
      segmentedSelectedBg: '#ffffff',
    };
  }

  return {
    ...palette,
    mode,
    bg: '#f5f7fa',
    panel: '#ffffff',
    panelAlt: '#f7fbff',
    headerBg: '#ffffff',
    siderBg: palette.soft,
    ink: '#1f2937',
    inkSoft: '#667085',
    line: 'rgba(31, 41, 55, 0.10)',
    success: '#15803d',
    warning: '#b45309',
    error: '#b91c1c',
    shadow: `0 20px 40px ${hexToRgba(palette.brand, 0.10)}`,
    soft: palette.soft,
    softStrong: palette.softStrong,
    menuSelectedBg: palette.softStrong,
    menuHoverBg: '#f5f9ff',
    menuColor: '#245b94',
    tableHeaderBg: '#f7fbff',
    tableRowHoverBg: '#f5f9ff',
    segmentedSelectedBg: '#ffffff',
  };
}

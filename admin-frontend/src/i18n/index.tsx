import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Locale as AntdLocale } from 'antd/es/locale';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import type { AdminLocale } from './messages';
import { getCurrentAdminLocale, setCurrentAdminLocale, translate } from './runtime';

interface I18nContextValue {
  locale: AdminLocale;
  setLocale: (locale: AdminLocale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  antdLocale: AntdLocale;
  dayjsLocale: string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(getCurrentAdminLocale);

  const value = useMemo<I18nContextValue>(() => {
    const setLocale = (nextLocale: AdminLocale) => {
      setCurrentAdminLocale(nextLocale);
      setLocaleState(nextLocale);
    };

    return {
      locale,
      setLocale,
      t: (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
      antdLocale: locale === 'en-US' ? enUS : zhCN,
      dayjsLocale: locale === 'en-US' ? 'en' : 'zh-cn',
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

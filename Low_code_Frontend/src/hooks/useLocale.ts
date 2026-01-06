import { useState, useCallback } from 'react';
import { getLocale, type Locale } from '@/locales';

export const useLocale = () => {
  const [locale, setLocaleState] = useState<Locale>(
    (localStorage.getItem('locale') as Locale) || 'zh-CN'
  );

  const t = getLocale(locale);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('locale', newLocale);
  }, []);

  return {
    locale,
    setLocale,
    t,
  };
};


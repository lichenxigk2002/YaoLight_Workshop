import zhCN from './zh-CN';
import enUS from './en-US';

export type Locale = 'zh-CN' | 'en-US';

export const locales = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const getLocale = (locale: Locale) => {
  return locales[locale] || locales['zh-CN'];
};

export default locales;


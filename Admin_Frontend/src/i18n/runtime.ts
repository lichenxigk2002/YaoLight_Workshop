import { messages, type AdminLocale } from './messages';

const LOCALE_STORAGE_KEY = 'yaolight_admin_locale';

type TranslateParams = Record<string, string | number>;

export function getCurrentAdminLocale(): AdminLocale {
  if (typeof window === 'undefined') {
    return 'zh-CN';
  }

  const raw = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return raw === 'en-US' ? 'en-US' : 'zh-CN';
}

export function setCurrentAdminLocale(locale: AdminLocale) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }
}

function resolveMessage(locale: AdminLocale, key: string): string {
  const value = key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages[locale]);

  return typeof value === 'string' ? value : key;
}

function interpolate(message: string, params?: TranslateParams) {
  if (!params) {
    return message;
  }

  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    message,
  );
}

export function translate(locale: AdminLocale, key: string, params?: TranslateParams) {
  return interpolate(resolveMessage(locale, key), params);
}

export function translateCurrent(key: string, params?: TranslateParams) {
  return translate(getCurrentAdminLocale(), key, params);
}

export function toIntlLocale(locale: AdminLocale) {
  return locale === 'en-US' ? 'en-US' : 'zh-CN';
}

export function formatDateTime(
  value?: string | null,
  locale: AdminLocale = getCurrentAdminLocale(),
  fallback = '-',
) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

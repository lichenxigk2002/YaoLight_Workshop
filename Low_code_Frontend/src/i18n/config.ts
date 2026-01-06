import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zhCN from './locales/zh-CN.json';
import enUS from './locales/en-US.json';

// 从 localStorage 获取用户上次选择的语言
const savedLanguage = localStorage.getItem('i18nextLng') || 'zh-CN';

i18n
  .use(initReactI18next) // 绑定 react-i18next
  .init({
    resources: {
      'zh-CN': {
        translation: zhCN,
      },
      'en-US': {
        translation: enUS,
      },
    },
    lng: savedLanguage, // 默认语言
    fallbackLng: 'zh-CN', // 降级语言
    interpolation: {
      escapeValue: false, // React 已经处理了 XSS
    },
    react: {
      useSuspense: false, // 关闭 Suspense，避免闪烁
    },
  });

export default i18n;


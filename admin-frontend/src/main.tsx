import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { App as AntdApp, ConfigProvider } from 'antd';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/zh-cn';
import App from './App';
import { I18nProvider, useI18n } from './i18n';
import { AdminThemeProvider, useAdminTheme } from './theme';
import './styles/global.scss';

function AdminRoot() {
  const { antdLocale, dayjsLocale } = useI18n();
  const { antdTheme } = useAdminTheme();

  useEffect(() => {
    dayjs.locale(dayjsLocale);
  }, [dayjsLocale]);

  return (
    <ConfigProvider locale={antdLocale} theme={antdTheme}>
      <AntdApp>
        <App />
      </AntdApp>
    </ConfigProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <AdminThemeProvider>
        <AdminRoot />
      </AdminThemeProvider>
    </I18nProvider>
  </React.StrictMode>,
);

import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import { AntdGlobal } from './utils/antdGlobal'
import router from './routes'
import { useThemeStore } from './store/theme'
import { getThemeConfig } from './theme/antd-theme'
import './styles/themes/index.scss'
import './i18n/config' // i18n 国际化配置

const App = () => {
  const { theme } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ConfigProvider theme={getThemeConfig(theme)}>
      <AntdApp>
        <AntdGlobal />
        <RouterProvider
          router={router}
          future={{
            v7_startTransition: true,
          }}
        />
      </AntdApp>
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


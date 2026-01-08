import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import router from './routes'
import { useThemeStore } from './store/theme'
import { getThemeConfig } from './theme/antd-theme'
import './styles/themes/index.scss'
import './i18n/config' // i18n 国际化配置

const App = () => {
  const { theme } = useThemeStore()

  // 同步主题到 HTML 属性
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ConfigProvider theme={getThemeConfig(theme)}>
      <RouterProvider router={router} />
    </ConfigProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


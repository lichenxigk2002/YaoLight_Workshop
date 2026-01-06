import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import router from './routes'
import { useThemeStore } from './store/theme'
import { blackWhiteTheme } from './theme/antd-theme'
import './styles/themes/index.scss'
import './i18n/config' // i18n 国际化配置

// 初始化主题
const initTheme = () => {
  const theme = useThemeStore.getState().theme
  document.documentElement.setAttribute('data-theme', theme)
}
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider theme={blackWhiteTheme}>
      <RouterProvider router={router} />
    </ConfigProvider>
  </React.StrictMode>,
)


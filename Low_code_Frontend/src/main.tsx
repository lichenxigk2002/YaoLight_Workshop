import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import router from './routes'
import { useThemeStore } from './store/theme'
import './styles/themes/index.scss'

// 初始化主题
const initTheme = () => {
  const theme = useThemeStore.getState().theme
  document.documentElement.setAttribute('data-theme', theme)
}
initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)


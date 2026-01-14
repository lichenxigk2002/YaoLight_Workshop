## 瑶光工坊状态管理配置（Zustand）

本项目的全局状态管理基于 **Zustand**，所有可复用的应用级状态统一放在 `src/store` 目录中，并通过自定义 hook 暴露（例如：`useAuthStore`、`useThemeStore`）。

### 📁 目录结构

```text
src/store/
├── auth.ts      # 认证与用户信息状态
├── theme.ts     # 主题（明暗模式）状态
└── index.ts     # 统一导出入口
```

### 🧱 基本约定

- **命名规范**
  - 每个 store 文件命名为功能名：`auth.ts`、`theme.ts`、`xxx.ts`
  - 导出的 hook 必须以 `use*Store` 结尾，例如：`useAuthStore`、`useThemeStore`
  - 类型和接口统一使用 `State` 后缀：如 `AuthState`、`ThemeState`
- **存储规范**
  - 使用 `zustand/middleware` 的 `persist` + `createJSONStorage` 进行本地持久化
  - `storage` 默认使用 `localStorage`
  - `name` 必须全局唯一，并与功能相关，如：`auth-storage`、`theme-storage`

### 🔐 认证状态（auth.ts）

```ts
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      login: (token: string, user: User) => {
        set({ user, token, isAuthenticated: true });
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

- 负责保存 **登录 token**、**当前用户信息** 和 **登录态（`isAuthenticated`）**
- 被登录页、个人中心、路由守卫等组件使用
- Token 的读取会被 `src/http` 用于自动附加到请求头中

### 🎨 主题状态（theme.ts）

```ts
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => {
          const newTheme = state.theme === 'light' ? 'dark' : 'light';
          document.documentElement.setAttribute('data-theme', newTheme);
          return { theme: newTheme };
        }),
      setTheme: (theme: Theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          document.documentElement.setAttribute('data-theme', state.theme);
        }
      },
    }
  )
);
```

- 负责 **明暗主题切换**，并通过设置 `document.documentElement` 上的 `data-theme` 属性与样式联动
- 在布局组件 Header 中通过 `useThemeStore` 控制主题按钮和 Logo 展示

### 🚪 统一导出（index.ts）

`src/store/index.ts` 用于统一导出所有 store，推荐在业务代码中从这里引入：

```ts
// src/store/index.ts
export * from './auth';
export * from './theme';
```

组件中使用示例：

```ts
import { useAuthStore, useThemeStore } from '@/store';

const { user, logout } = useAuthStore();
const { theme, toggleTheme } = useThemeStore();
```

### ➕ 新增 Store 的规范

1. 在 `src/store` 下创建对应文件，例如：`workflow.ts`
2. 定义 `XxxState` 接口，明确 state / actions
3. 使用 `create` + 可选的 `persist` 封装为 `useXxxStore`
4. 在 `src/store/index.ts` 中统一导出
5. 避免在 store 中直接操作 DOM，除非是类似主题这种 **全局 UI 属性**（并在 README 中说明）




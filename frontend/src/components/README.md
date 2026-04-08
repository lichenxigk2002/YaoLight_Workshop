## 瑶光工坊组件规范（React + Ant Design）

本目录存放瑶光工坊前端的 **通用 UI 组件** 与 **复杂业务组件**，包括整体布局、路由守卫、设置入口以及低代码工作流编辑器等。组件应保持 **可复用、职责单一、命名清晰**。

### 📁 目录结构

```text
src/components/
├── Icons/             # 项目通用图标封装
├── Layout/            # 顶层布局组件（Header / Content / 侧边等）
├── ProtectedRoute/    # 路由守卫组件
├── SettingsButton/    # 全局设置入口按钮
└── WorkflowEditor/    # 工作流可视化编辑器（低代码核心）
```

#### `Icons/`
- 存放项目中复用的图标组件，例如：`StarBadgeIcon`。
- 对外统一通过 `Icons/index.ts` 导出，方便按需引入。

#### `Layout/`
- 提供应用级布局（Header + 内容区），负责：
  - 渲染 Logo、品牌文案（使用 i18n 的 `common.*` 文案）
  - 用户信息展示与退出登录
  - 主题切换（依赖 `useThemeStore`）
  - 语言切换（依赖 `react-i18next`）
- 只承担 UI 布局和交互逻辑，不直接发起业务 API 请求。

#### `ProtectedRoute/`
- 使用 `useAuthStore` 对登录态进行检查，未登录时跳转到 `/login`。
- 用法示例：

```tsx
import ProtectedRoute from '@/components/ProtectedRoute';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>;
```

#### `SettingsButton/`
- 全局设置入口按钮组件，通常用于打开配置面板或跳转到设置页面。
- 只负责触发外部传入的 `onClick` / 回调，不直接耦合业务逻辑。

#### `WorkflowEditor/`
- 低代码工作流编辑器的核心模块，内部再拆分为多个子目录：

```text
WorkflowEditor/
├── configs/       # 各类节点配置表单（AI 节点 / 爬虫节点 / 条件节点等）
├── extensions/    # 编辑器扩展能力（如 JSON 校验等）
├── hooks/         # 工作流相关的业务 hook（保存 / 执行 / 节点操作等）
├── nodes/         # React Flow 自定义节点组件
├── panels/        # 右侧配置面板、执行结果面板等
├── utils/         # Markdown 渲染、JSON 编辑器、节点格式等工具
└── variables/     # 变量选择器、变量面板等
```

- **职责划分建议**：
  - `nodes/`：只负责渲染单个节点的 UI 和基础交互。
  - `configs/`：负责节点配置表单（表单项 + 校验 + i18n 文案）。
  - `hooks/`：封装工作流保存、执行、右键菜单等业务逻辑。
  - `panels/`：组合多个配置组件，构成右侧面板。
  - `utils/`：只放纯函数和纯 UI 工具组件（例如 `MarkdownRenderer`、`JsonCodeEditor`）。

### 🧱 组件命名与样式规范

- 组件文件名与导出名使用 **大驼峰（PascalCase）**：`Layout.tsx`、`ProtectedRoute.tsx`、`AINode.tsx`。
- 同名样式文件使用 `index.module.scss` 或 `Xxx.module.scss`，通过 CSS Modules 使用：

```tsx
import styles from './index.module.scss';

export default function Layout() {
  return <div className={styles.layout}>...</div>;
}
```

- 业务内复用性高的 UI 组件应放在 `src/components` 下；只在单页使用的组件可以放在对应 `src/pages/**` 目录中。

### 🧩 与其他模块的关系

- **状态管理**：组件通过 `@/store` 使用全局状态（如 `useAuthStore`、`useThemeStore`），不直接访问 `localStorage`。
- **国际化**：文案统一使用 `react-i18next` 的 `useTranslation`，键名遵循 `src/i18n/README.md` 中的命名规范。
- **HTTP / API**：组件中只使用 `@/api/*` 封装好的方法，不直接调用 `@/http`。




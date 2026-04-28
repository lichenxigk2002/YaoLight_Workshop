# 前端测试接入指南

> 适用范围：`frontend` 用户端与 `admin-frontend` 管理端。  
> 当前状态：两个前端项目可以生产构建，但缺少系统化测试。建议先补组件/工具函数测试，再补 2-3 条端到端核心流程。

## 1. 测试目标

前端测试不需要一开始追求“大而全”，本项目更适合按风险分层补齐：

| 层级 | 工具 | 测什么 | 优先级 |
|---|---|---|---|
| 单元测试 | Vitest | 工具函数、数据转换、权限判断、patch 预览算法 | 高 |
| 组件测试 | Vitest + React Testing Library | 表单、列表、弹窗、状态标签、局部业务组件 | 高 |
| 集成测试 | Vitest + Mock API | 页面加载、筛选、提交、错误提示 | 中 |
| E2E 测试 | Playwright | 登录、创建工作流、执行、后台权限等完整链路 | 高 |

推荐第一阶段覆盖以下关键点：

- 用户端：登录页、项目列表、工作流编辑器工具函数、Alkaid patch 预览、任务结果面板。
- 管理端：登录页、权限菜单过滤、用户管理列表、任务列表、AI 模型列表。
- 公共逻辑：HTTP 错误处理、权限判断、日期/状态格式化、数据映射函数。

## 2. 推荐工具

### 2.1 Vitest

Vitest 与 Vite 配合最好，适合本项目已有 React + TypeScript + Vite 技术栈。

用于：

- `*.test.ts`
- `*.test.tsx`
- 工具函数测试
- 组件渲染测试
- Mock API 测试

### 2.2 React Testing Library

React Testing Library 更关注用户能看到什么、能点击什么，适合测试组件行为，而不是测试组件内部实现细节。

用于：

- 表单填写
- 按钮点击
- Modal / Drawer 打开关闭
- loading、empty、error 状态
- 权限下按钮是否显示

### 2.3 Playwright

Playwright 用于端到端测试，适合覆盖毕业答辩中最容易被问到的“核心流程是否真的跑通”。

用于：

- 用户登录
- 创建项目与工作流
- 打开工作流编辑器
- 后台登录
- 后台任务/用户/权限页面访问

## 3. 用户端接入 Vitest

进入用户端目录：

```bash
cd frontend
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8
```

修改 `frontend/package.json` scripts：

```json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

修改 `frontend/vite.config.ts`，建议把 `defineConfig` 从 `vitest/config` 引入，并增加 `test` 配置：

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

新增 `frontend/src/test/setup.ts`：

```ts
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  sessionStorage.clear()
})

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)
```

新增 `frontend/src/test/render.tsx`，统一包装 Router 与 Ant Design：

```tsx
import type { ReactElement } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import { BrowserRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

export function renderWithProviders(ui: ReactElement) {
  return render(
    <BrowserRouter>
      <ConfigProvider>
        <AntdApp>{ui}</AntdApp>
      </ConfigProvider>
    </BrowserRouter>,
  )
}
```

## 4. 管理端接入 Vitest

进入管理端目录：

```bash
cd admin-frontend
npm i -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitest/coverage-v8
```

修改 `admin-frontend/package.json` scripts：

```json
{
  "scripts": {
    "test": "vitest --run",
    "test:watch": "vitest",
    "test:coverage": "vitest --coverage"
  }
}
```

修改 `admin-frontend/vite.config.ts`：

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  base: '/admin/',
  plugins: [react(), adminRootRedirectPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
  },
})
```

新增 `admin-frontend/src/test/setup.ts`，内容可与用户端一致。

新增 `admin-frontend/src/test/render.tsx`：

```tsx
import type { ReactElement } from 'react'
import { App as AntdApp, ConfigProvider } from 'antd'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'

export function renderWithProviders(ui: ReactElement, route = '/admin/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <ConfigProvider>
        <AntdApp>{ui}</AntdApp>
      </ConfigProvider>
    </MemoryRouter>,
  )
}
```

## 5. 测试目录规范

推荐把测试文件放在被测文件旁边，便于维护：

```text
frontend/src/
  utils/
    alkaid/
      patch.ts
      patch.test.ts
  components/
    WorkflowEditor/
      variables/
        nodeVariables.ts
        nodeVariables.test.ts

admin-frontend/src/
  utils/
    permissions.ts
    permissions.test.ts
  pages/
    Tasks/
      taskStatus.ts
      taskStatus.test.ts
```

命名规则：

- 工具函数：`xxx.test.ts`
- React 组件：`xxx.test.tsx`
- E2E：`xxx.spec.ts`

## 6. 示例：权限工具函数测试

以管理端 `admin-frontend/src/utils/permissions.ts` 为例，可新增：

```ts
import { describe, expect, it } from 'vitest'
import { canEditResource, canViewResource } from './permissions'

describe('admin permissions', () => {
  it('allows view permission when exact view key exists', () => {
    expect(canViewResource(['users:view'], 'users')).toBe(true)
  })

  it('allows edit permission only when edit key exists', () => {
    expect(canEditResource(['users:view'], 'users')).toBe(false)
    expect(canEditResource(['users:edit'], 'users')).toBe(true)
  })

  it('supports nested resources', () => {
    expect(canViewResource(['tasks.overview:view'], 'tasks.overview')).toBe(true)
  })
})
```

## 7. 示例：组件测试

以状态标签组件为例：

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderWithProviders } from '@/test/render'
import UserStatusTag from './UserStatusTag'

describe('UserStatusTag', () => {
  it('renders active status', () => {
    renderWithProviders(<UserStatusTag status="active" />)
    expect(screen.getByText(/active|正常/i)).toBeInTheDocument()
  })
})
```

组件测试建议遵循三条原则：

- 优先查用户可见文本、按钮、输入框，而不是 className。
- 不测试 Ant Design 自身行为，只测试本项目传入的数据和交互。
- API 请求用 mock，不依赖真实后端。

## 8. 示例：Mock API 页面测试

如果页面直接调用 API，可以用 `vi.mock` 替换：

```tsx
import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { renderWithProviders } from '@/test/render'
import UsersPage from '@/pages/Users'

vi.mock('@/features/users/api', () => ({
  getAdminUserSummary: vi.fn().mockResolvedValue({
    total: 1,
    active: 1,
    suspended: 0,
    new_last_7_days: 1,
  }),
  getAdminUsers: vi.fn().mockResolvedValue({
    list: [
      {
        id: 1,
        user_no: 10000001,
        username: 'alice',
        email: 'alice@example.com',
        role: 'user',
        status: 'active',
        created_at: '2026-04-27T00:00:00Z',
      },
    ],
    total: 1,
  }),
}))

describe('UsersPage', () => {
  it('renders user list', async () => {
    renderWithProviders(<UsersPage />)

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument()
    })
  })
})
```

## 9. 接入 Playwright E2E

建议在仓库根目录建一个独立 E2E 测试目录，避免用户端和管理端重复安装：

```bash
npm i -D @playwright/test
npx playwright install
```

根目录新增 `playwright.config.ts`：

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'frontend-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3000' },
    },
    {
      name: 'admin-chromium',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3200/admin' },
    },
  ],
})
```

新增 `e2e/frontend-login.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test('frontend login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByRole('button').first()).toBeVisible()
})
```

新增 `e2e/admin-login.spec.ts`：

```ts
import { expect, test } from '@playwright/test'

test('admin login page renders', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input').first()).toBeVisible()
})
```

实际跑完整 E2E 前，需要先启动：

```bash
cd backend && go run cmd/server/main.go
cd frontend && npm run dev
cd admin-frontend && npm run dev
```

然后在根目录执行：

```bash
npx playwright test
```

## 10. 毕设最建议补的 6 个测试

为了对答辩最有帮助，建议优先补这 6 个：

| 编号 | 类型 | 位置 | 测试内容 |
|---|---|---|---|
| 1 | 单元 | `frontend/src/utils/alkaid/patch.test.ts` | Alkaid patch add/remove/set/set_edges 后图结构正确 |
| 2 | 单元 | `admin-frontend/src/utils/permissions.test.ts` | 后台菜单和资源权限判断正确 |
| 3 | 组件 | `frontend/src/components/WorkflowEditor/variables/*.test.tsx` | 变量选择、变量插入、空状态 |
| 4 | 组件 | `admin-frontend/src/pages/Tasks/taskStatus.test.ts` | 任务状态颜色与文案映射 |
| 5 | E2E | `e2e/frontend-workflow.spec.ts` | 登录、进入项目、打开工作流编辑器 |
| 6 | E2E | `e2e/admin-permission.spec.ts` | 管理员登录、菜单权限、进入用户/任务页面 |

这 6 个测试覆盖了项目最有说服力的点：AI patch、权限、画布变量、任务状态、用户端主流程、管理端主流程。

## 11. CI 建议

后续可以把前端测试加入 GitHub Actions：

```yaml
- name: Test frontend
  working-directory: frontend
  run: |
    npm ci
    npm run test
    npm run build

- name: Test admin frontend
  working-directory: admin-frontend
  run: |
    npm ci
    npm run test
    npm run build
```

E2E 建议先不放进主 CI 阻塞部署，等测试数据和环境稳定后再加。

## 12. 论文中怎么写

论文可以这样表述：

> 前端测试采用 Vitest 与 React Testing Library，对工作流编辑器中的数据转换、Alkaid 补丁预览、后台权限判断、任务状态映射等关键逻辑进行单元测试和组件测试。端到端测试采用 Playwright，覆盖用户登录、工作流编辑器访问、管理后台登录和后台核心页面访问等流程。该测试体系从函数正确性、组件交互和真实用户流程三个层面验证系统前端可靠性。

答辩时重点强调：

- 不是所有 UI 都测，而是优先测试高风险核心路径。
- 工具函数和权限判断适合单元测试。
- 表单、弹窗、列表适合组件测试。
- 登录、工作流编辑、后台访问适合 E2E。
- 前端测试与后端 `go test ./...`、生产构建共同构成系统验证证据。


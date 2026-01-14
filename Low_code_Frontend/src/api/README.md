## 瑶光工坊 API 模块规范（/src/api）

本目录用于封装瑶光工坊前端与后端服务的所有接口调用，基于 `@/http` 提供的 HTTP 客户端，按业务域拆分为多个模块（用户、项目、工作流、AI 等），并统一从 `src/api/index.ts` 导出。

### 📁 目录结构

```text
src/api/
├── user.ts      # 用户与认证相关接口
├── project.ts   # 项目管理相关接口
├── workflow.ts  # 工作流编排与执行相关接口
├── ai.ts        # AI 能力相关接口（模型调用等）
└── index.ts     # 统一导出入口
```

### 🧱 设计约定

- **按业务域拆分文件**：一个业务域一个文件，命名使用小写加业务名：`user.ts`、`workflow.ts`、`project.ts`、`ai.ts`。
- **统一导出对象命名**：
  - 用户相关：`userApi`
  - 工作流相关：`workflowApi`
  - 项目相关：`projectApi`
  - AI 相关：`aiApi`
- **只依赖两类模块**：
  - HTTP 客户端：`import http from '@/http';`
  - 类型定义：`import type {...} from '@/types/*';`
- **不在 API 模块中做 UI 逻辑**：不调用 `message`、`notification`、`Modal` 等 UI 组件，错误提示由 `@/http` 统一处理，或交给调用方处理。

### 🔗 使用示例

#### 在组件或 hooks 中调用 API

```ts
import { userApi } from '@/api';

async function fetchCurrentUser() {
  const user = await userApi.getCurrentUser();
  // 这里只处理业务逻辑，不关心 HTTP 细节
}
```

#### 在 `index.ts` 中统一导出

```ts
// src/api/index.ts
export * from './workflow';
export * from './user';
// 后续新增模块时，请同步在此处导出
```

### ➕ 新增 API 模块的步骤

1. 在 `src/api` 下新增文件，例如：`project.ts`。
2. 定义对应的 `xxxApi` 对象，内部方法统一返回 `Promise<类型>`，类型从 `@/types` 引入。
3. 所有接口路径使用以 `/` 开头的相对路径，例如：`/projects`、`/projects/:id`。
4. 在 `src/api/index.ts` 中补充 `export * from './project';` 以对外暴露。
5. 不在 API 中拼装 i18n 文案，由调用方根据接口结果自行决定提示内容。


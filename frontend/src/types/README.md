## 瑶光工坊类型定义规范（/src/types）

本目录统一存放前端使用的 **TypeScript 类型定义**，包括：公共 API 类型、领域模型类型（用户、项目、工作流、AI 等）。所有 `src/api`、`src/store`、页面和组件中共享的结构体，优先在此目录维护。

### 📁 目录结构

```text
src/types/
├── api.ts       # 通用 API 类型（统一响应、分页等）
├── user.ts      # 用户与认证相关类型
├── project.ts   # 项目管理相关类型
├── workflow.ts  # 工作流节点、连线、执行结果等类型
├── ai.ts        # AI 能力相关类型
└── index.ts     # 统一导出入口 & 兼容别名
```

### 🧱 设计约定

- **命名规范**：
  - 接口 / 类型使用大驼峰：`User`、`Project`、`WorkflowDefinition`、`ExecuteWorkflowResponse`。
  - 请求体后缀：`XxxRequest`（如 `LoginRequest`、`PageRequest`）。
  - 响应体后缀：`XxxResponse` 或通过领域名区分（如 `LoginResponse`、`PageResponse<T>`）。
- **领域拆分**：
  - 与某个 API 模块强关联的类型，放到对应文件：如 `userApi` 使用的类型放在 `user.ts`。
  - 多个模块通用的基础类型（分页、统一响应等）放在 `api.ts`。
- **只包含类型，不包含实现**：
  - 这里只写 `type` / `interface` / `enum`，不写函数和业务逻辑。

### 🔁 统一响应与分页类型

```ts
// src/types/api.ts
export interface ApiResponse<T = any> {
  code: number;    // 状态码：200 成功，40001 未授权，其他为失败
  message: string; // 消息提示
  data: T;         // 响应数据
}

export interface PageRequest {
  page: number;
  pageSize: number;
}

export interface PageResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

### 🔗 统一导出与兼容别名

```ts
// src/types/index.ts
export * from './api';
export * from './ai';
export * from './user';
export * from './workflow';

// 为了向后兼容，保留旧的类型名称别名
export type PaginationParams = import('./api').PageRequest;
export type PaginationResponse<T> = import('./api').PageResponse<T>;
```

推荐其他模块通过 `@/types` 引入类型，避免直接依赖子文件路径，方便未来重构：

```ts
import type { User, LoginRequest, LoginResponse } from '@/types';
```

### ➕ 新增类型文件的步骤

1. 在 `src/types` 下新增对应领域类型文件，例如：`report.ts`。
2. 将该领域的请求/响应/实体结构统一集中在此文件中维护。
3. 在 `src/types/index.ts` 中补充 `export * from './report';`。
4. 业务代码中统一通过 `@/types` 引入，避免硬编码具体文件路径。


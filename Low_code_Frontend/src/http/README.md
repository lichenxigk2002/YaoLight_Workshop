# HTTP 工具使用指南

## 简介

这是一个基于 Axios 封装的 HTTP 请求工具类，提供了统一的请求/响应处理、错误处理、Token 认证等功能。

## 特性

- ✅ TypeScript 类型支持
- ✅ 统一的请求/响应拦截
- ✅ 自动 Token 认证
- ✅ 统一错误处理和提示
- ✅ 支持文件上传/下载
- ✅ 请求日志记录
- ✅ 超时处理

## 基本使用

### 1. GET 请求

```typescript
import http from '@/http';

// 简单 GET 请求
const data = await http.get('/api/users');

// 带参数的 GET 请求
const users = await http.get('/api/users', { page: 1, pageSize: 10 });

// 带类型定义
interface User {
  id: number;
  name: string;
}

const user = await http.get<User>('/api/users/1');
```

### 2. POST 请求

```typescript
import http from '@/http';

// 简单 POST 请求
const result = await http.post('/api/users', {
  name: '张三',
  email: 'zhangsan@example.com',
});

// 带类型定义
interface CreateUserRequest {
  name: string;
  email: string;
}

interface CreateUserResponse {
  id: number;
  name: string;
}

const newUser = await http.post<CreateUserResponse>(
  '/api/users',
  {
    name: '张三',
    email: 'zhangsan@example.com',
  } as CreateUserRequest
);
```

### 3. PUT 请求

```typescript
import http from '@/http';

// 更新用户信息
const updatedUser = await http.put('/api/users/1', {
  name: '李四',
  email: 'lisi@example.com',
});
```

### 4. DELETE 请求

```typescript
import http from '@/http';

// 删除用户
await http.delete('/api/users/1');

// 带参数的删除
await http.delete('/api/users', { ids: [1, 2, 3] });
```

### 5. PATCH 请求

```typescript
import http from '@/http';

// 部分更新
const user = await http.patch('/api/users/1', {
  name: '王五',
});
```

## 高级功能

### 文件上传

```typescript
import http from '@/http';

// 创建 FormData
const formData = new FormData();
formData.append('file', file);
formData.append('name', '文件名');

// 上传文件
const result = await http.upload('/api/files/upload', formData);
```

### 文件下载

```typescript
import http from '@/http';

// 下载文件
await http.download('/api/files/download', { id: 1 }, '文件名.xlsx');

// 自动从响应头获取文件名
await http.download('/api/files/download', { id: 1 });
```

## 响应数据结构

后端统一返回格式：

```typescript
interface ApiResponse<T> {
  code: number;    // 状态码：200 成功，40001 未授权，其他为失败
  msg: string;     // 消息提示
  data: T;         // 响应数据
}
```

HTTP 工具会自动解包，直接返回 `data` 部分。

## 错误处理

### 自动错误处理

HTTP 工具会自动处理以下错误：

- **401 未授权**：清除 Token，跳转登录页
- **403 无权限**：显示权限错误提示
- **404 不存在**：显示资源不存在提示
- **500 服务器错误**：显示服务器错误提示
- **超时错误**：显示超时提示
- **网络错误**：显示网络错误提示

### 手动错误处理

```typescript
import http from '@/http';
import { message } from 'antd';

try {
  const data = await http.get('/api/users');
  // 处理成功响应
} catch (error) {
  // 自定义错误处理
  console.error('请求失败:', error);
  message.error('获取用户列表失败');
}
```

## 在 API 模块中使用

推荐在 `src/api` 目录下创建 API 模块：

```typescript
// src/api/user.ts
import http from '@/http';

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * 用户 API
 */
export const userApi = {
  // 登录
  login: (data: LoginRequest) => 
    http.post<LoginResponse>('/auth/login', data),

  // 获取用户列表
  getUsers: (params?: { page?: number; pageSize?: number }) => 
    http.get<User[]>('/users', params),

  // 获取用户详情
  getUserById: (id: number) => 
    http.get<User>(`/users/${id}`),

  // 创建用户
  createUser: (data: Omit<User, 'id'>) => 
    http.post<User>('/users', data),

  // 更新用户
  updateUser: (id: number, data: Partial<User>) => 
    http.put<User>(`/users/${id}`, data),

  // 删除用户
  deleteUser: (id: number) => 
    http.delete(`/users/${id}`),
};
```

## 组件中使用

```typescript
import { useState, useEffect } from 'react';
import { userApi } from '@/api/user';
import type { User } from '@/api/user';

function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userApi.getUsers({ page: 1, pageSize: 10 });
      setUsers(data);
    } catch (error) {
      // 错误已由 HTTP 工具自动处理
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* 渲染用户列表 */}
    </div>
  );
}
```

## 配置说明

### 环境变量配置

在 `.env` 文件中配置 API 基础 URL：

```bash
# 开发环境
VITE_BASE_URL=http://localhost:8080/api

# 生产环境
VITE_BASE_URL=https://api.example.com
```

### 自定义配置

如需修改默认配置，可以在 `src/http/index.ts` 中调整：

```typescript
this.instance = axios.create({
  baseURL: this.baseURL,
  timeout: 10000,           // 修改超时时间
  withCredentials: true,    // 修改是否携带 cookie
  headers: {
    'Content-Type': 'application/json',
  },
});
```

## 注意事项

1. **Token 存储**：Token 存储在 `localStorage` 的 `auth-storage` 键中
2. **401 处理**：遇到 401 或业务码 40001 会自动跳转到 `/login`
3. **错误提示**：所有错误都会自动通过 `message.error()` 显示
4. **类型安全**：建议为每个 API 定义请求/响应类型
5. **日志输出**：开发环境会输出请求/响应日志，方便调试

## 示例项目结构

```
src/
├── api/              # API 模块
│   ├── user.ts       # 用户相关 API
│   ├── workflow.ts   # 工作流相关 API
│   └── index.ts      # 导出所有 API
├── http/             # HTTP 工具
│   ├── index.ts      # HTTP 工具类
│   └── README.md     # 使用文档
└── types/            # 类型定义
    └── api.ts        # API 相关类型
```


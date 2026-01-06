# 瑶光工坊 (YaoLight Workshop) - 前端

基于 React + Vite + TypeScript + Ant Design 的智能工作流前端应用。

## 技术栈

- **React 18** - UI框架
- **Vite** - 构建工具
- **TypeScript** - 类型安全
- **Ant Design 5** - UI组件库
- **React Router** - 路由管理
- **Zustand** - 状态管理
- **Axios** - HTTP请求
- **React Flow** - 工作流可视化编辑器（待集成）

## 快速开始

### 1. 安装依赖
```bash
cd Low_code_Frontend
npm install
# 或
pnpm install
# 或
yarn install
```

### 2. 启动开发服务器
```bash
npm run dev
```

服务将在 `http://localhost:3000` 启动

### 3. 构建生产版本
```bash
npm run build
```

## 项目结构

```
Low_code_Frontend/
├── src/
│   ├── pages/          # 页面组件
│   │   ├── auth/       # 认证页面（登录、注册）
│   │   └── Dashboard.tsx
│   ├── layouts/        # 布局组件
│   ├── components/     # 通用组件
│   ├── services/       # API服务
│   ├── store/          # 状态管理
│   ├── utils/          # 工具函数
│   ├── types/          # TypeScript类型定义
│   ├── App.tsx         # 根组件
│   └── main.tsx        # 入口文件
├── public/             # 静态资源
├── vite.config.ts      # Vite配置
└── tsconfig.json       # TypeScript配置
```

## 开发计划

### 已完成
- ✅ 项目初始化
- ✅ 基础路由配置
- ✅ 登录/注册页面
- ✅ 基础布局

### 待开发
- [ ] 工作流编辑器（React Flow）
- [ ] 工作流管理页面
- [ ] 任务管理页面
- [ ] 管理员端页面
- [ ] API集成


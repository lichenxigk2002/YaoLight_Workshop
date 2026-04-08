# 瑶光工坊国际化配置（react-i18next）

## 📝 说明
本项目支持中英文双语切换，国际化基于 react‑i18next。所有语言资源统一放置在 `src/i18n/locales`，初始化配置在 `src/i18n/config.ts`。

## 🌍 支持的语言
- **简体中文** (zh-CN)
- **English** (en-US)

## 📁 文件结构
```
src/i18n/
├── locales/
│   ├── zh-CN.json      # 简体中文语言包
│   └── en-US.json      # 英文语言包
└── config.ts           # i18n 初始化配置
```

## 🚀 使用方法

### 在组件中使用
```tsx
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
  const { t, i18n } = useTranslation();

  return (
    <div>
      <h1>{t('common.brandName')}</h1>
      <button onClick={() => i18n.changeLanguage('en-US')}>English</button>
      <button onClick={() => i18n.changeLanguage('zh-CN')}>中文</button>
    </div>
  );
}
```

### 初始化与语言存储
- 在应用入口引入 `src/i18n/config.ts` 完成初始化：[main.tsx](file:///e:/Project/Graduation%20project/frontend/src/main.tsx)
- 默认语言从 `localStorage` 的 `i18nextLng` 读取；切换语言后会自动保存并生效：[config.ts](file:///e:/Project/Graduation%20project/frontend/src/i18n/config.ts)

## 📦 品牌信息与命名规范
为统一品牌呈现与键命名，请遵循以下约定：
- 品牌中文名：`common.brandName` → “瑶光工坊”
- 品牌英文名：`common.brandNameEn` → “YaoLight Workshop”
- 版权：`common.copyright` → 统一包含中英文品牌
- 公共动作键集中在 `common` 下：`actions`、`edit`、`delete`、`execute`、`ok`、`cancel`、`operationFailed`
- 页面分区键示例：`dashboard.*`、`workflow.*`、`workflowEditor.*`

## ➕ 添加新的翻译
在 `zh-CN.json` 与 `en-US.json` 中同时添加对应键，保持结构一致：
```json
// zh-CN.json
{
  "myModule": {
    "title": "我的标题",
    "description": "我的描述"
  }
}

// en-US.json
{
  "myModule": {
    "title": "My Title",
    "description": "My Description"
  }
}
```
支持变量插值：
```ts
t('workflowEditor.execSuccessDesc', { count: 5 })
```

## 📚 常用场景
- 消息与通知：
```ts
message.info(t('workflowEditor.executing'));
notification.success({
  message: t('workflowEditor.execSuccessTitle'),
  description: t('workflowEditor.execSuccessDesc', { count }),
});
```
- 表格列头与状态：
```ts
const columns = [
  { title: t('dashboard.projectName'), dataIndex: 'name' },
  { title: t('dashboard.createdAt'), dataIndex: 'createdAt' },
];
```
- 面包屑：
```tsx
<Breadcrumb items={[
  { title: t('dashboard.projectsList') },
  { title: t('dashboard.projectDetail') },
]} />
```
- 日期本地化（跟随当前语言）：
```ts
new Intl.DateTimeFormat(i18n.language).format(new Date(text))
```

## 🎨 当前已支持的页面
- ✅ 登录页面 (`/login`)
- ✅ 布局组件（Header）
- ✅ 项目列表与详情（Dashboard / ProjectDetail）
- ✅ 工作流编辑器（WorkflowEditor）
- 🔄 更多页面正在添加中…

## 🔁 迁移说明
旧目录 `src/locales` 为历史方案（自定义 useLocale），现已统一迁移到 `src/i18n`。请仅在 `src/i18n/locales/*.json` 维护语言文案。

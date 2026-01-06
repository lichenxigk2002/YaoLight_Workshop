# 瑶光工坊国际化配置

## 📝 说明

本项目支持中英文双语切换。

## 🌍 支持的语言

- **简体中文** (zh-CN)
- **English** (en-US)

## 📁 文件结构

```
src/locales/
├── zh-CN.ts      # 简体中文语言包
├── en-US.ts      # 英文语言包
├── index.ts      # 导出和工具函数
└── README.md     # 说明文档
```

## 🚀 使用方法

### 在组件中使用

```tsx
import { useLocale } from '@/hooks/useLocale';

export default function MyComponent() {
  const { locale, setLocale, t } = useLocale();

  return (
    <div>
      <h1>{t.common.brandName}</h1>
      <button onClick={() => setLocale('en-US')}>English</button>
      <button onClick={() => setLocale('zh-CN')}>中文</button>
    </div>
  );
}
```

## 📦 品牌信息

### 中文
- **品牌名称**: 瑶光工坊
- **英文名称**: YaoLight Workshop
- **版权信息**: © 2026 瑶光工坊 YaoLight Workshop. All rights reserved.

### English
- **Brand Name**: YaoLight Workshop
- **Copyright**: © 2026 YaoLight Workshop. All rights reserved.

## ➕ 添加新的翻译

1. 在 `zh-CN.ts` 中添加中文翻译
2. 在 `en-US.ts` 中添加对应的英文翻译
3. 保持两个文件的结构一致

例如：

```typescript
// zh-CN.ts
export default {
  myModule: {
    title: '我的标题',
    description: '我的描述',
  },
};

// en-US.ts
export default {
  myModule: {
    title: 'My Title',
    description: 'My Description',
  },
};
```

## 💾 语言存储

用户选择的语言会自动保存在 `localStorage` 中，下次访问时会自动恢复。

## 🎨 当前已支持的页面

- ✅ 登录页面 (`/login`)
- ✅ 布局组件 (Header)
- 🔄 更多页面正在添加中...


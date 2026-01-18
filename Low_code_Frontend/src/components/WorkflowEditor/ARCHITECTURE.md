# 前端配置面板架构说明

## 一、整体架构层次

```
WorkflowEditor (index.tsx)
  └── NodeConfigPanel (panels/NodeConfigPanel.tsx)
       ├── 节点类型判断
       ├── 通用配置（节点名称、连接方向等）
       └── 节点专属配置组件 (configs/)
            ├── StartNodeConfig
            ├── AINodeConfig ⭐ (特殊架构)
            ├── CrawlerNodeConfig
            ├── ConditionNodeConfig
            └── ...
```

## 二、节点配置面板流程

### 1. 入口：NodeConfigPanel.tsx

**职责：**
- 管理配置面板的显示/隐藏
- 根据节点类型渲染对应的配置组件
- 处理表单保存逻辑
- 管理测试功能（爬虫测试、AI测试）
- 渲染预览模态框

**关键代码：**
```typescript
// 根据节点类型渲染配置组件
const renderConfigComponent = () => {
  switch (nodeType) {
    case 'ai':
      return <AINodeConfig {...commonProps} />;
    case 'crawler':
      return <CrawlerNodeConfig {...commonProps} />;
    // ...
  }
};
```

### 2. 表单管理：useNodeConfigForm.ts

**职责：**
- 初始化表单数据（从节点配置中恢复）
- 监听节点变化，自动更新表单
- 处理表单保存逻辑
- 支持自动测试功能

## 三、AI节点配置的特殊架构

AI节点配置采用了**提供商注册机制**，实现了公共配置和专属配置的分离。

### 架构设计

```
AINodeConfig.tsx (主配置组件)
  ├── 公共配置区域
  │   ├── 模型选择（系统预设/用户模型/自定义）
  │   ├── Prompt 配置
  │   ├── 基础参数（temperature, maxTokens, topP）
  │   └── 流式输出开关（stream）
  │
  └── 提供商专属配置区域（动态加载）
      └── ProviderRegistry.get(provider).ConfigComponent
          ├── DeepSeekConfig (deepseek/)
          ├── DoubaoConfig (doubao/)
          └── ... (可扩展)
```

### 1. 提供商注册机制

**位置：** `providers/`

**核心文件：**
- `registry.ts` - 提供商注册表（单例模式）
- `types.ts` - 类型定义
- `index.ts` - 统一导出，自动注册所有提供商

**注册表结构：**
```typescript
class ProviderRegistry {
  private providers: Map<string, AIProviderRegistration>;
  
  register(registration: AIProviderRegistration) {
    // 注册提供商
  }
  
  get(name: string): AIProviderRegistration | undefined {
    // 获取提供商
  }
}
```

**提供商注册信息：**
```typescript
interface AIProviderRegistration {
  name: string;                    // 提供商唯一标识
  displayName: string;              // 显示名称
  ConfigComponent: React.ComponentType<ProviderConfigProps>;  // 配置组件
  PreviewComponent: React.ComponentType<ProviderPreviewProps>; // 预览组件
  supportedConfig: {               // 支持的配置项
    stream?: boolean;
    thinking?: boolean;
    thinkingLevel?: boolean;
    // ...
  };
  defaultConfig?: Record<string, any>; // 默认配置
}
```

### 2. 提供商专属文件夹结构

每个提供商都有独立的文件夹，包含专属的配置和预览组件：

```
providers/
├── deepseek/
│   ├── index.ts              # 注册 DeepSeek
│   ├── DeepSeekConfig.tsx    # DeepSeek 专属配置组件
│   ├── DeepSeekConfig.module.scss
│   └── DeepSeekPreview.tsx   # DeepSeek 专属预览组件
│
├── doubao/
│   ├── index.ts              # 注册豆包
│   ├── DoubaoConfig.tsx      # 豆包专属配置组件
│   ├── DoubaoConfig.module.scss
│   └── DoubaoPreview.tsx     # 豆包专属预览组件
│
├── registry.ts               # 注册表
├── types.ts                  # 类型定义
└── index.ts                  # 统一导出
```

### 3. 配置组件集成

**在 AINodeConfig.tsx 中：**

```typescript
// 公共配置：流式输出
{support.stream && (
  <Form.Item name="stream" ...>
    <Switch />
  </Form.Item>
)}

// 提供商专属配置：通过注册机制动态加载
{activeProvider && (() => {
  const provider = providerRegistry.get(activeProvider);
  if (provider && provider.ConfigComponent) {
    const ConfigComponent = provider.ConfigComponent;
    return (
      <ConfigComponent
        form={form}
        node={node}
        nodes={nodes}
        edges={edges}
      />
    );
  }
  return null;
})()}
```

### 4. 预览组件集成

**在 NodeConfigPanel.tsx 中：**

```typescript
{/* AI节点预览模态框 - 使用提供商专属预览组件 */}
{isAINode && (() => {
  const provider = node?.data?.config?.provider;
  if (provider) {
    const providerReg = providerRegistry.get(provider);
    if (providerReg && providerReg.PreviewComponent) {
      const PreviewComponent = providerReg.PreviewComponent;
      return <PreviewComponent {...props} />;
    }
  }
  // 如果没有注册的提供商，使用通用预览组件
  return <AIPreviewModal {...props} />;
})()}
```

### 5. 配置支持管理

**modelConfigSupport.ts：**

```typescript
// 优先从注册表获取配置支持
export function getModelConfigSupport(provider: string | null): ModelConfigSupport {
  const providerReg = providerRegistry.get(provider);
  if (providerReg && providerReg.supportedConfig) {
    return {
      ...baseConfig,
      ...providerReg.supportedConfig,
    };
  }
  // 如果没有注册，使用默认配置（向后兼容）
  // ...
}
```

## 四、配置分类

### 1. 公共配置（所有AI节点都支持）

- **模型选择：** 系统预设 / 用户模型 / 自定义配置
- **Prompt 配置：** prompt、contentVariable
- **基础参数：** temperature、maxTokens、topP
- **流式输出：** stream（如果提供商支持）

### 2. 提供商专属配置

通过 `ProviderConfigComponent` 动态渲染：

- **DeepSeek：** thinking（深度思考开关）
- **豆包：** thinkingLevel（思考长度：minimal/low/medium/high）
- **OpenAI（未来）：** frequencyPenalty、presencePenalty、stopSequences

## 五、如何扩展新的AI提供商

### 步骤 1：创建提供商文件夹

在 `providers/` 下创建新文件夹，例如 `openai/`：

```
providers/openai/
├── index.ts
├── OpenAIConfig.tsx
├── OpenAIConfig.module.scss
└── OpenAIPreview.tsx
```

### 步骤 2：实现配置组件

```typescript
// OpenAIConfig.tsx
import React from 'react';
import { Form, InputNumber } from 'antd';
import { ProviderConfigProps } from '../types';
import styles from './OpenAIConfig.module.scss';

export const OpenAIConfig: React.FC<ProviderConfigProps> = ({ form }) => {
  return (
    <>
      <Form.Item
        label="频率惩罚"
        name="frequencyPenalty"
        initialValue={0}
        className={styles.formItem}
      >
        <InputNumber min={-2} max={2} step={0.1} />
      </Form.Item>
      <Form.Item
        label="存在惩罚"
        name="presencePenalty"
        initialValue={0}
        className={styles.formItem}
      >
        <InputNumber min={-2} max={2} step={0.1} />
      </Form.Item>
    </>
  );
};
```

### 步骤 3：实现预览组件（可选）

```typescript
// OpenAIPreview.tsx
import React from 'react';
import { ProviderPreviewProps } from '../types';
import { AIPreviewModal } from '../../panels/components/AIPreviewModal';

export const OpenAIPreview: React.FC<ProviderPreviewProps> = (props) => {
  // 可以使用通用预览组件，或自定义
  return <AIPreviewModal {...props} />;
};
```

### 步骤 4：注册提供商

```typescript
// providers/openai/index.ts
import { providerRegistry } from '../registry';
import { OpenAIConfig } from './OpenAIConfig';
import { OpenAIPreview } from './OpenAIPreview';

providerRegistry.register({
  name: 'openai',
  displayName: 'OpenAI',
  ConfigComponent: OpenAIConfig,
  PreviewComponent: OpenAIPreview,
  supportedConfig: {
    stream: true,
    frequencyPenalty: true,
    presencePenalty: true,
    stopSequences: true,
  },
  defaultConfig: {
    stream: false,
    frequencyPenalty: 0,
    presencePenalty: 0,
  },
});
```

### 步骤 5：在 index.ts 中导入

```typescript
// providers/index.ts
import './openai';  // 添加这一行
```

**完成！** 新提供商会自动集成到配置面板中。

## 六、优势

### 1. **高内聚**
每个提供商的所有代码和配置都在一个文件夹内

### 2. **低耦合**
不同提供商之间完全独立，互不影响

### 3. **易扩展**
新增提供商只需添加新文件夹，无需修改现有代码

### 4. **配置清晰**
公共配置和专属配置分离，职责明确

### 5. **易于维护**
修改某个提供商的代码不会影响其他提供商

### 6. **类型安全**
使用 TypeScript 类型定义，确保类型安全

## 七、数据流

```
用户选择提供商
  ↓
AINodeConfig 检测 provider 变化
  ↓
从 ProviderRegistry 获取提供商信息
  ↓
动态渲染 ProviderConfigComponent
  ↓
用户配置专属参数
  ↓
保存到 node.data.config
  ↓
测试时，使用专属 PreviewComponent 显示结果
```

## 八、关键设计模式

1. **注册表模式（Registry Pattern）** - 管理提供商注册
2. **策略模式（Strategy Pattern）** - 不同提供商使用不同的配置策略
3. **组件组合（Component Composition）** - 公共配置 + 专属配置组合
4. **单例模式（Singleton Pattern）** - ProviderRegistry 单例

## 九、注意事项

1. **自动注册：** 在 `providers/index.ts` 中导入提供商文件夹会自动触发注册
2. **向后兼容：** 如果提供商未注册，会使用默认配置支持
3. **类型安全：** 所有组件都使用 TypeScript 类型定义
4. **样式隔离：** 每个提供商的样式文件独立，避免冲突


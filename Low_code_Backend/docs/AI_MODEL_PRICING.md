# AI模型计费标准文档

本文档记录所有AI模型的计费标准，用于实现精确的token消耗计算。

## 计费方式说明

### 通用计费模式

大多数AI模型采用以下计费方式之一：

1. **统一计费**：按总token数计费（input + output）
   - 公式：`总费用 = 总token数 × 单价`

2. **分离计费**：按输入/输出token分别计费（推荐）
   - 公式：`总费用 = (输入token数 × 输入单价) + (输出token数 × 输出单价)`
   - 优势：更精确，因为通常输出token价格高于输入token

3. **多类型计费**：包含音频、缓存等额外类型（如Gemini）
   - 公式：`总费用 = (输入token × 输入价) + (输出token × 输出价) + (音频token × 音频价) + ...`

4. **分段计费**：根据上下文长度或使用量分段定价（如Grok）
   - 例如：≤128K上下文使用一种价格，>128K使用另一种价格
   - 公式：根据实际使用量判断分段，然后按对应价格计算

5. **按张计费**：图片生成模型专用（如Doubao-Seedream）
   - 公式：`总费用 = 生成的图片数量 × 单价`
   - 注意：与token数量无关

### 价格单位

- **文本/Token计费**：所有价格均以 **每百万token（per 1M tokens）** 为单位
- **图片计费**：以 **每张图片（per image）** 为单位
- 货币单位：**USD（美元）** 或 **CNY（人民币）**，取决于服务商
- 例如：`$0.50/M` 表示每100万个token收费0.5美元，`¥0.25/张` 表示每张图片收费0.25元

- 所有价格均以 **每百万token（per 1M tokens）** 为单位
- 货币单位：**USD（美元）**
- 例如：`$0.50/M` 表示每100万个token收费0.5美元

---

## 模型计费标准列表

### Google Gemini 系列

#### Google: Gemini 3 Flash Preview

**Provider**: Google Vertex / Google AI Studio

**计费方式**: 分离计费 + 多类型

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) | $0.50 |
| 输出 (Output) | $3.00 |
| 音频 (Audio) | $1.00 |
| 缓存读取 (Cache Read) | $0.05 |
| 缓存写入 (Cache Write) | 不适用 |
| 音频缓存读取 (Audio Cache Read) | $0.10 |

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × $0.50) 
      + (CompletionTokens / 1,000,000 × $3.00)
      + (AudioTokens / 1,000,000 × $1.00)  [如果适用]
      + (CacheReadTokens / 1,000,000 × $0.05)  [如果适用]
      + (AudioCacheReadTokens / 1,000,000 × $0.10)  [如果适用]
```

**上下文限制**:
- 总上下文: 1,048,576 tokens
- 最大输出: 65,536 tokens

**备注**: 
- 输出token价格是输入token的6倍
- 支持缓存机制以降低成本

---

### DeepSeek 系列

#### DeepSeek Chat (deepseek-chat)

**Provider**: DeepSeek

**Base URL**: `https://api.deepseek.com`

**模型版本**: DeepSeek-V3.2 (Non-thinking Mode)

**计费方式**: 分离计费 + 缓存机制

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) - 缓存命中 (Cache Hit) | $0.028 |
| 输入 (Input) - 缓存未命中 (Cache Miss) | $0.28 |
| 输出 (Output) | $0.42 |

**计费公式**:
```
总费用 = (CacheHitInputTokens / 1,000,000 × $0.028) 
      + (CacheMissInputTokens / 1,000,000 × $0.28)
      + (CompletionTokens / 1,000,000 × $0.42)
```

**上下文限制**:
- 总上下文: 128,000 tokens
- 最大输出: 默认 4,000 tokens，最大 8,000 tokens

**功能支持**:
- ✓ Json Output
- ✓ Tool Calls
- ✓ Chat Prefix Completion (Beta)
- ✓ FIM Completion (Beta)

**备注**:
- 输入token价格取决于缓存状态（命中 vs 未命中）
- 缓存命中价格是未命中价格的 1/10，使用缓存可大幅降低成本
- 输出token价格是缓存未命中输入token价格的 1.5倍

---

#### DeepSeek Reasoner (deepseek-reasoner)

**Provider**: DeepSeek

**Base URL**: `https://api.deepseek.com`

**模型版本**: DeepSeek-V3.2 (Thinking Mode)

**计费方式**: 分离计费 + 缓存机制

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) - 缓存命中 (Cache Hit) | $0.028 |
| 输入 (Input) - 缓存未命中 (Cache Miss) | $0.28 |
| 输出 (Output) | $0.42 |

**计费公式**:
```
总费用 = (CacheHitInputTokens / 1,000,000 × $0.028) 
      + (CacheMissInputTokens / 1,000,000 × $0.28)
      + (CompletionTokens / 1,000,000 × $0.42)
```

**上下文限制**:
- 总上下文: 128,000 tokens
- 最大输出: 默认 32,000 tokens，最大 64,000 tokens

**功能支持**:
- ✓ Json Output
- ✓ Tool Calls
- ✓ Chat Prefix Completion (Beta)
- ✗ FIM Completion（不支持）

**备注**:
- 与 deepseek-chat 使用相同的计费标准
- 思考模式支持更大的输出长度（最大64K vs 8K）
- 不支持 FIM Completion 功能

---

### 豆包 (Doubao) 系列

#### Doubao-Seed-1.6 (251015)

**Provider**: Doubao (豆包)

**模型ID**: `doubao-seed-1-6-251015`

**模型描述**: 能力多面手，应用场景丰富

**计费方式**: 分离计费

| Token类型 | 价格 (CNY/1M tokens) | 价格 (USD/1M tokens)* |
|----------|---------------------|---------------------|
| 输入 (Input) | ¥0.8 | ~$0.11 |
| 输出 (Output) | ¥2.0 | ~$0.28 |

*注：USD价格基于当前汇率估算（1 CNY ≈ 0.14 USD），实际汇率会变动

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × ¥0.8) 
      + (CompletionTokens / 1,000,000 × ¥2.0)
```

**上下文限制**:
- 上下文窗口: 256,000 tokens
- 最大输入Token长度: 224,000 tokens
- 最大输出Token长度: 64,000 tokens
- 最大思考内容Token长度: 32,000 tokens

**速率限制**:
- TPM (Tokens Per Minute): 5,000,000 tokens/min
- RPM (Requests Per Minute): 30,000 requests/min

**备注**: 
- 使用人民币(CNY)计费
- 输出token价格是输入token的 2.5倍
- 支持思考内容（最大32K tokens）
- 支持多模态理解

---

#### Doubao-Seed-1.8 (251228)

**Provider**: Doubao (豆包)

**模型ID**: `doubao-seed-1-8-251228`

**模型描述**: 更强agent能力，升级多模态理解，灵活的上下文管理

**计费方式**: 分离计费

| Token类型 | 价格 (CNY/1M tokens) | 价格 (USD/1M tokens)* |
|----------|---------------------|---------------------|
| 输入 (Input) | ¥0.8 | ~$0.11 |
| 输出 (Output) | ¥2.0 | ~$0.28 |

*注：USD价格基于当前汇率估算（1 CNY ≈ 0.14 USD），实际汇率会变动

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × ¥0.8) 
      + (CompletionTokens / 1,000,000 × ¥2.0)
```

**上下文限制**:
- 上下文窗口: 256,000 tokens
- 最大输入Token长度: 224,000 tokens
- 最大输出Token长度: 64,000 tokens
- 最大思考内容Token长度: 32,000 tokens

**速率限制**:
- TPM (Tokens Per Minute): 5,000,000 tokens/min
- RPM (Requests Per Minute): 30,000 requests/min

**备注**: 
- 使用人民币(CNY)计费
- 输出token价格是输入token的 2.5倍
- 支持思考内容（最大32K tokens）
- 支持多模态理解

---

### 腾讯混元 (Hunyuan) 系列

（待补充）

---

### OpenAI GPT 系列

#### 计费规则说明

- **计费方式**：分离计费（输入/输出分别定价），部分模型支持缓存读取，部分模型免费
- **货币单位**：USD（美元）
- **Base URL**: `https://openrouter.ai/api/v1`（通过OpenRouter访问）

#### GPT-4o

**Provider**: GPT (OpenAI via OpenRouter)

**模型名称**: `openai/gpt-4o`

**计费方式**: 分离计费 + 缓存读取

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) | $2.50 |
| 输出 (Output) | $10.00 |
| 缓存读取 (Cache Read) | $1.25 |

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × $2.50) 
      + (CompletionTokens / 1,000,000 × $10.00)
      + (CacheReadTokens / 1,000,000 × $1.25) [如果有缓存读取]
```

**上下文限制**:
- 总上下文: 128,000 tokens
- 最大输出: 16,400 tokens

**备注**:
- 支持文本和图像输入
- 输出token价格是输入token价格的 4倍
- 缓存读取价格为输入价格的 50%

---

#### GPT-4o-mini

**Provider**: GPT (OpenAI via OpenRouter)

**模型名称**: `openai/gpt-4o-mini`

**计费方式**: 分离计费 + 缓存读取

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) | $0.15 |
| 输出 (Output) | $0.60 |
| 缓存读取 (Cache Read) | $0.075 |

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × $0.15) 
      + (CompletionTokens / 1,000,000 × $0.60)
      + (CacheReadTokens / 1,000,000 × $0.075) [如果有缓存读取]
```

**上下文限制**:
- 总上下文: 128,000 tokens
- 最大输出: 16,400 tokens

**备注**:
- 支持文本和图像输入
- 输出token价格是输入token价格的 4倍
- 缓存读取价格为输入价格的 50%
- 比GPT-4o便宜很多（输入约17倍，输出约17倍）

---

#### GPT-5.1

**Provider**: GPT (OpenAI via OpenRouter)

**模型名称**: `openai/gpt-5.1`

**计费方式**: 分离计费 + 缓存读取

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) | $1.25 |
| 输出 (Output) | $10.00 |
| 缓存读取 (Cache Read) | $0.125 |

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × $1.25) 
      + (CompletionTokens / 1,000,000 × $10.00)
      + (CacheReadTokens / 1,000,000 × $0.125) [如果有缓存读取]
```

**上下文限制**:
- 总上下文: 400,000 tokens
- 最大输出: 128,000 tokens

**备注**:
- 支持自适应推理
- 输出token价格是输入token价格的 8倍
- 缓存读取价格为输入价格的 10%

---

#### GPT-5.2

**Provider**: GPT (OpenAI via OpenRouter)

**模型名称**: `openai/gpt-5.2`

**计费方式**: 分离计费 + 缓存读取

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) | $1.75 |
| 输出 (Output) | $14.00 |
| 缓存读取 (Cache Read) | $0.175 |

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × $1.75) 
      + (CompletionTokens / 1,000,000 × $14.00)
      + (CacheReadTokens / 1,000,000 × $0.175) [如果有缓存读取]
```

**上下文限制**:
- 总上下文: 400,000 tokens
- 最大输出: 128,000 tokens

**备注**:
- GPT-5系列最新前沿模型
- 输出token价格是输入token价格的 8倍
- 缓存读取价格为输入价格的 10%

---

#### GPT-5.2 Pro

**Provider**: GPT (OpenAI via OpenRouter)

**模型名称**: `openai/gpt-5.2-pro`

**计费方式**: 分离计费

| Token类型 | 价格 (USD/1M tokens) |
|----------|---------------------|
| 输入 (Input) | $21.00 |
| 输出 (Output) | $168.00 |

**计费公式**:
```
总费用 = (PromptTokens / 1,000,000 × $21.00) 
      + (CompletionTokens / 1,000,000 × $168.00)
```

**上下文限制**:
- 总上下文: 400,000 tokens
- 最大输出: 128,000 tokens

**备注**:
- OpenAI最先进的模型
- 输出token价格是输入token价格的 8倍
- 价格较高，适用于复杂任务

---

#### gpt-oss-20b (免费)

**Provider**: GPT (OpenAI via OpenRouter)

**Base URL**: `https://openrouter.ai/api/v1`

**模型名称**: `openai/gpt-oss-20b`

**计费方式**：免费

**价格表**：

| 输入单价 | 输出单价 |
|---------|---------|
| 免费 | 免费 |

**备注**：
- **完全免费**：无需支付任何费用
- 通过OpenRouter访问
- 20B参数规模

---

#### gpt-oss-120b (免费)

**Provider**: GPT (OpenAI via OpenRouter)

**Base URL**: `https://openrouter.ai/api/v1`

**模型名称**: `openai/gpt-oss-120b`

**计费方式**：免费

**价格表**：

| 输入单价 | 输出单价 |
|---------|---------|
| 免费 | 免费 |

**备注**：
- **完全免费**：无需支付任何费用
- 通过OpenRouter访问
- 120B参数规模（比gpt-oss-20b更大）

---

### 通义千问 (Qwen) 系列

#### 计费规则说明

- **计费方式**：分离计费（按输入Token和输出Token分别计费）
- **货币单位**：人民币（CNY）
- **影响计费的因素**：
  - **Batch调用**：若模型支持Batch调用，其输入和输出Token单价均按实时推理价格的50%计费
  - **上下文缓存**：若模型支持上下文缓存，仅输入Token享有折扣
  - **注意**：Batch调用和上下文缓存不能同时生效

#### qwen3-max 系列（分段计费）

**Provider**: Qwen (通义千问)

**Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`

**模型列表**：
- `qwen3-max` - 支持Batch调用半价、上下文缓存享有折扣，仅非思考模式
- `qwen3-max-2025-09-23` - 仅非思考模式
- `qwen3-max-preview` - 支持上下文缓存享有折扣，非思考和思考模式

**计费方式**：分段计费（基于输入Token数量）

**价格表（每千Token，CNY）**：

| 模型 | 输入Token范围 | 输入单价 | 输出单价 | 备注 |
|------|-------------|---------|---------|------|
| qwen3-max | 0 < Token ≤ 32K | 0.0032元 | 0.0128元 | Batch调用：输入输出各50%<br>上下文缓存：仅输入折扣 |
| qwen3-max | 32K < Token ≤ 128K | 0.0064元 | 0.0256元 | 同上 |
| qwen3-max | 128K < Token ≤ 252K | 0.0096元 | 0.0384元 | 同上 |
| qwen3-max-2025-09-23 | 0 < Token ≤ 32K | 0.006元 | 0.024元 | - |
| qwen3-max-2025-09-23 | 32K < Token ≤ 128K | 0.01元 | 0.04元 | - |
| qwen3-max-2025-09-23 | 128K < Token ≤ 252K | 0.015元 | 0.06元 | - |
| qwen3-max-preview | 0 < Token ≤ 32K | 0.006元 | 0.024元 | 上下文缓存：仅输入折扣 |
| qwen3-max-preview | 32K < Token ≤ 128K | 0.01元 | 0.04元 | 同上 |
| qwen3-max-preview | 128K < Token ≤ 252K | 0.015元 | 0.06元 | 同上 |

**计费公式**：
```
// 根据输入Token数量确定价格段
contextLength = PromptTokens

if contextLength <= 32000 {
    inputPricePer1K = 0.0032  // qwen3-max
    // 或 0.006  // qwen3-max-2025-09-23 或 qwen3-max-preview
    outputPricePer1K = 0.0128  // qwen3-max
    // 或 0.024  // qwen3-max-2025-09-23 或 qwen3-max-preview
} else if contextLength <= 128000 {
    inputPricePer1K = 0.0064  // qwen3-max
    // 或 0.01  // qwen3-max-2025-09-23 或 qwen3-max-preview
    outputPricePer1K = 0.0256  // qwen3-max
    // 或 0.04  // qwen3-max-2025-09-23 或 qwen3-max-preview
} else if contextLength <= 252000 {
    inputPricePer1K = 0.0096  // qwen3-max
    // 或 0.015  // qwen3-max-2025-09-23 或 qwen3-max-preview
    outputPricePer1K = 0.0384  // qwen3-max
    // 或 0.06  // qwen3-max-2025-09-23 或 qwen3-max-preview
}

// Batch调用折扣（仅qwen3-max支持）
if isBatchMode {
    inputPricePer1K = inputPricePer1K * 0.5
    outputPricePer1K = outputPricePer1K * 0.5
}

// 上下文缓存折扣（仅输入Token）
if hasContextCache {
    inputPricePer1K = inputPricePer1K * cacheDiscountRate  // 折扣率需确认
}

总费用 = (PromptTokens / 1,000 × inputPricePer1K) 
      + (CompletionTokens / 1,000 × outputPricePer1K)
```

**上下文限制**：
- 最大输入Token：252,000 tokens

**免费额度**（仅qwen3-max）：
- 输入Token：100万Token
- 输出Token：100万Token
- 有效期：阿里云百炼开通后90天内

**备注**：
- qwen3-max系列使用分段定价策略，价格随输入Token数量递增
- qwen3-max支持Batch调用和上下文缓存（不能同时生效）
- qwen3-max-preview支持上下文缓存和思考模式
- qwen3-max-2025-09-23为标准定价，无特殊优惠

---

#### qwen-max 系列（统一价格）

**Provider**: Qwen (通义千问)

**Base URL**: `https://dashscope.aliyuncs.com/compatible-mode/v1`

**模型列表**：
- `qwen-max` - 支持Batch调用半价，仅非思考模式
- `qwen-max-latest` - 支持Batch调用半价，仅非思考模式
- `qwen-max-2025-01-25` - 仅非思考模式
- `qwen-max-2024-09-19` - 仅非思考模式
- `qwen-max-2024-04-28` - 仅非思考模式
- `qwen-max-2024-04-03` - 仅非思考模式

**计费方式**：分离计费（统一价格，无阶梯计价）

**价格表（每千Token，CNY）**：

| 模型 | 输入单价 | 输出单价 | 备注 |
|------|---------|---------|------|
| qwen-max | 0.0024元 | 0.0096元 | Batch调用：输入输出各50% |
| qwen-max-latest | 0.0024元 | 0.0096元 | Batch调用：输入输出各50% |
| qwen-max-2025-01-25 | 0.0024元 | 0.0096元 | - |
| qwen-max-2024-09-19 | 0.02元 | 0.06元 | - |
| qwen-max-2024-04-28 | 0.04元 | 0.12元 | - |
| qwen-max-2024-04-03 | 0.04元 | 0.12元 | - |

**计费公式**：
```
// 根据模型版本确定基础价格
if model == "qwen-max" || model == "qwen-max-latest" || model == "qwen-max-2025-01-25" {
    inputPricePer1K = 0.0024
    outputPricePer1K = 0.0096
} else if model == "qwen-max-2024-09-19" {
    inputPricePer1K = 0.02
    outputPricePer1K = 0.06
} else if model == "qwen-max-2024-04-28" || model == "qwen-max-2024-04-03" {
    inputPricePer1K = 0.04
    outputPricePer1K = 0.12
}

// Batch调用折扣（仅qwen-max和qwen-max-latest支持）
if (model == "qwen-max" || model == "qwen-max-latest") && isBatchMode {
    inputPricePer1K = inputPricePer1K * 0.5
    outputPricePer1K = outputPricePer1K * 0.5
}

总费用 = (PromptTokens / 1,000 × inputPricePer1K) 
      + (CompletionTokens / 1,000 × outputPricePer1K)
```

**免费额度**（仅qwen-max）：
- 输入Token：100万Token
- 输出Token：100万Token
- 有效期：阿里云百炼开通后90天内

**备注**：
- qwen-max系列使用统一价格，不受输入Token数量影响
- 新版本（qwen-max, qwen-max-latest, qwen-max-2025-01-25）价格更低
- 旧版本（qwen-max-2024-xx-xx）价格较高
- qwen-max和qwen-max-latest支持Batch调用，可享受50%折扣
- 输出Token价格是输入Token价格的4倍

---

**部署模式说明**：

- **中国内地全球国际金融云**：在中国内地部署模式下，接入点与数据存储均位于北京地域，模型推理计算资源仅限于中国内地。

---

### 智谱AI (GLM) 系列

#### 计费规则说明

- **计费方式**：分离计费 + 分段计费（基于输入Token和输出Token长度）
- **货币单位**：人民币（CNY）
- **长度单位**：输入/输出长度以**万Token**为单位（如 [0, 32) 表示 0-32万Token）
- **限时免费**：部分模型提供限时免费优惠价格，有效期30-50天

#### GLM-4.7（新品）

**Provider**: ZhipuAI (智谱AI)

**Base URL**: `https://open.bigmodel.cn/api/paas/v4`

**模型名称**: `glm-4.7`

**计费方式**：分段计费（基于输入和输出Token长度）

**价格表（每百万Token，CNY）**：

| 输入长度（万Token） | 输出长度（万Token） | 输入单价 | 输出单价 | 限时免费输入单价 | 限时免费输出单价 | 免费期（天） |
|-------------------|-------------------|---------|---------|----------------|----------------|------------|
| [0, 32) | [0, 0.2) | 2元 | 8元 | 0.4元 | 3元 | 30-50 |
| [0, 32) | [0.2+) | 3元 | 14元 | 0.6元 | 5元 | 30-50 |
| [32, 200) | - | 4元 | 16元 | 0.8元 | 6元 | 30-50 |

**计费公式**：
```
// 输入和输出长度以万Token为单位计算
inputLengthIn10K = PromptTokens / 10,000
outputLengthIn10K = CompletionTokens / 10,000

// 根据输入长度确定基础价格段
if inputLengthIn10K < 32 {
    // 输入长度在 [0, 32) 范围内
    if outputLengthIn10K < 0.2 {
        // 输出长度在 [0, 0.2) 范围内
        inputPricePer1M = 2.0  // 元/百万Token
        outputPricePer1M = 8.0
        // 限时免费价格
        freeInputPricePer1M = 0.4
        freeOutputPricePer1M = 3.0
    } else {
        // 输出长度在 [0.2+) 范围内
        inputPricePer1M = 3.0
        outputPricePer1M = 14.0
        // 限时免费价格
        freeInputPricePer1M = 0.6
        freeOutputPricePer1M = 5.0
    }
} else if inputLengthIn10K < 200 {
    // 输入长度在 [32, 200) 范围内
    inputPricePer1M = 4.0
    outputPricePer1M = 16.0
    // 限时免费价格
    freeInputPricePer1M = 0.8
    freeOutputPricePer1M = 6.0
}

// 检查是否在限时免费期内（需要根据账户状态判断）
if isWithinFreePeriod {
    inputPricePer1M = freeInputPricePer1M
    outputPricePer1M = freeOutputPricePer1M
}

总费用 = (PromptTokens / 1,000,000 × inputPricePer1M) 
      + (CompletionTokens / 1,000,000 × outputPricePer1M)
```

**上下文限制**：
- 最大输入长度：200万Token
- 输出长度分段：0-0.2万Token 和 0.2万Token以上

**备注**：
- 限时免费期：30-50天（从账户开通或模型发布起计算）
- 价格同时受输入长度和输出长度影响（仅在输入长度 < 32万Token时）
- 输出Token价格远高于输入Token价格（约4-5.6倍）

---

#### GLM-4.6

**Provider**: ZhipuAI (智谱AI)

**Base URL**: `https://open.bigmodel.cn/api/paas/v4`

**模型名称**: `glm-4.6`

**计费方式**：分段计费（与GLM-4.7相同）

**价格表（每百万Token，CNY）**：

| 输入长度（万Token） | 输出长度（万Token） | 输入单价 | 输出单价 | 限时免费输入单价 | 限时免费输出单价 | 免费期（天） |
|-------------------|-------------------|---------|---------|----------------|----------------|------------|
| [0, 32) | [0, 0.2) | 2元 | 8元 | 0.4元 | 3元 | 30-50 |
| [0, 32) | [0.2+) | 3元 | 14元 | 0.6元 | 5元 | 30-50 |
| [32, 200) | - | 4元 | 16元 | 0.8元 | 6元 | 30-50 |

**计费公式**：与GLM-4.7相同

**备注**：与GLM-4.7使用相同的计费标准

---

#### GLM-4.5-Air

**Provider**: ZhipuAI (智谱AI)

**Base URL**: `https://open.bigmodel.cn/api/paas/v4`

**模型名称**: `glm-4.5-air`

**计费方式**：分段计费（基于输入和输出Token长度）

**价格表（每百万Token，CNY）**：

| 输入长度（万Token） | 输出长度（万Token） | 输入单价 | 输出单价 | 限时免费输入单价 | 限时免费输出单价 | 免费期（天） |
|-------------------|-------------------|---------|---------|----------------|----------------|------------|
| [0, 32) | [0, 0.2) | 0.8元 | 2元 | 0.16元 | 0.4元 | 30-50 |
| [0, 32) | [0.2+) | 0.8元 | 6元 | 0.16元 | 1.2元 | 30-50 |
| [32, 128) | - | 1.2元 | 8元 | 0.24元 | 1.6元 | 30-50 |

**计费公式**：
```
// 输入和输出长度以万Token为单位计算
inputLengthIn10K = PromptTokens / 10,000
outputLengthIn10K = CompletionTokens / 10,000

// 根据输入长度确定基础价格段
if inputLengthIn10K < 32 {
    if outputLengthIn10K < 0.2 {
        inputPricePer1M = 0.8
        outputPricePer1M = 2.0
        freeInputPricePer1M = 0.16
        freeOutputPricePer1M = 0.4
    } else {
        inputPricePer1M = 0.8
        outputPricePer1M = 6.0
        freeInputPricePer1M = 0.16
        freeOutputPricePer1M = 1.2
    }
} else if inputLengthIn10K < 128 {
    inputPricePer1M = 1.2
    outputPricePer1M = 8.0
    freeInputPricePer1M = 0.24
    freeOutputPricePer1M = 1.6
}

// 检查是否在限时免费期内
if isWithinFreePeriod {
    inputPricePer1M = freeInputPricePer1M
    outputPricePer1M = freeOutputPricePer1M
}

总费用 = (PromptTokens / 1,000,000 × inputPricePer1M) 
      + (CompletionTokens / 1,000,000 × outputPricePer1M)
```

**上下文限制**：
- 最大输入长度：128万Token（小于GLM-4.7的200万Token）

**备注**：
- 限时免费期：30-50天
- 价格较GLM-4.7/4.6更便宜（约1/3-1/4价格）
- 输入长度在[0, 32)范围内时，输入价格固定为0.8元，不受输出长度影响

---

#### GLM-4.7-FlashX

**Provider**: ZhipuAI (智谱AI)

**Base URL**: `https://open.bigmodel.cn/api/paas/v4`

**模型名称**: `glm-4.7-flashx`

**计费方式**：分离计费（统一价格，无分段）

**价格表（每百万Token，CNY）**：

| 上下文 | 输入单价 | 输出单价 | 限时免费输入单价 | 限时免费输出单价 | 免费期（天） |
|-------|---------|---------|----------------|----------------|------------|
| 200K | 0.5元 | 3元 | 0.1元 | 1元 | 30-40 |

**计费公式**：
```
inputPricePer1M = 0.5  // 元/百万Token
outputPricePer1M = 3.0

// 检查是否在限时免费期内
if isWithinFreePeriod {
    inputPricePer1M = 0.1
    outputPricePer1M = 1.0
}

总费用 = (PromptTokens / 1,000,000 × inputPricePer1M) 
      + (CompletionTokens / 1,000,000 × outputPricePer1M)
```

**上下文限制**：
- 上下文窗口：200,000 tokens

**备注**：
- 限时免费期：30-40天
- 使用统一价格，不受输入/输出长度影响
- 价格较GLM-4.7/4.6更便宜（约1/4-1/8价格）

---

#### GLM-4.7-Flash

**Provider**: ZhipuAI (智谱AI)

**Base URL**: `https://open.bigmodel.cn/api/paas/v4`

**模型名称**: `glm-4.7-flash`

**计费方式**：免费

**价格表**：

| 上下文 | 输入单价 | 输出单价 |
|-------|---------|---------|
| 200K | 免费 | 免费 |

**上下文限制**：
- 上下文窗口：200,000 tokens
- 速率限制：约20 tps（tokens per second）

**备注**：
- **完全免费**：无需支付任何费用
- 适合轻量级应用和测试场景
- 性能相对较低（20 tps）

---

**通用备注**：
- 所有GLM模型的长度计算单位是**万Token**（不是Token）
- 限时免费期从账户开通或模型发布时开始计算
- 需要在计费逻辑中检查账户是否在免费期内
- 限时免费价格通常是标准价格的1/5左右

---

### 讯飞星火 (Spark) 系列

#### Spark X1.5

**Provider**: Spark (讯飞星火)

**Base URL**: `https://spark-api-open.xf-yun.com/v2`

**模型名称**: `spark-x1.5`

**模型描述**: 支持快慢思考自主决策，语言理解、任务规划能力显著提升

**计费方式**：统一计费（按总Token数计费）

**价格表（每百万Token，CNY）**：

| 价格范围 | 说明 |
|---------|------|
| 2 ~ 3 元 | 百万Tokens最高3元 |

**计费公式**：
```
// 使用统一价格，价格范围在2-3元/百万Token之间
// 具体价格可能需要根据实际使用情况确定，此处取中位数
pricePer1M = 2.5  // 元/百万Token（可根据实际情况调整）

总费用 = TotalTokens / 1,000,000 × pricePer1M
```

**备注**：
- 价格范围为 2 ~ 3 元/百万tokens，具体价格可能需要根据实际使用情况确定
- 使用统一计费方式，不区分输入和输出Token
- 支持快慢思考自主决策功能
- 语言理解和任务规划能力显著提升

---

### Grok 系列

#### Grok 4.1 Fast

**Provider**: xAI

**模型ID**: `x-ai/grok-4.1-fast`

**模型描述**: xAI的最佳agent工具调用模型，在客户支持和深度研究等实际用例中表现出色。支持2M上下文窗口。可以通过API中的`reasoning`参数启用/禁用推理能力。

**计费方式**: 分段计费（基于上下文长度）+ 分离计费 + 缓存机制

**特点**: 根据输入的上下文长度分段定价（≤128K vs >128K）

| Token类型 | 上下文长度 | 价格 (USD/1M tokens) |
|----------|----------|---------------------|
| 输入 (Input) | ≤128K | $0.20 |
| 输入 (Input) | >128K | $0.40 |
| 输出 (Output) | ≤128K | $0.50 |
| 输出 (Output) | >128K | $1.00 |
| 缓存读取 (Cache Read) | ≤128K | $0.05 |
| 缓存读取 (Cache Read) | >128K | $0.05 |

**计费公式**:
```
// 判断上下文长度
contextLength = PromptTokens

if contextLength <= 128000 {
    inputPrice = $0.20
    outputPrice = $0.50
    cacheReadPrice = $0.05
} else {
    inputPrice = $0.40
    outputPrice = $1.00
    cacheReadPrice = $0.05
}

总费用 = (PromptTokens / 1,000,000 × inputPrice)
      + (CompletionTokens / 1,000,000 × outputPrice)
      + (CacheReadTokens / 1,000,000 × cacheReadPrice) [如果适用]
```

**上下文限制**:
- 总上下文: 2,000,000 tokens
- 最大输出: 30,000 tokens

**性能指标**:
- Latency: 0.80s
- Throughput: 67 tps (tokens per second)
- Uptime: 高可用性

**功能支持**:
- ✓ Agent工具调用
- ✓ 推理能力（可通过`reasoning`参数启用/禁用）
- ✓ 客户支持应用
- ✓ 深度研究应用

**备注**: 
- 使用分段定价策略：超过128K上下文时，价格会翻倍
- 输出token价格是输入token的 2.5倍（≤128K）或 2.5倍（>128K）
- 支持缓存读取以降低成本
- 这是xAI的代理工具调用模型，特别适合实际业务场景

---

## 当前系统结构

### TokenTransaction 数据表

当前系统已包含以下字段：
- `PromptTokens` (int) - 输入/提示token数
- `CompletionTokens` (int) - 输出/完成token数
- `TotalTokens` (int) - 总token数
- `Cost` (float64) - 费用（USD）
- `Currency` (string) - 货币单位（默认"USD"）
- `Provider` (string) - 服务商名称
- `ModelName` (string) - 模型名称

**当前计费方式**：
- 使用统一计费：`Cost = TotalTokens * costPerToken`
- 需要改进为按模型支持分离计费或多类型计费

### TokenUsage 结构（Provider接口）

```go
type TokenUsage struct {
    PromptTokens     int     // 输入/提示token数
    CompletionTokens int     // 输出/完成token数
    TotalTokens      int     // 总token数（通常等于 PromptTokens + CompletionTokens）
    // 可选字段（用于特殊模型）
    AudioTokens      *int    // 音频token数（如果支持）
    CacheReadTokens  *int    // 缓存读取token数（如果支持）
    CacheWriteTokens *int    // 缓存写入token数（如果支持）
}
```

### PricingConfig 结构（建议）

```go
type ModelPricingConfig struct {
    Provider         string   // 服务商名称
    ModelName        string   // 模型名称
    PricingType      string   // "unified" | "separate" | "multi_type"
    InputPrice       float64  // 输入token价格 (USD per 1M tokens)
    OutputPrice      float64  // 输出token价格 (USD per 1M tokens)
    UnifiedPrice     *float64 // 统一价格（如果使用统一计费）
    AudioPrice       *float64 // 音频token价格（可选）
    CacheReadPrice   *float64 // 缓存读取价格（可选）
    CacheWritePrice  *float64 // 缓存写入价格（可选）
    // 其他自定义价格字段...
}
```

---

## 计费计算函数模板

### 统一计费模式

```go
func CalculateCost_Unified(usage *TokenUsage, pricePerToken float64) float64 {
    // pricePerToken 是每百万token的价格
    return float64(usage.TotalTokens) / 1_000_000.0 * pricePerToken
}
```

### 分离计费模式

```go
func CalculateCost_Separate(usage *TokenUsage, inputPrice, outputPrice float64) float64 {
    // inputPrice 和 outputPrice 都是每百万token的价格
    inputCost := float64(usage.PromptTokens) / 1_000_000.0 * inputPrice
    outputCost := float64(usage.CompletionTokens) / 1_000_000.0 * outputPrice
    return inputCost + outputCost
}
```

### 多类型计费模式

```go
func CalculateCost_MultiType(usage *TokenUsage, config *ModelPricingConfig) float64 {
    cost := 0.0
    
    // 输入token费用
    cost += float64(usage.PromptTokens) / 1_000_000.0 * config.InputPrice
    
    // 输出token费用
    cost += float64(usage.CompletionTokens) / 1_000_000.0 * config.OutputPrice
    
    // 音频token费用（如果适用）
    if usage.AudioTokens != nil && config.AudioPrice != nil {
        cost += float64(*usage.AudioTokens) / 1_000_000.0 * *config.AudioPrice
    }
    
    // 缓存读取费用（如果适用）
    if usage.CacheReadTokens != nil && config.CacheReadPrice != nil {
        cost += float64(*usage.CacheReadTokens) / 1_000_000.0 * *config.CacheReadPrice
    }
    
    return cost
}
```

### 分段计费模式（基于上下文长度）

```go
func CalculateCost_Tiered(usage *TokenUsage, config *ModelPricingConfig) float64 {
    // 判断上下文长度分段
    contextLength := usage.PromptTokens
    threshold := config.TierThreshold // 例如：128000
    
    var inputPrice, outputPrice, cacheReadPrice float64
    
    if contextLength <= threshold {
        // 使用低分段价格
        inputPrice = config.InputPriceLow
        outputPrice = config.OutputPriceLow
        if config.CacheReadPriceLow != nil {
            cacheReadPrice = *config.CacheReadPriceLow
        }
    } else {
        // 使用高分段价格
        inputPrice = config.InputPriceHigh
        outputPrice = config.OutputPriceHigh
        if config.CacheReadPriceHigh != nil {
            cacheReadPrice = *config.CacheReadPriceHigh
        }
    }
    
    cost := float64(usage.PromptTokens) / 1_000_000.0 * inputPrice
    cost += float64(usage.CompletionTokens) / 1_000_000.0 * outputPrice
    
    // 缓存读取费用（如果适用）
    if usage.CacheReadTokens != nil {
        cost += float64(*usage.CacheReadTokens) / 1_000_000.0 * cacheReadPrice
    }
    
    return cost
}
```

### 按张计费模式（图片生成）

```go
func CalculateCost_PerImage(imageCount int, pricePerImage float64) float64 {
    // pricePerImage 是每张图片的价格
    return float64(imageCount) * pricePerImage
}
```

---

## 实施计划

### 阶段1：数据收集
- [x] 创建计费标准文档
- [x] 收集 Gemini 系列所有模型计费信息（Gemini 3 Flash Preview）
- [x] 收集 DeepSeek 系列计费信息（deepseek-chat, deepseek-reasoner）
- [x] 收集豆包系列计费信息（Doubao-Seed-1.6, Doubao-Seed-1.8, Doubao-Seedream-4.5）
- [x] 收集 Grok 系列计费信息（Grok 4.1 Fast）
- [ ] 收集其他所有provider的计费信息

### 阶段2：数据结构设计
- [ ] 定义 ModelPricingConfig 结构
- [ ] 创建模型定价配置数据库表或配置文件
- [ ] 实现配置加载机制

### 阶段3：计费逻辑实现
- [ ] 实现计费计算函数
- [ ] 在 TokenTransaction 创建时使用正确的计费方式
- [ ] 为每个provider/provider-model组合配置计费规则

### 阶段4：测试验证
- [ ] 验证所有模型的计费准确性
- [ ] 对比实际API账单与系统计算的费用
- [ ] 修复偏差

---

## 更新日志

### 2026-01-XX（待补充日期）
- ✅ 添加OpenAI GPT系列免费模型计费标准
  - gpt-oss-20b（完全免费，20B参数）
  - gpt-oss-120b（完全免费，120B参数）
  - 通过OpenRouter访问
- ✅ 添加讯飞星火Spark X1.5计费标准
  - Spark X1.5（统一计费，2-3元/百万Token）
  - 支持快慢思考自主决策
  - 语言理解和任务规划能力显著提升
- ✅ 添加智谱AI GLM系列计费标准
  - GLM-4.7（分段计费，基于输入和输出长度，支持限时免费）
  - GLM-4.6（与GLM-4.7相同计费标准）
  - GLM-4.5-Air（分段计费，价格更优惠）
  - GLM-4.7-FlashX（统一价格，支持限时免费）
  - GLM-4.7-Flash（完全免费）
  - 记录限时免费规则和价格折扣
  - 注明长度单位（万Token）和分段规则
- ✅ 添加通义千问Max系列计费标准
  - qwen3-max系列（分段计费，支持Batch调用和上下文缓存折扣）
    - qwen3-max（标准版，支持Batch和缓存）
    - qwen3-max-2025-09-23（固定版本）
    - qwen3-max-preview（预览版，支持缓存和思考模式）
  - qwen-max系列（统一价格，部分支持Batch调用）
    - qwen-max（支持Batch）
    - qwen-max-latest（支持Batch）
    - qwen-max-2025-01-25（固定版本）
    - qwen-max-2024-09-19（旧版本）
    - qwen-max-2024-04-28（旧版本）
    - qwen-max-2024-04-03（旧版本）
  - 记录Batch调用和上下文缓存的折扣规则
  - 注明免费额度信息

### 2026-01-20
- 创建文档
- 添加 Gemini 3 Flash Preview 计费标准
- 添加 DeepSeek Chat 和 DeepSeek Reasoner 计费标准
- 添加 Doubao-Seed-1.6, Doubao-Seed-1.8, Doubao-Seedream-4.5 计费标准
- 添加 Grok 4.1 Fast 计费标准（分段计费模式）

---

## 注意事项

1. **价格可能会变动**：各服务商的定价可能会不定期调整，需要定期更新文档
2. **汇率问题**：如果系统使用其他货币（如星尘），需要设置汇率转换
3. **缓存机制**：某些模型支持缓存，使用缓存可以降低计费
4. **批量折扣**：某些服务商可能提供批量使用折扣，需要考虑
5. **免费额度**：某些模型可能有免费额度，需要单独处理


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

（待补充）

---

### 通义千问 (Qwen) 系列

（待补充）

---

### 智谱AI (GLM) 系列

（待补充）

---

### 讯飞星火 (Spark) 系列

（待补充）

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


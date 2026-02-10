# 模型可配置项清单（Seed 写入结果）

以下为 `SeedModelCapabilityConfigs` 中 **defaultCapabilityForModel** 对每个 provider（及部分 model）写入的**可配置项**。  
表内字段均为「是否支持」：1=支持、0=不支持；用户是否启用、具体取值由节点/用户配置决定。

---

## 一、所有模型共有的基础项（均为 1）

| 可配置项 | 说明 | 表中字段 | 所有模型 |
|----------|------|----------|----------|
| 温度 | temperature | support_temperature | ✅ |
| 最大生成长度 | max_tokens | support_max_tokens | ✅ |
| Top-P | top_p | support_top_p | ✅ |

---

## 二、按供应商/模型区分的可配置项

### 1. 通用默认（未在 switch 里单独设置的 provider）

- **support_stream** = 0  
- **support_thinking** = 0  
- **support_thinking_level** = 0  
- **support_enable_thinking** = 0  
- **support_frequency_penalty** = 0  
- **support_presence_penalty** = 0  
- **support_stop_sequences** = 0  
- **support_vision** = 0  
- **support_image_generation** = 0  
- **max_tokens_limit** = 32768  

当前 **无** 模型使用「通用默认」：所有 35 个模型所属的 provider 都在 switch 里有分支。

---

### 2. DeepSeek（2 个模型）

| 模型名 | stream | thinking | max_tokens_limit |
|--------|--------|----------|------------------|
| deepseek-chat | 1 | 1 | 8192 |
| deepseek-reasoner | 1 | 1 | 65536 |

其余可配置项：temperature、max_tokens、top_p 为 1；frequency_penalty、presence_penalty、thinking_level、enable_thinking、vision、image_generation 等为 0。

---

### 3. 豆包 Doubao（3 个模型）

| 模型名 | stream | thinking_level | max_tokens_limit |
|--------|--------|----------------|------------------|
| doubao-seed-1-6-251015 | 1 | 1 | 32768 |
| doubao-seed-1-8-251228 | 1 | 1 | 32768 |
| doubao-seedream-4-5-251128 | 1 | 1 | 32768 |

其余：thinking、enable_thinking、frequency_penalty、presence_penalty 等为 0。

---

### 4. 通义千问 Qwen（10 个模型）

| 模型名 | stream | enable_thinking | max_tokens_limit |
|--------|--------|-----------------|------------------|
| qwen-plus, qwen3-max, qwen3-max-2025-09-23, qwen3-max-preview | 1 | 1 | 32768 |
| qwen-max, qwen-max-latest, qwen-max-2025-01-25 | 1 | 1 | 32768 |
| qwen-max-2024-09-19, qwen-max-2024-04-28, qwen-max-2024-04-03 | 1 | 1 | 32768 |

其余：thinking、thinking_level、frequency_penalty、presence_penalty 等为 0。

---

### 5. 智谱 ZhipuAI（6 个模型）

| 模型名 | stream | thinking | max_tokens_limit |
|--------|--------|----------|------------------|
| glm-4.7, glm-4.6, glm-4.5-air, glm-4.7-flashx, glm-4.7-flash | 1 | 1 | 131072 |

其余：thinking_level、enable_thinking、frequency_penalty、presence_penalty 等为 0。

---

### 6. 讯飞星火 Spark（1 个模型）

| 模型名 | stream | max_tokens_limit |
|--------|--------|------------------|
| spark-x1.5 | 1 | 65535 |

其余：thinking、thinking_level、enable_thinking、frequency_penalty、presence_penalty 等为 0。

---

### 7. 腾讯混元 Hunyuan（0 个在计费 Seed 里）

当前计费 Seed 未包含 hunyuan 模型；若有新增，按 switch 会得到：stream=1，max_tokens_limit=32768，其余与通用默认一致。

---

### 8. Claude / GPT / Gemini / Grok（共 14 个模型）

| 供应商 | 模型数 | stream | frequency_penalty | presence_penalty | max_tokens_limit |
|--------|--------|--------|-------------------|------------------|------------------|
| claude | 3 | 1 | 1 | 1 | 131072 |
| gpt | 7 | 1 | 1 | 1 | 131072 |
| gemini | 1 | 1 | 1 | 1 | 131072 |
| grok | 2 | 1 | 1 | 1 | 131072 |

**Claude**：anthropic/claude-sonnet-4.5, anthropic/claude-opus-4.5, anthropic/claude-haiku-4.5  
**GPT**：openai/gpt-4o, gpt-4o-mini, gpt-5.1, gpt-5.2, gpt-5.2-pro, gpt-oss-20b, gpt-oss-120b  
**Gemini**：google/gemini-3-pro-preview  
**Grok**：x-ai/grok-4.1-fast, x-ai/grok-4  

上述模型：thinking、thinking_level、enable_thinking 均为 0；vision、image_generation 均为 0。

---

## 三、表字段与前端/接口对应关系

| 表字段（snake_case） | 前端/接口含义 | 备注 |
|----------------------|----------------|------|
| support_temperature | 支持调节温度 | 用户填 0~1 |
| support_max_tokens | 支持最大生成长度 | 用户填值且 ≤ max_tokens_limit |
| support_top_p | 支持 Top-P | 用户填 0~1 |
| support_stream | 支持流式输出 | 用户开关 |
| support_thinking | 深度思考（DeepSeek） | 用户开关 |
| support_thinking_level | 思考档位（豆包） | 用户选 minimal/low/medium/high |
| support_enable_thinking | 思考开关（通义） | 用户开关 |
| support_frequency_penalty | 频率惩罚 | 用户填 -2~2 |
| support_presence_penalty | 存在惩罚 | 用户填 -2~2 |
| support_stop_sequences | 停止序列 | 用户填数组 |
| support_vision | 图像输入 | 当前 Seed 全为 0 |
| support_image_generation | 图像生成 | 当前 Seed 全为 0 |
| max_tokens_limit | 该模型最大 token 上限 | 仅限制上限，不决定用户填多少 |

---

## 四、汇总：按「可配置项」看哪些模型支持

| 可配置项 | 支持的供应商/模型 |
|----------|-------------------|
| **stream** | DeepSeek 全系、豆包全系、通义全系、智谱全系、星火、Claude 全系、GPT 全系、Gemini、Grok 全系 |
| **thinking** | 仅 DeepSeek（2 个）、仅智谱（6 个） |
| **thinking_level** | 仅豆包（3 个） |
| **enable_thinking** | 仅通义（10 个） |
| **frequency_penalty / presence_penalty** | 仅 Claude（3）、GPT（7）、Gemini（1）、Grok（2） |
| **vision / image_generation** | 当前全部为 0，未开放 |

以上均可通过查询表 `model_capability_configs` 或接口 `GET /ai/providers/templates`（含 modelCapabilities）、`GET /ai/model-capabilities?provider=&model_name=` 得到一致结果。

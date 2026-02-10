# ALKaid 智能工具选择优化

## 📋 问题描述

用户反馈：AI 在"意图分析与规划"阶段**总是默认调用 `get_workflow`**，导致执行流程僵硬，缺乏灵活性。

### 原有问题

1. ❌ **固定调用模式**：无论用户意图如何，AI 总是先调用 `get_workflow`
2. ❌ **缺少知识检索**：AI 无法调用知识库了解最佳实践和示例
3. ❌ **工具描述过强**：`get_workflow` 的描述让 AI 觉得"修改工作流"时必须先调用
4. ❌ **不够智能**：AI 没有根据用户意图自主选择工具的能力

### 用户期望

✅ AI 应该自己决定是否需要调用 `get_workflow`  
✅ 优先调用知识库了解最佳实践  
✅ 根据用户意图智能选择工具  
✅ 生成全新工作流时，无需查看当前工作流

## 🔧 解决方案

### 1. 新增 `search_knowledge` 工具

#### 1.1 工具定义

```go
// Low_code_Backend/modules/alkaid/services/agentic/tool_defs.go

{
    Type: "function",
    Function: &providers.ToolDefFunc{
        Name: "search_knowledge",
        Description: "从知识库中检索相关信息：最佳实践、常见问题解答、示例工作流、节点使用技巧等。建议优先调用此工具了解背景知识和最佳实践，再决定是否需要生成工作流。参数 query 为查询内容。",
        Parameters: map[string]interface{}{
            "type": "object",
            "properties": map[string]interface{}{
                "query": map[string]interface{}{
                    "type": "string",
                    "description": "搜索关键词或问题，如：数据清洗最佳实践、如何使用 AI 节点、示例爬虫工作流",
                },
            },
            "required": []string{"query"},
        },
    },
}
```

#### 1.2 工具实现

```go
// Low_code_Backend/modules/alkaid/services/tools/search_knowledge.go

func (r *Registry) runSearchKnowledge(params map[string]interface{}, sessionID uint) (result interface{}, resultSummary string, err error) {
    query, ok := params["query"].(string)
    if !ok || query == "" {
        return nil, "", fmt.Errorf("query 参数不能为空")
    }

    // 使用知识检索服务
    retriever := alkaidServices.NewKnowledgeRetriever()
    userID := uint(0)
    if r.runner != nil && r.runner.Repo != nil {
        if session, err := r.runner.Repo.GetSessionByID(sessionID); err == nil && session != nil {
            userID = session.UserID
        }
    }
    
    knowledge, err := retriever.RetrieveRelevantKnowledge(query, userID, 5)
    if err != nil {
        return nil, "", fmt.Errorf("知识检索失败: %w", err)
    }

    if len(knowledge) == 0 {
        return map[string]interface{}{
            "query":   query,
            "results": []interface{}{},
        }, "未找到相关知识", nil
    }

    results := make([]map[string]interface{}, len(knowledge))
    for i, k := range knowledge {
        results[i] = map[string]interface{}{
            "title":    k.Title,
            "category": k.Category,
            "content":  k.Content,
        }
    }

    summary := fmt.Sprintf("找到 %d 条相关知识", len(knowledge))
    return map[string]interface{}{
        "query":   query,
        "results": results,
    }, summary, nil
}
```

### 2. 优化工具描述

#### 2.1 修改 `get_workflow` 描述

**修改前**：
> "获取当前画布上的工作流（节点与边）。当用户询问「当前工作流」「画布上有什么」「帮我看看现在的流程」**或需要基于现有工作流做修改、优化、补全**时调用。"

**修改后**：
> "获取当前画布上的工作流（节点与边）。**仅在以下场景调用**：1) 用户明确要求查看当前工作流；2) 用户要求修改/优化**已有**工作流。**如果是生成全新工作流，无需调用此工具**。"

#### 2.2 工具顺序调整

将 `search_knowledge` 放在工具列表的**第一位**，强调其优先级：

```go
func GetToolDefsForLLM() []providers.ToolDef {
    return []providers.ToolDef{
        // 1. 优先：知识检索
        {Name: "search_knowledge", ...},
        // 2. 获取技术规范
        {Name: "get_capabilities", ...},
        // 3. 获取当前工作流（按需）
        {Name: "get_workflow", ...},
        // 4. 获取节点规格
        {Name: "get_node_spec", ...},
    }
}
```

### 3. 优化提示词

```go
// Low_code_Backend/modules/alkaid/services/agentic/loop.go

contentForLLM := historyStr + "\n\n请根据以上对话历史，回复最后一条用户消息。\n\n**工具调用建议**（请根据实际需求智能选择）：\n1. 如需了解最佳实践、示例或技巧 → 优先调用 search_knowledge\n2. 如需了解技术规范（节点类型、JSON格式等）→ 调用 get_capabilities\n3. 如需查看或修改现有工作流 → 调用 get_workflow\n4. 如需生成全新工作流 → 无需调用 get_workflow，直接基于 get_capabilities 和 search_knowledge 生成"
```

## 🎯 预期效果

### 场景 1：生成新工作流

**用户**："帮我生成一个数据爬取和分析的工作流"

**AI 行为**：
```
1. 调用 search_knowledge("数据爬取工作流示例")
   → 了解最佳实践和常见模式
2. 调用 get_capabilities()
   → 了解节点类型和规范
3. 生成工作流
   → 无需调用 get_workflow
```

### 场景 2：修改现有工作流

**用户**："把数据清洗节点的配置改一下"

**AI 行为**：
```
1. 调用 get_workflow()
   → 查看当前工作流结构
2. 调用 search_knowledge("数据清洗最佳配置")
   → 了解最佳实践
3. 生成补丁
   → propose_patch
```

### 场景 3：咨询问题

**用户**："AI 节点怎么用？"

**AI 行为**：
```
1. 调用 search_knowledge("AI 节点使用方法")
   → 直接回答问题
2. 可选：调用 get_node_spec("ai")
   → 获取详细规格
```

## 📊 优化对比

| 维度 | 修改前 | 修改后 |
|------|--------|--------|
| **工具数量** | 3 个 | 4 个（新增 `search_knowledge`） |
| **默认行为** | 总是先调用 `get_workflow` | 根据意图智能选择 |
| **知识获取** | ❌ 无法调用知识库 | ✅ 可以调用知识库 |
| **新建工作流** | 先调用 `get_workflow`（冗余） | 直接基于知识和规范生成 |
| **修改工作流** | 调用 `get_workflow` | 调用 `get_workflow`（正确） |
| **回答问题** | 只能基于系统提示词 | 可以检索知识库 |

## 🔍 工具调用决策树

```
用户消息
    │
    ▼
分析用户意图
    │
    ├─ 咨询/询问类
    │   ├─ 调用 search_knowledge
    │   └─ 可选：调用 get_node_spec（如需详细规格）
    │
    ├─ 生成新工作流
    │   ├─ 调用 search_knowledge（了解最佳实践）
    │   ├─ 调用 get_capabilities（了解技术规范）
    │   └─ 生成工作流 JSON
    │
    └─ 修改/优化现有工作流
        ├─ 调用 get_workflow（获取当前状态）
        ├─ 可选：调用 search_knowledge（了解最佳实践）
        └─ 生成补丁或新工作流
```

## 📝 相关文件

### 后端

- `modules/alkaid/services/agentic/tool_defs.go` - 新增 `search_knowledge` 工具定义，优化 `get_workflow` 描述
- `modules/alkaid/services/tools/search_knowledge.go` - 新建，`search_knowledge` 工具实现
- `modules/alkaid/services/tools/registry.go` - 注册 `search_knowledge` 工具
- `modules/alkaid/services/agentic/loop.go` - 优化提示词，给出工具选择建议

## ✅ 验收测试

### 测试 1：生成新工作流

1. 发送消息："帮我生成一个爬取新闻网站的工作流"
2. **检查**：工具步中**不应该**出现 `get_workflow`
3. **期望**：应该调用 `search_knowledge` 和 `get_capabilities`

### 测试 2：修改工作流

1. 确保画布上已有工作流
2. 发送消息："把爬虫节点的 URL 改成 https://example.com"
3. **检查**：工具步中**应该**出现 `get_workflow`
4. **期望**：调用 `get_workflow` → 生成补丁

### 测试 3：咨询问题

1. 发送消息："数据清洗节点有哪些配置项？"
2. **检查**：工具步中应该出现 `search_knowledge`
3. **期望**：直接基于知识库回答，无需生成工作流

## 🎉 总结

通过这次优化，ALKaid 变得更加智能：

- ✅ **自主决策**：AI 根据用户意图自主选择工具，而不是固定流程
- ✅ **知识驱动**：新增知识检索工具，AI 可以学习最佳实践
- ✅ **更高效**：生成新工作流时无需查看当前工作流，减少冗余调用
- ✅ **更灵活**：工具描述优化，AI 对调用时机的理解更准确

用户现在可以体验到更自然、更智能的对话式工作流生成体验！🚀

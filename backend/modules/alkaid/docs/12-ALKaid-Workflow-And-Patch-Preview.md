## 瑶光星工作流预览与补丁预览设计

### 1. 目标与范围

- 在现有瑶光星 Agentic 流程基础上增强“结果交付”阶段：
  - 新工作流：支持“预览 → 确认 / 取消”，避免直接覆盖画布。
  - 补丁：支持可视化 diff，用户可以逐条或一键选择应用或放弃。
- 尽量复用已有后端能力（`pendingWorkflow`、`pendingPatch`、`ApplyWorkflow`、`ApplyPatch` 等），优先通过前端状态与 UI 改造实现。

不在本轮范围内的事项（可留作后续迭代）：

- 更细粒度的字段级 diff 展示（如节点 config 内部字段的逐项高亮）。
- 多轮补丁堆叠（当前仅考虑一轮待确认补丁）。

---

### 2. 现状简要回顾

#### 2.1 后端

- 会话模型 `AlkaidSession`：
  - `PendingWorkflowJSON shared.JSONB // WorkflowExportData`
  - `PendingPatchJSON    shared.JSONB // []PatchItem`
- 工具：
  - `propose_workflow`：写 `PendingWorkflowJSON`，不改画布。
  - `propose_patch`：写 `PendingPatchJSON`，不改画布。
- 应用接口：
  - `ApplyWorkflow(req ApplyWorkflowRequest)`：
    - 从 `PendingWorkflowJSON` 读取完整节点 / 边，直接覆盖画布。
  - `ApplyPatch(req ApplyPatchRequest)`：
    - 从 `PendingPatchJSON` 读取 patch 列表；
    - 用 `ApplyPatchToWorkflow(current, patchList)` 生成新的节点 / 边并保存。
- SSE：
  - `pending_workflow` 事件：告知前端有待确认工作流和节点 / 边数量。
  - `pending_patch` 事件：告知前端有 N 条补丁待确认。

#### 2.2 前端

- `AlkaidAssistant`：
  - 收到 `pending_workflow` / `pending_patch` 事件后，只保存摘要（节点数 / patch 数），不直接改变画布。
  - 当前“应用工作流”“应用补丁”按钮：
    - 调用 `applyWorkflow(sessionId, workflowId?)`
    - 调用 `applyPatch(sessionId, workflowId?)`
- 工作流画布已有能力：
  - 加载当前 workflow 的 nodes / edges。
  - 手动编辑节点 / 连线并保存。

---

### 3. 新工作流预览设计

#### 3.1 核心思路

- 保持后端行为不变，`ApplyWorkflow` 仍作为“最终确认并写库”的接口。
- 前端引入“工作流预览态”，三态：
  1. 正常态：画布展示当前 workflow。
  2. 新工作流预览态：画布展示 `pendingWorkflow`，尚未写库。
  3. 确认后态：调用 `applyWorkflow` 成功后，画布展示已更新 workflow。
- 用户操作：
  - “确认应用”：调用后端接口，覆盖保存。
  - “取消预览”：恢复预览前的工作流，仅前端回退，不调用后端。

#### 3.2 前端数据模型

在工作流编辑模块或与 `AlkaidAssistant` 共享的 store 中新增：

- `originalWorkflow: WorkflowExportData | null`
  - 进入预览前的真实画布快照（nodes、edges、commentCards 等）。
- `previewWorkflow: WorkflowExportData | null`
  - 瑶光星生成的待确认工作流（来自 `PendingWorkflowJSON`）。
- `workflowPreviewMode: 'none' | 'previewing'`
  - 是否处于新工作流预览态。

#### 3.3 状态流转

1. 收到 `pending_workflow` 事件：
   - 通过会话接口拉取 `PendingWorkflowJSON`（如果现有接口不支持，增加查询 pending workflow 的只读接口）。
   - 成功后：
     - 将当前画布序列化为 `originalWorkflow`。
     - 将 `PendingWorkflowJSON` 解析为 `previewWorkflow`。
     - 设置 `workflowPreviewMode = 'previewing'`。
     - 画布数据源切换为 `previewWorkflow`，并显示“预览提示”。

2. 用户点击“确认应用新工作流”：
   - 调用现有 `applyWorkflow(sessionId, workflowId?)`。
   - 成功后：
     - 清空 `originalWorkflow`、`previewWorkflow`。
     - 设置 `workflowPreviewMode = 'none'`。
     - 重新拉取 workflow 或直接用 `previewWorkflow` 内容作为当前画布状态。

3. 用户点击“取消预览新工作流”：
   - 不调用后端。
   - 画布数据源切换回 `originalWorkflow`。
   - 清空 `previewWorkflow`。
   - 设置 `workflowPreviewMode = 'none'`。

#### 3.4 UI 行为

- 在画布顶部展示预览提示条，例如：
  - “正在预览瑶光星生成的新工作流，确认后将覆盖当前画布。”
- 提示条内提供两个操作：
  - “确认应用到画布”
  - “取消预览，恢复原工作流”
- 在预览态下，禁用画布上的自由编辑（节点拖拽、连线修改等），避免状态与后端基线脱节。

---

### 4. 补丁预览设计

#### 4.1 核心思路

- `PendingPatchJSON` 保存的是对当前画布的 patch 列表（add / remove / set / set_edges）。
- 在前端，通过“当前 workflow + patchList”生成一个“补丁预览图”，并对每个节点 / 连线标记变更类型与选中状态：
  - 新增：绿色半透明，标记为 add。
  - 更新：橙色，标记为 update。
  - 删除：红色，标记为 remove。
- 用户可以：
  - 在补丁列表中针对单条补丁勾选 / 取消。
  - 在画布 UI 上对单个节点 / 连线执行“保留 / 忽略此变更”。
  - 一键应用全部补丁或一键放弃全部补丁。

#### 4.2 前端数据模型

在前端增加补丁预览相关状态：

- `patchPreviewMode: 'none' | 'previewing'`
- `originalWorkflowForPatch: WorkflowExportData | null`
  - 用于从补丁预览态退出时恢复画布。
- `patchList: PatchItemExt[]`
  - 扩展自现有 `PatchItem` 类型，包含 UI 所需信息，例如：

```ts
type PatchOp = 'add' | 'remove' | 'set' | 'set_edges';

interface PatchItemExt {
  id: string;
  op: PatchOp;
  nodeId?: string;
  path?: string;
  value?: unknown;
  selected: boolean;
  targetType: 'node' | 'edge' | 'graph';
}
```

- `previewGraphForPatch: WorkflowExportData | null`
  - 当 `patchPreviewMode = 'previewing'` 时，画布展示的图（基于 current + patchList(selected) 计算）。

#### 4.3 补丁预览进入与退出

1. 收到 `pending_patch` 事件：
   - 从会话接口拉取 `PendingPatchJSON`。
   - 确保当前 workflow 已加载；如未加载，先读取当前 workflow。
   - 将当前 workflow 序列化为 `originalWorkflowForPatch`。
   - 将 `PendingPatchJSON` 转换为 `patchList`：
     - 为每条补丁生成本地 `id`。
     - 默认 `selected = true`。
     - 根据内容推断 `targetType`（节点、边或整个边集）。
   - 调用“补丁预览应用函数”，生成 `previewGraphForPatch` 与节点 / 边的变更标记。
   - 设置 `patchPreviewMode = 'previewing'`，画布切换到 `previewGraphForPatch`。
   - 在顶部或侧边展示“补丁预览控制条”（包含一键应用 / 一键放弃）。

2. 用户点击“取消补丁预览”：
   - 不调用后端（保守策略）。
   - 恢复画布为 `originalWorkflowForPatch`。
   - 清空 `patchList` 与 `previewGraphForPatch`。
   - 设置 `patchPreviewMode = 'none'`。
   - 后续可增加简单后端接口清空 `PendingPatchJSON`，避免下次仍提示有补丁。

#### 4.4 补丁预览应用逻辑（前端）

在前端实现纯函数（不调用后端）：

```ts
function applyPatchForPreview(
  current: WorkflowExportData,
  patchList: PatchItemExt[],
): {
  graph: WorkflowExportData;
  nodeMark: Record<string, 'add' | 'remove' | 'update' | 'none'>;
  edgeMark: Record<string, 'add' | 'remove' | 'update' | 'none'>;
}
```

规则与后端 `ApplyPatchToWorkflow` 对齐，但只对 `selected = true` 的补丁生效：

- 初始化：
  - 将 `current.nodes`、`current.edges` 深拷贝到局部变量。
  - 构建 `nodesById`、`edgesById` 索引。
- 遍历 `patchList`：
  - 跳过 `selected = false` 的补丁。
  - 根据 `op` 与 `path` 处理：
    - `add`：
      - 对节点：新增节点，标记 `nodeMark[id] = 'add'`。
    - `remove`：
      - 删除对应节点并移除相关边，标记 `nodeMark[id] = 'remove'`。
    - `set`：
      - `path = 'data'` 或 `'position'`：
        - 替换对应字段。
        - 标记 `nodeMark[nodeId] = 'update'`。
    - `set_edges`：
      - 整体替换边集合：
        - 新边中不存在于旧边的标记为 `add`。
        - 旧边中不存在于新边的标记为 `remove`。
        - 同 ID 但属性变化的标记为 `update`。

最终返回：

- 应用选中补丁后的 `graph`。
- 节点与边的变更类型字典，用于画布着色。

#### 4.5 边与节点的存在约束

在任何时刻，连线必须满足“源节点和目标节点同时存在”的约束，节点可以独立存在，但连线不可以。

在补丁预览和最终应用时需要显式遵守该约束：

- 在 `applyPatchForPreview` 中：
  - 先处理所有“节点类补丁”（add / remove / set position / set data），再处理“边类补丁”（set_edges 或未来的 edge-add / edge-remove）。
  - 在重建 `edges` 时，对于任意一条边，如果其 `source` 或 `target` 在当前 `nodesById` 中不存在，则直接丢弃该边，并不写入结果图。
  - 当执行节点删除补丁时，同时删除所有以该节点作为 `source` 或 `target` 的边。
- 在前端生成最终 `graph` 并调用 workflow 保存接口前，应再做一次“边端点存在性检查”，保证提交给后端的 `edges` 中不存在悬空连线。
- 后端在保存 workflow 节点 / 边时也可以增加保护性校验（可选），发现无效边时拒绝保存或自动过滤。

#### 4.5 单条补丁的选择 / 取消

- 在补丁列表 UI 中：
  - 每条补丁对应一行，展示简要描述，如：
    - “新增节点：爬虫节点（id=node-3）”
    - “更新节点配置：分析节点（id=analysis-1）”
    - “删除节点：旧输出节点（id=output-1）”
  - 每行有一个 checkbox 或开关，切换 `patchList[i].selected`。
  - 每次选择变更后，重新调用 `applyPatchForPreview` 更新 `previewGraphForPatch` 与标记。
- 在画布 UI 上：
  - 根据 `nodeMark` / `edgeMark` 高亮节点和边：
    - 绿色：新增。
    - 橙色：更新。
    - 红色：删除。
  - 可在节点 / 边 hover 时展示小操作按钮，例如“排除此变更”，实际行为是将对应补丁的 `selected` 设为 false。

#### 4.6 一键应用与一键取消

- 一键应用所有补丁：
  - 保持所有补丁 `selected = true`（默认即可）。
  - 触发“确认应用补丁”动作（见 4.7）。
- 一键取消全部补丁：
  - 等价于“取消补丁预览”：直接退出预览态并恢复 `originalWorkflowForPatch`。
  - 可选扩展：调用后端接口清空 `PendingPatchJSON`。

#### 4.7 确认应用补丁的落地方案

当前考虑两种方案：

**方案 A：前端生成最终画布，直接走 Workflow 保存接口（优先方案）**

1. 基于 `originalWorkflowForPatch` 与 `patchList(selected)` 调用 `applyPatchForPreview` 得到最终 `graph`。
2. 使用现有 workflow 保存接口提交 `graph.nodes` / `graph.edges`。
3. 可增加简单后端接口清空 `PendingPatchJSON`（如 `POST /alkaid/session/:id/discard-patch`）。

优点：后端无需理解“部分应用补丁”，逻辑与用户手动编辑画布保持一致。

**方案 B：后端新增接口接受过滤后的补丁**

1. 在前端过滤出 `selected = true` 的补丁列表 `filteredPatch`。
2. 新增接口 `POST /alkaid/applyPatchCustom`，请求体包含：
   - `sessionId`
   - `workflowId`
   - `patch: PatchItem[]`
3. 后端基于当前 workflow 与 `filteredPatch` 调用 `ApplyPatchToWorkflow`，保存并清空 `PendingPatchJSON`。

优点：补丁应用逻辑集中在后端。

本轮实现优先采用方案 A，方案 B 可作为扩展。

---

### 5. 整图预览与补丁预览的协同

- 在一次 Agentic 生成中，瑶光星可能同时给出：
  - 新工作流（整图）。
  - 补丁（diff）。
- 前端需要显式区分当前处于哪种预览模式：
  - `workflowPreviewMode` 与 `patchPreviewMode` 互斥：
    - 启动新工作流预览时，如在补丁预览态，应先退出补丁预览。
    - 启动补丁预览时，如在新工作流预览态，应先退出工作流预览。
- UI 上建议在结果面板中提供清晰入口：
  - “预览并替换整个工作流”
  - “仅在当前画布上应用补丁”

---

### 6. 异常与边界情况

- `PendingWorkflowJSON` 或 `PendingPatchJSON` 格式异常：
  - 前端拉取失败时，仅提示错误，不进入预览态。
- 当前 workflow 为空：
  - 新工作流预览：正常，预览图即为新 workflow。
  - 补丁预览：
    - 无当前节点时，补丁效果有限，UI 可提示“当前画布为空，建议使用‘应用工作流’而非补丁”。
- 预览态下的画布编辑：
  - 在任一预览态中，建议禁用普通编辑（拖拽、增删节点等），仅允许与补丁相关的选择操作，以避免状态漂移。

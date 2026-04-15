# 工作流模板：用户端复用说明

管理端做「拖拽设置节点」时，可以直接复用用户端（frontend）的编辑器与配套逻辑，避免重复造轮子。

## 一、用户端可复用内容概览

| 类别 | 路径 | 说明 |
|------|------|------|
| **画布本体** | `frontend/src/components/WorkflowEditor/index.tsx` | ReactFlow 画布、节点/边状态、加载/保存、快捷键 |
| **节点类型** | `WorkflowEditor/nodes/*` | start / crawler / dataclean / ai / condition / transform / loop / merge / delay / output / end / comment |
| **左侧节点面板** | `WorkflowEditor/panels/NodePanel.tsx` | 从面板拖拽添加节点 |
| **节点配置面板** | `WorkflowEditor/panels/NodeConfigPanel.tsx` | 选中节点后右侧配置（表单项、变量选择等） |
| **Hooks** | `WorkflowEditor/hooks/useWorkflowNodes.ts` | 添加节点、注释卡、删除、更新配置 |
| **Hooks** | `WorkflowEditor/hooks/useWorkflowSave.ts` | loadWorkflowNodes、saveWorkflowInternal（依赖 API） |
| **数据转换** | `frontend/src/utils/workflowTransformers.ts` | 节点/边/注释卡与后端格式互转 |
| **节点工具** | `frontend/src/utils/nodeUtils.ts` | getDefaultConfig、isCommentNode、generateRandomPosition、calculateMaxNodeId |
| **导入导出** | `frontend/src/utils/workflowImportExport.ts` | WorkflowExportData、importWorkflow、exportWorkflow（客户端「从模板导入」可复用） |

用户端编辑器通过 `workflowApi.getWorkflowNodes(workflowId)` / `workflowApi.saveWorkflowNodes(workflowId, data)` 与后端通信。**模板在库里就是一条 `is_template=true` 的 workflow**，节点存同一张表，所以接口完全一致：管理端用「模板对应的 workflow id」调同一套 GET/PUT `/api/workflows/:id/nodes` 即可（需管理员登录后调用，且该模板的 owner 为该管理员）。

---

## 二、管理端如何复用

### 2.1 方案：路径别名 + 可选 workflowId

- **同仓库**：admin-frontend 与 frontend 在同一 repo，可用 Vite 别名直接引用用户端源码。
- **依赖**：在 Admin 的 `package.json` 中增加用户端编辑器所需依赖（至少 `reactflow`；若直接复用完整 WorkflowEditor，还需 `react-i18next`、`i18next`、`zustand`，与用户端版本对齐）。
- **API**：管理端当前请求走 `/api`（与用户端一致），管理员登录后调用 `GET/PUT /api/workflows/:id/nodes` 时传入模板的 workflow id，即可读写该模板的节点/边，无需新接口。

### 2.2 具体步骤建议

1. **用户端小改动（便于被管理端复用）**  
   - 在 `WorkflowEditor` 上增加可选 prop：`workflowId?: string`。  
   - 组件内：`const fromParams = useParams<{ workflowId?: string }>(); const workflowId = workflowIdProp ?? fromParams.workflowId;`  
   - 这样管理端传入 `workflowId={String(templateId)}` 即可，不必依赖路由参数。

2. **Admin 依赖**  
   - 安装：`reactflow`（必选）；若整组件复用再按需加 `react-i18next`、`i18next`、`zustand`。

3. **Admin Vite 别名**  
   - 在 `admin-frontend/vite.config.ts` 的 `resolve.alias` 中增加一项，例如：  
     - `'@workflow': path.resolve(__dirname, '../frontend/src')`  
   - 这样管理端可以：`import WorkflowEditor from '@workflow/components/WorkflowEditor';`，并同样通过 `@workflow/utils/workflowTransformers` 等引用工具。

4. **Admin 路由与页面**  
   - 例如增加路由：`/workflow-templates/:id/edit-canvas`。  
   - 对应页面：根据 `id` 取模板详情（可选），再渲染：  
     `<WorkflowEditor workflowId={String(id)} />`  
   - 不传 `workflowId` 时行为与用户端一致（从路由 params 读）；传了则优先用 prop，便于管理端在「模板编辑」场景只传模板 id。

5. **可选：精简模板编辑态**  
   - 若希望管理端只做「画布 + 节点配置」、不展示执行/任务历史/Alkaid 等，可再在用户端为 WorkflowEditor 增加 `mode?: 'full' | 'template'`，在 `template` 下隐藏执行、历史、AI 助手等区块；或管理端包一层，只渲染画布 + NodePanel + NodeConfigPanel（需从用户端按需导出这些子组件）。

---

## 三、后端无需为「编辑模板节点」单独开接口

- 模板即 `workflows` 表中 `is_template = true` 的记录，节点在 `workflow_nodes`。  
- 现有 `GET/PUT /api/workflows/:id/nodes` 只校验「工作流存在」，不区分是否模板。  
- 创建模板时若将该模板的 `user_id` 设为当前管理员，则管理员用同一套 `/api/workflows/:id/nodes` 即可编辑该模板的节点。  
- 后续若支持「从空白创建模板」，只需在创建模板时不再强制 `source_workflow_id`，创建出空模板后再由管理端用上述同一接口拉取/保存节点即可。

---

## 四、客户端「从模板导入」可复用

- 用户端已有「从 JSON/文件导入」逻辑（`importWorkflow` + `transformNodesFromLoadFormat` / `transformEdgesFromLoadFormat`）。  
- 客户端「从模板导入」只需：  
  1. 调接口拿到「已发布模板」的 nodes/edges（与现有 `getWorkflowNodes` 返回结构一致，或后端提供等价结构）。  
  2. 将返回结果转成当前画布所需的 nodes/edges（可复用同一套 transformers 或直接兼容现有格式）。  
  3. 调用现有的「导入到画布」逻辑（setNodes/setEdges）即可。  
- 因此用户端可复用：`workflowTransformers`、`workflowImportExport` 的类型与转换逻辑，以及当前画布的初始化/更新方式。

---

## 五、小结

- **画布与节点**：直接复用用户端 `WorkflowEditor`、节点组件、NodePanel、NodeConfigPanel、useWorkflowNodes、useWorkflowSave、workflowTransformers、nodeUtils。  
- **管理端**：加别名与依赖 → 新路由「编辑模板画布」→ 传入 `workflowId={templateId}` 使用同一编辑器；保存/加载走现有 `/api/workflows/:id/nodes`。  
- **客户端从模板导入**：复用现有导入逻辑与数据格式，只需新增「获取已发布模板 nodes/edges」的接口与入口。

这样可以在不做重复实现的前提下，把「拖拽设置节点」和「发布后客户端导入」都打通。

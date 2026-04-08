package services

// ExecutionMeta 表示一次工作流执行的元信息（供节点实现使用）
// 目标：
// - 输出节点生成 artifact 时需要 userId/workflowId/taskId 来做归属与对外导出 API 查询
// - AI 节点执行需要 userId 做模型归属校验/计费
type ExecutionMeta struct {
	UserID       uint
	WorkflowID   *uint
	TaskID       *uint
	RuntimeInput interface{}
	RuntimeMeta  map[string]interface{}
}

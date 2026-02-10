-- 瑶光星 Agentic 增强：会话表增加阶段、工具步、待确认工作流/补丁字段
-- 与 modules/alkaid/models/alkaid.go 中 AlkaidSession 扩展一致

ALTER TABLE alkaid_sessions
  ADD COLUMN IF NOT EXISTS current_phase VARCHAR(32) DEFAULT '',
  ADD COLUMN IF NOT EXISTS tool_steps_json JSONB,
  ADD COLUMN IF NOT EXISTS pending_workflow_json JSONB,
  ADD COLUMN IF NOT EXISTS pending_patch_json JSONB;

COMMENT ON COLUMN alkaid_sessions.current_phase IS 'Agent 当前阶段: idle, planning, generating, validating, repairing, running_trial, summarizing, waiting_approval, error';
COMMENT ON COLUMN alkaid_sessions.tool_steps_json IS '最近工具步 []AgentToolStep';
COMMENT ON COLUMN alkaid_sessions.pending_workflow_json IS '待用户确认的工作流 WorkflowExportData';
COMMENT ON COLUMN alkaid_sessions.pending_patch_json IS '待用户确认的补丁 []PatchItem';

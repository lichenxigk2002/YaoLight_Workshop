ALTER TABLE alkaid_sessions
  ADD COLUMN IF NOT EXISTS current_task_mode VARCHAR(32) DEFAULT '';

COMMENT ON COLUMN alkaid_sessions.current_task_mode IS 'Agent 当前任务模式: chat, explain, generate, repair, trial_debug';

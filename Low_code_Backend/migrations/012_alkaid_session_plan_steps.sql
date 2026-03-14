ALTER TABLE alkaid_sessions
  ADD COLUMN IF NOT EXISTS plan_steps_json JSONB;

COMMENT ON COLUMN alkaid_sessions.plan_steps_json IS '最近计划步 []AgentPlanStep';

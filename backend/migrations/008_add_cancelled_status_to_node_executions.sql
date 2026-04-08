-- 008_add_cancelled_status_to_node_executions.sql
-- 为节点执行状态添加 cancelled 状态，用于支持手动中止

-- 修改 task_node_executions 表的 status 约束，添加 'cancelled' 状态
ALTER TABLE task_node_executions 
DROP CONSTRAINT IF EXISTS task_node_executions_status_check;

ALTER TABLE task_node_executions 
ADD CONSTRAINT task_node_executions_status_check 
CHECK (status IN ('pending','running','completed','failed','skipped','timeout','cancelled'));


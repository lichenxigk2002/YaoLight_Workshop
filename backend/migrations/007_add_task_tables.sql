-- 007_add_task_tables.sql
-- 添加任务相关表

-- 创建任务表
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    schedule_id INTEGER,
    name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','queued','running','paused','completed','failed','cancelled','timeout')),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    input_data JSONB,
    result JSONB,
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 0,
    retry_config JSONB,
    timeout INTEGER,
    estimated_duration INTEGER,
    actual_duration INTEGER,
    resource_usage JSONB,
    execution_context JSONB,
    tags JSONB NOT NULL DEFAULT '[]',
    metadata JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancelled_by INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_id ON tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_id ON tasks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_cancelled_by ON tasks(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- 创建任务节点执行记录表
CREATE TABLE IF NOT EXISTS task_node_executions (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    node_id VARCHAR(100) NOT NULL,
    node_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending','running','completed','failed','skipped','timeout')),
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    error_stack TEXT,
    execution_time INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    resource_usage JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_node_executions_task_id ON task_node_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_node_executions_status ON task_node_executions(status);

-- 创建任务日志表
CREATE TABLE IF NOT EXISTS task_logs (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL,
    node_id VARCHAR(100),
    level VARCHAR(20) NOT NULL CHECK (level IN ('debug','info','warn','error','fatal')),
    message TEXT NOT NULL,
    metadata JSONB,
    stack_trace TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_node_id ON task_logs(node_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_level ON task_logs(level);
CREATE INDEX IF NOT EXISTS idx_task_logs_created_at ON task_logs(created_at);

-- 创建任务调度表
CREATE TABLE IF NOT EXISTS task_schedules (
    id SERIAL PRIMARY KEY,
    workflow_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    max_runs INTEGER,
    run_count INTEGER NOT NULL DEFAULT 0,
    next_run_at TIMESTAMP,
    last_run_at TIMESTAMP,
    last_run_status VARCHAR(20),
    config JSONB,
    notification_config JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_task_schedules_workflow_id ON task_schedules(workflow_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_user_id ON task_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_task_schedules_is_active ON task_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_task_schedules_next_run_at ON task_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_task_schedules_deleted_at ON task_schedules(deleted_at);


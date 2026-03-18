ALTER TABLE task_schedules
    ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) NOT NULL DEFAULT 'cron',
    ADD COLUMN IF NOT EXISTS webhook_token VARCHAR(120),
    ADD COLUMN IF NOT EXISTS webhook_secret_hash VARCHAR(128),
    ADD COLUMN IF NOT EXISTS webhook_secret_encrypted TEXT,
    ADD COLUMN IF NOT EXISTS last_error_message TEXT,
    ADD COLUMN IF NOT EXISTS retry_policy JSONB,
    ADD COLUMN IF NOT EXISTS input_template JSONB,
    ADD COLUMN IF NOT EXISTS last_trigger_request_id VARCHAR(120);

UPDATE task_schedules
SET trigger_type = 'cron'
WHERE trigger_type IS NULL OR btrim(trigger_type) = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_schedules_webhook_token
    ON task_schedules(webhook_token)
    WHERE webhook_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_task_schedules_trigger_type
    ON task_schedules(trigger_type);

CREATE TABLE IF NOT EXISTS task_schedule_runs (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL,
    workflow_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    trigger_type VARCHAR(20) NOT NULL,
    trigger_key VARCHAR(200) NOT NULL,
    request_id VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    task_id INTEGER,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    input_payload JSONB,
    metadata JSONB,
    triggered_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_schedule_runs_schedule_id
    ON task_schedule_runs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_task_schedule_runs_workflow_id
    ON task_schedule_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_task_schedule_runs_user_id
    ON task_schedule_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_task_schedule_runs_status
    ON task_schedule_runs(status);
CREATE INDEX IF NOT EXISTS idx_task_schedule_runs_triggered_at
    ON task_schedule_runs(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_schedule_runs_deleted_at
    ON task_schedule_runs(deleted_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_schedule_runs_schedule_trigger_key
    ON task_schedule_runs(schedule_id, trigger_key)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_schedule_runs_schedule_request_id
    ON task_schedule_runs(schedule_id, request_id)
    WHERE request_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS app_logs (
    id BIGSERIAL PRIMARY KEY,
    logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    level VARCHAR(16) NOT NULL,
    owner VARCHAR(32) NOT NULL,
    code INTEGER NOT NULL,
    message TEXT NOT NULL,
    file_path TEXT NULL,
    context JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_app_logs_logged_at ON app_logs (logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs (level);
CREATE INDEX IF NOT EXISTS idx_app_logs_owner ON app_logs (owner);
CREATE INDEX IF NOT EXISTS idx_app_logs_code ON app_logs (code);

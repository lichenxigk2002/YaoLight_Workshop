CREATE TABLE IF NOT EXISTS mcp_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    token_prefix VARCHAR(40) NOT NULL,
    scopes JSONB NOT NULL DEFAULT '[]',
    expires_at TIMESTAMP,
    last_used_at TIMESTAMP,
    last_used_ip VARCHAR(45),
    revoked_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user_id ON mcp_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_token_prefix ON mcp_tokens(token_prefix);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_expires_at ON mcp_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_mcp_tokens_revoked_at ON mcp_tokens(revoked_at);

CREATE TABLE IF NOT EXISTS mcp_call_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id BIGINT REFERENCES mcp_tokens(id) ON DELETE SET NULL,
    tool_name VARCHAR(120) NOT NULL,
    request_summary TEXT,
    resource_type VARCHAR(80),
    resource_id VARCHAR(120),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    latency_ms BIGINT NOT NULL DEFAULT 0,
    ip VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_user_id ON mcp_call_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_token_id ON mcp_call_logs(token_id);
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_tool_name ON mcp_call_logs(tool_name);
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_status ON mcp_call_logs(status);
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_resource ON mcp_call_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_mcp_call_logs_created_at ON mcp_call_logs(created_at);

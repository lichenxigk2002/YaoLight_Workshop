CREATE TABLE IF NOT EXISTS workflow_api_endpoints (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    project_id BIGINT NULL,
    workflow_id BIGINT NOT NULL,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    description TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    response_mode VARCHAR(20) NOT NULL DEFAULT 'wait',
    result_mode VARCHAR(20) NOT NULL DEFAULT 'json',
    wait_timeout_seconds INTEGER NOT NULL DEFAULT 15,
    request_example JSONB NULL,
    response_example JSONB NULL,
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_api_endpoints_workflow_id
    ON workflow_api_endpoints(workflow_id)
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_api_endpoints_slug
    ON workflow_api_endpoints(slug)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_api_endpoints_user_id
    ON workflow_api_endpoints(user_id);

CREATE TABLE IF NOT EXISTS workflow_api_keys (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id BIGINT NOT NULL,
    name VARCHAR(120) NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    expires_at TIMESTAMPTZ NULL,
    last_used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_api_keys_endpoint_id
    ON workflow_api_keys(endpoint_id);

CREATE INDEX IF NOT EXISTS idx_workflow_api_keys_key_prefix
    ON workflow_api_keys(key_prefix);

CREATE TABLE IF NOT EXISTS workflow_api_invocations (
    id BIGSERIAL PRIMARY KEY,
    endpoint_id BIGINT NOT NULL,
    api_key_id BIGINT NULL,
    task_id BIGINT NULL,
    request_id VARCHAR(80) NOT NULL,
    status VARCHAR(20) NOT NULL,
    request_body JSONB NULL,
    response_snapshot JSONB NULL,
    error_message TEXT NULL,
    client_ip VARCHAR(64) NULL,
    user_agent TEXT NULL,
    started_at TIMESTAMPTZ NULL,
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_api_invocations_request_id
    ON workflow_api_invocations(request_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workflow_api_invocations_endpoint_id
    ON workflow_api_invocations(endpoint_id);

CREATE INDEX IF NOT EXISTS idx_workflow_api_invocations_task_id
    ON workflow_api_invocations(task_id);

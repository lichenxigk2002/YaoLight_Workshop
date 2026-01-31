-- 009_add_user_oauth_bindings.sql
-- 用户第三方账号绑定表（一个用户可同时绑定 GitHub、Google 等）

CREATE TABLE IF NOT EXISTS user_oauth_bindings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    provider VARCHAR(20) NOT NULL,
    oauth_id VARCHAR(100) NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW()) * 1000),
    deleted_at TIMESTAMP,
    CONSTRAINT idx_user_provider UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_bindings_user_id ON user_oauth_bindings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_oauth_bindings_deleted_at ON user_oauth_bindings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_user_oauth_bindings_provider_oauth_id ON user_oauth_bindings(provider, oauth_id);

COMMENT ON TABLE user_oauth_bindings IS '用户与第三方账号绑定（支持多平台同时绑定）';

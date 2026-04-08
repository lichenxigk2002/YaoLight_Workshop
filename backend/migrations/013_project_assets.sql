-- 013_project_assets.sql
-- 项目知识 / 网站源基础结构

BEGIN;

ALTER TABLE alkaid_knowledge
    ADD COLUMN IF NOT EXISTS project_id INTEGER,
    ADD COLUMN IF NOT EXISTS workflow_id INTEGER,
    ADD COLUMN IF NOT EXISTS source_type VARCHAR(20) NOT NULL DEFAULT 'system';

CREATE INDEX IF NOT EXISTS idx_alkaid_knowledge_project_id ON alkaid_knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_alkaid_knowledge_workflow_id ON alkaid_knowledge(workflow_id);
CREATE INDEX IF NOT EXISTS idx_alkaid_knowledge_source_type ON alkaid_knowledge(source_type);
CREATE INDEX IF NOT EXISTS idx_alkaid_knowledge_user_project ON alkaid_knowledge(user_id, project_id);

UPDATE alkaid_knowledge
SET source_type = CASE
    WHEN workflow_id IS NOT NULL THEN 'workflow'
    WHEN project_id IS NOT NULL THEN 'project'
    WHEN user_id IS NULL THEN 'system'
    ELSE 'user'
END
WHERE source_type IS NULL
   OR source_type = '';

CREATE TABLE IF NOT EXISTS project_website_sources (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    entry_url VARCHAR(500),
    list_url_examples JSONB NOT NULL DEFAULT '[]',
    detail_url_examples JSONB NOT NULL DEFAULT '[]',
    allowed_patterns JSONB NOT NULL DEFAULT '[]',
    blocked_patterns JSONB NOT NULL DEFAULT '[]',
    crawl_tips TEXT,
    auth_hint TEXT,
    content_hint TEXT,
    tags JSONB NOT NULL DEFAULT '[]',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'invalid')),
    last_checked_at TIMESTAMP,
    last_check_status VARCHAR(20),
    last_check_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_website_sources_user_id ON project_website_sources(user_id);
CREATE INDEX IF NOT EXISTS idx_project_website_sources_project_id ON project_website_sources(project_id);
CREATE INDEX IF NOT EXISTS idx_project_website_sources_status ON project_website_sources(status);
CREATE INDEX IF NOT EXISTS idx_project_website_sources_deleted_at ON project_website_sources(deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_website_sources_user_project ON project_website_sources(user_id, project_id);

COMMIT;

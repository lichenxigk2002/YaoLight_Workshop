ALTER TABLE resource_comments
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'visible',
    ADD COLUMN IF NOT EXISTS moderation_reason TEXT NULL,
    ADD COLUMN IF NOT EXISTS moderated_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMP NULL;

CREATE INDEX IF NOT EXISTS idx_resource_comments_status
    ON resource_comments (status)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS resource_likes (
    id BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(80) NOT NULL,
    resource_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_likes_unique_active
    ON resource_likes (resource_type, resource_id, user_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resource_likes_resource
    ON resource_likes (resource_type, resource_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS resource_comments (
    id BIGSERIAL PRIMARY KEY,
    resource_type VARCHAR(80) NOT NULL,
    resource_id BIGINT NOT NULL,
    parent_id BIGINT NULL REFERENCES resource_comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    location VARCHAR(120) NULL,
    device_model VARCHAR(160) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE INDEX IF NOT EXISTS idx_resource_comments_resource
    ON resource_comments (resource_type, resource_id, created_at)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_resource_comments_parent
    ON resource_comments (parent_id)
    WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS comment_reactions (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL REFERENCES resource_comments(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_comment_reactions_unique_active
    ON comment_reactions (comment_id, user_id, emoji)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment
    ON comment_reactions (comment_id)
    WHERE deleted_at IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resource_likes_user') THEN
        ALTER TABLE resource_likes
            ADD CONSTRAINT fk_resource_likes_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resource_comments_user') THEN
        ALTER TABLE resource_comments
            ADD CONSTRAINT fk_resource_comments_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_resource_comments_parent') THEN
        ALTER TABLE resource_comments
            ADD CONSTRAINT fk_resource_comments_parent
            FOREIGN KEY (parent_id) REFERENCES resource_comments(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comment_reactions_comment') THEN
        ALTER TABLE comment_reactions
            ADD CONSTRAINT fk_comment_reactions_comment
            FOREIGN KEY (comment_id) REFERENCES resource_comments(id) ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_comment_reactions_user') THEN
        ALTER TABLE comment_reactions
            ADD CONSTRAINT fk_comment_reactions_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

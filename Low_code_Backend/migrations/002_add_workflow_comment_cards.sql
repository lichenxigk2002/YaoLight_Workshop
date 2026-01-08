-- 添加工作流注释卡片表
CREATE TABLE IF NOT EXISTS workflow_comment_cards (
    id BIGSERIAL PRIMARY KEY,
    workflow_id BIGINT NOT NULL,
    card_id VARCHAR(100) NOT NULL,
    position JSONB DEFAULT '{"x":0,"y":0}',
    text TEXT,
    color VARCHAR(20) DEFAULT '#fffacd',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_comment_cards_workflow_id ON workflow_comment_cards(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_comment_cards_card_id ON workflow_comment_cards(card_id);


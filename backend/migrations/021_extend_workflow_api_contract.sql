ALTER TABLE workflow_api_endpoints
    ADD COLUMN IF NOT EXISTS request_schema JSONB NULL,
    ADD COLUMN IF NOT EXISTS input_mapping JSONB NULL,
    ADD COLUMN IF NOT EXISTS response_schema JSONB NULL,
    ADD COLUMN IF NOT EXISTS output_mapping JSONB NULL,
    ADD COLUMN IF NOT EXISTS expose_artifacts VARCHAR(20) NOT NULL DEFAULT 'all',
    ADD COLUMN IF NOT EXISTS exposed_artifact_ids JSONB NULL;

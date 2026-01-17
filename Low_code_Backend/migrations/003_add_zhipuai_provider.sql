-- 添加智谱AI GLM 到 ai_models 表的 provider 约束
-- 创建日期: 2026-01-16

-- 删除旧的 provider check 约束
ALTER TABLE ai_models DROP CONSTRAINT IF EXISTS ai_models_provider_check;

-- 添加新的 provider check 约束（包含 zhipuai）
ALTER TABLE ai_models
ADD CONSTRAINT ai_models_provider_check
CHECK (provider IN ('openai','azure','anthropic','google','custom','deepseek','doubao','qianwen','zhipuai'));


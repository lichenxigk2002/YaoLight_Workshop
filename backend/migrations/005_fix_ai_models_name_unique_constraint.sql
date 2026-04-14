-- 005_fix_ai_models_name_unique_constraint.sql
-- 修复 ai_models 表的唯一约束：从全局唯一改为按用户唯一
-- 允许不同用户创建相同名称的模型，但同一用户不能创建重复名称的模型
-- 重要：只对未删除的记录应用唯一约束，允许删除后重新创建同名模型

-- 1. 删除旧的唯一索引（如果存在）
DROP INDEX IF EXISTS idx_ai_models_name;
DROP INDEX IF EXISTS idx_name_user;

-- 2. 创建新的复合唯一索引（name + created_by）
-- 关键：使用部分索引，只对未删除的记录（deleted_at IS NULL）应用唯一约束
-- 这样删除模型后可以重新创建同名模型
CREATE UNIQUE INDEX idx_name_user 
ON ai_models (name, created_by) 
WHERE created_by IS NOT NULL AND deleted_at IS NULL;

-- 说明：
-- - 使用部分索引（WHERE 子句）确保只对有效记录应用唯一约束
-- - 包含 deleted_at IS NULL 确保软删除的记录不参与唯一性检查
-- - 允许不同用户创建相同名称的模型
-- - 同一用户不能创建重复名称的模型（除非之前的记录被软删除）
-- - 删除模型后可以重新创建同名模型


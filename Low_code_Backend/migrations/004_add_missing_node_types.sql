-- 1. 更新约束，允许新的 category
-- 注意：GORM 自动生成的约束名通常是 chk_node_types_category
ALTER TABLE node_types DROP CONSTRAINT IF EXISTS chk_node_types_category;
ALTER TABLE node_types DROP CONSTRAINT IF EXISTS node_types_category_check;

ALTER TABLE node_types ADD CONSTRAINT chk_node_types_category 
CHECK (category IN ('crawler','ai','output','condition','transform','start','end','dataclean','loop','merge','delay','custom'));

-- 2. 插入缺失的节点
INSERT INTO node_types (name, category, icon, color, is_system, is_active, version, config_schema, default_config, created_at, updated_at)
VALUES 
('数据清洗节点', 'dataclean', 'ClearOutlined', '#52c41a', true, true, '1.0.0', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('条件分支节点', 'condition', 'BranchesOutlined', '#faad14', true, true, '1.0.0', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('数据转换节点', 'transform', 'SwapOutlined', '#13c2c2', true, true, '1.0.0', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('循环处理节点', 'loop', 'ReloadOutlined', '#eb2f96', true, true, '1.0.0', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('合并分支节点', 'merge', 'MergeCellsOutlined', '#2f54eb', true, true, '1.0.0', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('延迟等待节点', 'delay', 'ClockCircleOutlined', '#fa8c16', true, true, '1.0.0', '{}', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (name) DO UPDATE SET
    category = EXCLUDED.category,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    updated_at = CURRENT_TIMESTAMP;

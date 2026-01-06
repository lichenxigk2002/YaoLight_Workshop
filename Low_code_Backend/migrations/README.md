# 数据库迁移说明

## 当前迁移方式

本项目使用 **GORM AutoMigrate** 自动迁移，启动时会自动根据模型定义创建/更新表结构。

### 工作原理

1. **启动时自动执行**：在 `database.InitDatabase()` 中调用 `AutoMigrate()`
2. **自动创建表**：如果表不存在，会自动创建
3. **自动更新字段**：如果模型有新增字段，会自动添加（不会删除字段）
4. **自动创建索引**：根据模型标签自动创建索引

### 迁移的表

按依赖顺序迁移：

**基础表（无外键依赖）**：
- `users` - 用户表
- `node_types` - 节点类型表
- `system_configs` - 系统配置表
- `statistics` - 统计表

**依赖 User 的表**：
- `projects` - 项目表
- `workflows` - 工作流表
- `crawler_rules` - 爬虫规则表
- `ai_models` - AI模型表
- `tasks` - 任务表
- `task_schedules` - 任务调度表
- `files` - 文件表
- `notifications` - 通知表
- `operation_logs` - 操作日志表

**依赖 Workflow 的表**：
- `workflow_nodes` - 工作流节点表
- `workflow_versions` - 工作流版本表

**依赖 Task 的表**：
- `task_node_executions` - 任务节点执行表
- `task_logs` - 任务日志表

## 使用方式

### 启动服务自动迁移

```bash
cd Low_code_Backend
go run cmd/server/main.go
```

启动时会看到：
```
✅ Database connected successfully
🔄 Starting database migration...
✅ Database migration completed successfully
```

### 注意事项

1. **首次启动**：会自动创建所有表
2. **后续启动**：只会添加新字段，不会删除字段
3. **生产环境**：建议使用专门的迁移工具（如 golang-migrate）进行更精确的控制

## SQL 迁移文件（参考）

如果需要手动执行 SQL，可以参考以下 SQL 文件（仅作为参考，实际使用 AutoMigrate）：

- `001_create_users.sql` - 创建用户表
- `002_create_projects.sql` - 创建项目表
- `003_create_workflows.sql` - 创建工作流表
- ... 等等

## 默认数据

启动时会自动初始化默认数据：
- 节点类型（开始节点、爬虫节点、AI节点、输出节点、结束节点）

如果数据库中已有数据，会跳过默认数据初始化。


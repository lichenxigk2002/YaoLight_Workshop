# 数据库迁移说明

## 当前迁移方式

本项目使用两段式迁移：

1. **GORM AutoMigrate**：自动创建/补齐模型表结构
2. **versioned SQL migrations**：执行 `migrations/*.sql` 并记录到 `schema_migrations`

### 工作原理

1. **启动时自动执行**：在 `database.InitDatabase()` 中先调用 `AutoMigrate()`，再执行 SQL migrations
2. **自动创建表**：如果表不存在，会自动创建
3. **自动更新字段**：如果模型有新增字段，会自动添加（不会删除字段）
4. **自动创建索引**：根据模型标签自动创建索引
5. **版本记录**：每个 `.sql` 文件会按版本号顺序执行，并写入 `schema_migrations`

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
cd backend
go run cmd/server/main.go
```

启动时会看到：
```
✅ Database connected successfully
🔄 Starting database migration...
✅ Applied SQL migration 006_insert_alkaid_knowledge.sql
✅ Database migration completed
```

### 注意事项

1. **首次启动**：会自动创建所有表
2. **后续启动**：只会添加新字段，不会删除字段
3. **生产环境**：建议使用专门的迁移工具（如 golang-migrate）进行更精确的控制

## SQL 迁移文件

SQL migration 会自动执行；只有在需要人工排障时，才建议手动执行这些文件：

- `001_initial_schema.sql` - 初始表结构补充
- `002_add_workflow_comment_cards.sql` - 工作流注释卡片
- `003_add_zhipuai_provider.sql` - AI provider 约束补充
- `...`

## schema_migrations

系统会创建 `schema_migrations` 表记录：
- `version`
- `name`
- `checksum`
- `executed_at`

如果同版本 migration 文件内容被修改，启动时会直接报错，防止历史迁移被静默篡改。

## 默认数据

启动时会自动初始化默认数据：
- 节点类型（开始节点、爬虫节点、AI节点、输出节点、结束节点）

如果数据库中已有数据，会跳过默认数据初始化。


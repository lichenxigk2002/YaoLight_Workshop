# 瑶光星（Alkaid）当前文档入口

本目录只保留**当前有效**的瑶光星技术文档。

如果你的目标是继续做这一轮新版产品改造，默认按下面顺序阅读：

- [00-ALKaid-Product-Requirements.md](./00-ALKaid-Product-Requirements.md)
- [01-ALKaid-Technical-Architecture.md](./01-ALKaid-Technical-Architecture.md)
- [02-ALKaid-Implementation-Plan.md](./02-ALKaid-Implementation-Plan.md)

## 阅读规则

1. 先读产品需求文档。
2. 再读技术架构文档。
3. 再按实施计划开工。
4. 旧版迭代文档默认不要参与当前方案讨论。
5. 只有在需要追溯历史实现、排查兼容性或复用旧模块时，才进入 `archive/` 查阅。

## 目录说明

### 当前有效

- [00-ALKaid-Product-Requirements.md](./00-ALKaid-Product-Requirements.md)
  说明：当前产品版本的需求文档，定义产品定位、任务模式、边界、亮点与成功标准。

- [01-ALKaid-Technical-Architecture.md](./01-ALKaid-Technical-Architecture.md)
  说明：基于当前产品目标的技术架构文档，定义模块结构、文件职责、工具分层、复用策略、删除策略与实施顺序。

- [02-ALKaid-Implementation-Plan.md](./02-ALKaid-Implementation-Plan.md)
  说明：按阶段拆解的实施计划，明确每个阶段改哪些文件、每个文件做什么、兼容策略和验收标准。

- [03-ALKaid-Data-And-Protocol.md](./03-ALKaid-Data-And-Protocol.md)
  说明：预留的数据与协议文档入口，用于后续沉淀 SSE、artifact、report、apply/discard 等字段约定。

### 历史归档

- [archive/README.md](./archive/README.md)
  说明：旧版产品迭代文档、阶段性实现说明、总结与检查清单的归档入口。默认跳过。

## 当前文档约束

后续新增与瑶光星相关的设计文档，默认遵循以下规则：

1. 当前有效文档放在 `docs/` 根目录。
2. 被新方案替代的旧文档移入 `docs/archive/`。
3. 根目录不再堆叠多轮历史方案，避免阅读时混淆主线。

package database

import (
	"fmt"

	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/shared"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
)

// SeedAlkaidOutputNodeKnowledge 将“输出节点新导出能力/Artifacts/导出API/图表与Mermaid结构”写入瑶光星知识库
// 说明：
// - 项目当前主要依赖 GORM AutoMigrate；migrations/*.sql 多为参考文件，不会在启动时自动执行
// - 为了确保启动后瑶光星能检索到“新增能力”，这里用 seed 的方式做幂等写入
func SeedAlkaidOutputNodeKnowledge() error {
	if DB == nil {
		return fmt.Errorf("database not initialized")
	}

	// 1) 旧版输出节点知识置为不激活（避免检索到过期内容）
	DB.Model(&alkaidModels.AlkaidKnowledge{}).
		Where("user_id IS NULL AND category = ? AND target = ? AND title = ? AND is_active = ?",
			"node_usage", "output", "输出节点使用说明", true).
		Update("is_active", false)

	// 2) 写入/更新新版知识条目
	seeds := []alkaidModels.AlkaidKnowledge{
		{
			UserID:   nil,
			Category: "node_usage",
			Target:   "output",
			Title:    "输出节点（导出/制品Artifacts/导出API）使用说明",
			Content: `输出节点用于把上游结果导出为文件/图表，并统一落为制品（artifacts），支持站内预览/下载与对外导出 API。

一、核心概念：Artifacts（制品）
- 输出节点每次导出会生成 1~N 个 artifact（文件/图表/文本等）
- artifact 会落库并保存文件（当前为本地存储）
- 前端执行结果面板会展示 artifacts，支持下载；部分类型支持站内预览（text/markdown/json/svg）

二、配置字段（Output 节点 config）
1) format（导出格式，决定使用哪个导出 provider）
支持：
- json
- markdown / md
- text / txt
- pdf
- docx / word
- mermaid
- timeline（Mermaid timeline）
- sankey（Mermaid sankey-beta）
- network（Mermaid flowchart 网络关系图）
- chart / chart_svg（SVG 图表，见下文 chart.type）

2) destination（导出目标，当前版本都生成 artifacts；区别在于“对外检索方式”）
- file：站内下载/预览（默认）
- api：对外导出 API（外部系统通过任务产物接口获取）

注意：destination=api 依赖 TaskID（需要任务已创建）。若任务未创建成功，会提示无法使用导出API。

3) fileName（可选）
- 仅在“导出只生成一个文件”时生效；不填则使用默认文件名。

4) chartType / chartTitle（仅当 format=chart 时前端可配置）
- chartType：line/bar/scatter/histogram/heatmap/pie
- chartTitle：可选标题
后端会自动把上游输出包装为 chart 输入结构（见下面 chart 输入说明）。

三、对外导出 API（JWT 保护）
1) 列出某次任务的所有 artifacts：
GET /api/tasks/:id/artifacts

2) 查看 artifact 元信息：
GET /api/artifacts/:id

3) 下载 artifact 文件：
GET /api/artifacts/:id/download

四、输出节点执行结果（NodeExecutionResult.data）
典型字段：
- format / destination
- artifacts: [ { id, name, kind, mimeType, size, downloadUrl } ]
- taskId / workflowId
并保留 data（便于站内调试/预览）。`,
			Tags:     shared.JSONB{Data: []string{"输出节点", "导出", "PDF", "DOCX", "Mermaid", "SVG图表", "Artifacts", "制品", "导出API", "任务产物"}},
			IsActive: true,
		},
		{
			UserID:   nil,
			Category: "best_practice",
			Target:   "output",
			Title:    "SVG 图表（chart）输入结构与示例",
			Content: `当 format=chart 时，导出 provider 期望的输入为对象：
{
  "type": "scatter|pie|line|bar|histogram|heatmap",
  "title": "可选标题",
  "data": { ... }
}

如果你在前端配置了 chartType（line/bar/...）且上游输出不是上述结构，后端会自动包装为：
{ "type": chartType, "title": chartTitle, "data": 上游payload }
因此上游 payload 通常只要提供 data 结构即可。

1) scatter（散点）
data:
{
  "points": [ { "x": 1, "y": 2, "label": "A" } ]
}

2) pie（饼图）
data:
{
  "items": [ { "label": "A", "value": 10 } ]
}

3) line（折线，多序列）
data:
{
  "series": [
    { "name": "S1", "points": [ { "x": 1, "y": 2 }, { "x": 2, "y": 3 } ] }
  ]
}

4) bar（柱状，多序列）
data:
{
  "categories": ["A","B","C"],
  "series": [
    { "name": "S1", "values": [1,2,3] },
    { "name": "S2", "values": [2,1,4] }
  ]
}

5) histogram（直方）
data:
{
  "values": [1,2,3,4,5],
  "binCount": 10
}

6) heatmap（热力矩阵）
data:
{
  "xLabels": ["X1","X2"],
  "yLabels": ["Y1","Y2"],
  "values": [
    [0.1, 0.6],
    [0.2, 0.9]
  ]
}

提示：建议让 AI 节点输出 JSON（严格结构）以便 chart 导出稳定。`,
			Tags:     shared.JSONB{Data: []string{"图表", "SVG", "chart", "散点图", "饼图", "折线图", "柱状图", "直方图", "热力图", "结构化输出", "AI节点"}},
			IsActive: true,
		},
		{
			UserID:   nil,
			Category: "best_practice",
			Target:   "output",
			Title:    "Mermaid（timeline/sankey/network）输入结构与示例",
			Content: `当 format 为 mermaid/timeline/sankey/network 时，输出节点会生成 .mmd 源码文件，并同时生成带 mermaid 代码块的 .md 便于站内预览。

1) mermaid（通用）
输入一般为 string（mermaid 源码），例如：
flowchart LR
  A-->B

2) timeline（时间线，Mermaid timeline）
输入：
{
  "title": "可选标题",
  "events": [
    { "date": "1911-10-10", "label": "武昌起义", "group": "中国近代史" }
  ]
}

3) sankey（流向图，Mermaid sankey-beta）
输入：
{
  "title": "可选标题",
  "flows": [
    { "from": "A", "to": "B", "value": 10 },
    { "from": "B", "to": "C", "value": 5 }
  ]
}

4) network（关系网络，Mermaid flowchart）
输入：
{
  "direction": "LR|TB（默认 LR）",
  "edges": [
    { "from": "人物A", "to": "事件B", "label": "参与" }
  ]
}`,
			Tags:     shared.JSONB{Data: []string{"Mermaid", "timeline", "sankey", "network", "关系图", "流程图", "时间线", "流向图"}},
			IsActive: true,
		},
		{
			UserID:   nil,
			Category: "scene_template",
			Target:   "output",
			Title:    "场景模板：AI 生成图表数据并导出 SVG（chart）",
			Content: `目标：把爬虫/数据清洗/业务数据通过 AI 节点整理为 chart.data 结构，再由输出节点导出 SVG 图表（artifact）。

推荐链路：
开始(start) →（爬虫/数据源）→ 数据清洗(dataclean) → AI(ai) → 输出(output)

AI 节点输出建议：
- 输出严格 JSON
- 字段结构匹配 chart.type 对应的 data（见“SVG 图表（chart）输入结构与示例”知识条目）

输出节点配置建议：
- 一级类目选择「可视化图表（SVG）」
- 选择图表类型（chartType）：line/bar/scatter/histogram/heatmap/pie
- destination：file（站内）或 api（对外）

若 destination=api：
- 需要 TaskID（任务已创建）
- 外部系统可通过 GET /api/tasks/:id/artifacts 查询并下载 /api/artifacts/:id/download`,
			Tags:     shared.JSONB{Data: []string{"场景模板", "chart", "SVG", "AI生成JSON", "输出节点", "Artifacts", "导出API"}},
			IsActive: true,
		},
	}

	for _, k := range seeds {
		var existing alkaidModels.AlkaidKnowledge
		err := DB.Where("user_id IS NULL AND category = ? AND target = ? AND title = ?", k.Category, k.Target, k.Title).
			First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			if err := DB.Create(&k).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		if err := DB.Model(&existing).Updates(map[string]interface{}{
			"content":   k.Content,
			"tags":      k.Tags,
			"is_active": true,
			"category":  k.Category,
			"target":    k.Target,
		}).Error; err != nil {
			return err
		}
	}

	return nil
}

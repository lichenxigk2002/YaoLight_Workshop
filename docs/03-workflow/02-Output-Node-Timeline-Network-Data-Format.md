# 输出节点：图表数据格式与生成文件类型

## 一、各格式生成的文件类型（都不是 PNG）

输出节点**不会生成 PNG 位图**，生成的都是**文本/矢量/文档**，便于预览、下载和二次编辑：

| 格式 | 生成文件 | 说明 |
|------|----------|------|
| **json** | `output.json` | JSON 文本 |
| **markdown / md** | `output.md` | Markdown 文本 |
| **text / txt** | `output.txt` | 纯文本 |
| **pdf** | `output.pdf` | PDF 文档 |
| **docx / word** | `output.docx` | Word 文档 |
| **mermaid** | `diagram.mmd` + `diagram.md` | Mermaid 源码 + 带代码块的 Markdown（用于站内预览） |
| **timeline** | `timeline.mmd` + `timeline.md` | Mermaid 时间线源码 + Markdown |
| **sankey** | `sankey.mmd` + `sankey.md` | Mermaid 桑基图源码 + Markdown |
| **network** | `network.mmd` + `network.md` | Mermaid 关系网络图源码 + Markdown |
| **chart** | `chart_*.svg` + `chart_*.png` | **SVG 矢量图** + **PNG 位图**（如 chart_scatter.svg / chart_scatter.png，可直接下载 PNG） |

- **Mermaid 类**（timeline / network / sankey / mermaid）：生成 `.mmd` 源码和 `.md`，前端用 Mermaid 引擎在浏览器里**渲染成图**，不是导出成图片文件。
- **Chart**：生成 **SVG** 的同时会**自动转成 PNG**，结果里会多一个同名的 `.png` 文件，可直接下载位图。

---

## 二、Timeline / Network / Sankey 所需数据格式

当输出节点选择 **Timeline**、**Network** 或 **Sankey** 时，上游需提供对应结构的 JSON。后端会在整棵 payload 中**深度查找** `events` / `edges` / `flows`，因此只要数据在任意嵌套层或 `result`/`content` 的 JSON 字符串里，都能被自动找到并用于生成。

---

## 1. Timeline（时间线）

**后端要求**（见 `timeline_provider.go`）：

- 输入必须是一个 **对象**（不能是纯字符串或数组）。
- 必须包含 **`events`** 数组，且至少有一条有效事件。
- 每条事件为对象，**必填**：`date`、`label`；**可选**：`group`（用于分组 section）。
- 顶层 **可选**：`title`（时间线标题）。

### 正确示例

```json
{
  "title": "中国近代史",
  "events": [
    { "date": "1911-10-10", "label": "武昌起义", "group": "辛亥革命" },
    { "date": "1912-01-01", "label": "中华民国成立", "group": "辛亥革命" },
    { "date": "1921-07-23", "label": "中共一大", "group": "建党" }
  ]
}
```

- `date`：日期字符串，支持 `2006-01-02`、`2006/01/02`、`2006-01`、`2006` 等格式。
- `label`：该时间点显示的文字。
- `group`：不填时后端会归到「事件」分组。

### 常见问题

- **上游是 AI 节点**：AI 常输出 `{ "content": "...", "result": "..." }`，其中 `result` 是 JSON 字符串。  
  后端已做兼容：会从 `result`、`content`、`data` 中尝试解析 JSON；若解析后的对象带有 `events` 数组，会用作 timeline 输入。  
  因此只要让 AI 在 `result` 里返回上述结构的 JSON 字符串（可带 ```json 代码块）即可。

---

## 2. Network（关系网络图）

**后端要求**（见 `network_provider.go`）：

- 输入必须是一个 **对象**。
- 必须包含 **`edges`** 数组，且至少有一条有效边。
- 每条边为对象，**必填**：`from`、`to`；**可选**：`label`（边上显示的文字）。
- 顶层 **可选**：`direction`，`"LR"`（左右，默认）或 `"TB"`（上下）。

### 正确示例

```json
{
  "direction": "LR",
  "edges": [
    { "from": "人物A", "to": "事件B", "label": "参与" },
    { "from": "人物A", "to": "地点C", "label": "出生地" },
    { "from": "事件B", "to": "地点C" }
  ]
}
```

- `from` / `to`：节点名称（字符串），会出现在图中；含空格或特殊字符时后端会自动加引号。
- `label`：边的说明文字；不填则只显示箭头。

### 常见问题

- **上游是 AI 节点**：同样会从 `result`、`content`、`data` 中解析 JSON；若解析后的对象带有 `edges` 数组，会用作 network 输入。

---

## 3. Sankey（桑基 / 流向图）

**后端要求**（见 `sankey_provider.go`）：

- 输入必须是一个 **对象**。
- 必须包含 **`flows`** 数组，且至少有一条有效流。
- 每条流为对象，**必填**：`from`、`to`、`value`（数值）。
- 顶层 **可选**：`title`。

### 正确示例

```json
{
  "title": "能源流向",
  "flows": [
    { "from": "A", "to": "B", "value": 10 },
    { "from": "B", "to": "C", "value": 5 }
  ]
}
```

与 timeline/network 一样，**深度查找**会从整棵 payload 中自动找到含 `flows` 的有效对象（包括嵌套或 JSON 字符串）。

---

## 4. 小结

| 格式     | 必须字段     | 可选字段    | 生成文件 |
|----------|--------------|-------------|----------|
| timeline | `events[]`   | `title`     | .mmd + .md |
| network  | `edges[]`    | `direction` | .mmd + .md |
| sankey   | `flows[]`    | `title`     | .mmd + .md |

若上游直接输出**满足上述结构的对象**，或 AI 在 **`result`/`content`** 中输出该结构的 **JSON 字符串**（可带 markdown 代码块），或数据在任意嵌套层，输出节点都会**自动找到**并正确生成对应图表。

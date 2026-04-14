package export

import (
	"fmt"
	"strings"
)

// networkProvider 将“关系网络”导出为 Mermaid flowchart
// 输入：
// {
//   "direction": "LR" | "TB" (默认 LR),
//   "edges": [
//     { "from": "人物A", "to": "事件B", "label": "参与" }
//   ]
// }
type networkProvider struct{}

func (p *networkProvider) Name() string { return "network" }

func (p *networkProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	m, ok := input.(map[string]interface{})
	if !ok || m == nil {
		return nil, fmt.Errorf("network 需要对象输入（edges）")
	}
	dir, _ := m["direction"].(string)
	dir = strings.ToUpper(strings.TrimSpace(dir))
	if dir == "" {
		dir = "LR"
	}
	edgesAny, _ := m["edges"].([]interface{})
	if len(edgesAny) == 0 {
		return nil, fmt.Errorf("network.edges 为空")
	}

	var b strings.Builder
	b.WriteString(fmt.Sprintf("flowchart %s\n", dir))
	valid := 0
	for _, it := range edgesAny {
		em, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		from, _ := em["from"].(string)
		to, _ := em["to"].(string)
		lbl, _ := em["label"].(string)
		from = strings.TrimSpace(from)
		to = strings.TrimSpace(to)
		lbl = strings.TrimSpace(lbl)
		if from == "" || to == "" {
			continue
		}
		// 使用圆角节点 (…) 避免 Mermaid 11 对 -->|label| ["..."] 中 "[" 的解析错误（SQS）
		fromQ := quoteMermaidNodeRound(from)
		toQ := quoteMermaidNodeRound(to)
		if lbl != "" {
			b.WriteString(fmt.Sprintf("  %s -->|%s| %s\n", fromQ, escapeMermaidLabel(lbl), toQ))
		} else {
			b.WriteString(fmt.Sprintf("  %s --> %s\n", fromQ, toQ))
		}
		valid++
	}
	if valid == 0 {
		return nil, fmt.Errorf("network.edges 无有效数据（需要 from/to）")
	}

	mmd := b.String()
	md := fmt.Sprintf("```mermaid\n%s\n```\n", mmd)
	return []File{
		{Name: "network.mmd", Kind: "mermaid", MimeType: "text/plain; charset=utf-8", Bytes: []byte(mmd)},
		{Name: "network.md", Kind: "markdown", MimeType: "text/markdown; charset=utf-8", Bytes: []byte(md)},
	}, nil
}

// quoteMermaidNodeRound 用圆角节点 (…) 包裹，避免 Mermaid 11 解析 flowchart -->|label| ["..."] 时报 SQS
func quoteMermaidNodeRound(s string) string {
	// 节点内括号会破坏语法，转成 HTML 实体
	s = strings.ReplaceAll(s, "(", "&#40;")
	s = strings.ReplaceAll(s, ")", "&#41;")
	s = strings.ReplaceAll(s, "[", "&#91;")
	s = strings.ReplaceAll(s, "]", "&#93;")
	s = strings.ReplaceAll(s, "\"", "&#34;")
	return "(" + s + ")"
}

func escapeMermaidLabel(s string) string {
	// label 内简单转义竖线
	return strings.ReplaceAll(s, "|", "/")
}

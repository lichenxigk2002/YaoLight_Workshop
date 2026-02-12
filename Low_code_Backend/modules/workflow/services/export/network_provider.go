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
		// Mermaid 对节点名较宽松，但含空格时建议加引号
		fromQ := quoteMermaidNode(from)
		toQ := quoteMermaidNode(to)
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

func quoteMermaidNode(s string) string {
	// 用 ["..."] 形式避免空格与特殊字符问题
	return fmt.Sprintf(`["%s"]`, strings.ReplaceAll(s, `"`, `\"`))
}

func escapeMermaidLabel(s string) string {
	// label 内简单转义竖线
	return strings.ReplaceAll(s, "|", "/")
}

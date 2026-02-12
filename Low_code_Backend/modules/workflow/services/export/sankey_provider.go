package export

import (
	"fmt"
	"strings"
)

// sankeyProvider 将“流向数据”导出为 Mermaid sankey-beta
// 输入：
// {
//   "title": "xxx(可选，仅用于文件名/说明)",
//   "flows": [
//     { "from": "A", "to": "B", "value": 10 },
//     { "from": "B", "to": "C", "value": 5 }
//   ]
// }
type sankeyProvider struct{}

func (p *sankeyProvider) Name() string { return "sankey" }

func (p *sankeyProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	m, ok := input.(map[string]interface{})
	if !ok || m == nil {
		return nil, fmt.Errorf("sankey 需要对象输入（flows）")
	}
	flowsAny, _ := m["flows"].([]interface{})
	if len(flowsAny) == 0 {
		return nil, fmt.Errorf("sankey.flows 为空")
	}

	var b strings.Builder
	b.WriteString("sankey-beta\n")
	valid := 0
	for _, it := range flowsAny {
		fm, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		from, _ := fm["from"].(string)
		to, _ := fm["to"].(string)
		val, okV := toFloat(fm["value"])
		from = strings.TrimSpace(from)
		to = strings.TrimSpace(to)
		if from == "" || to == "" || !okV {
			continue
		}
		b.WriteString(fmt.Sprintf("%s,%s,%.0f\n", from, to, val))
		valid++
	}
	if valid == 0 {
		return nil, fmt.Errorf("sankey.flows 无有效数据（需要 from/to/value）")
	}

	mmd := b.String()
	md := fmt.Sprintf("```mermaid\n%s\n```\n", mmd)

	return []File{
		{Name: "sankey.mmd", Kind: "mermaid", MimeType: "text/plain; charset=utf-8", Bytes: []byte(mmd)},
		{Name: "sankey.md", Kind: "markdown", MimeType: "text/markdown; charset=utf-8", Bytes: []byte(md)},
	}, nil
}

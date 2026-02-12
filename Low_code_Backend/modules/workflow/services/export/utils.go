package export

import (
	"encoding/json"
	"fmt"
	"strings"
)

// ToPrettyText 将任意输入转换为适合导出（pdf/docx 等）的文本
func ToPrettyText(input interface{}) (string, error) {
	switch v := input.(type) {
	case nil:
		return "", nil
	case string:
		return v, nil
	case []byte:
		return string(v), nil
	case map[string]interface{}:
		// 常见字段优先（对齐工作流/AI节点输出结构）
		for _, k := range []string{"content", "result", "text", "markdown", "md"} {
			if vv, ok := v[k]; ok {
				if s, ok := vv.(string); ok && strings.TrimSpace(s) != "" {
					return s, nil
				}
			}
		}
	}

	// 兜底：优先 JSON pretty
	if b, err := json.MarshalIndent(input, "", "  "); err == nil {
		return string(b), nil
	}
	return fmt.Sprintf("%v", input), nil
}

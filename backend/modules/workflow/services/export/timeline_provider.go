package export

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

// timelineProvider 将人文常见“事件时间线”导出为 Mermaid timeline
// 输入：
// {
//   "title": "xxx",
//   "events": [
//     { "date": "1911-10-10", "label": "武昌起义", "group": "中国近代史" }
//   ]
// }
type timelineProvider struct{}

func (p *timelineProvider) Name() string { return "timeline" }

func (p *timelineProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	m, ok := input.(map[string]interface{})
	if !ok || m == nil {
		return nil, fmt.Errorf("timeline 需要对象输入（title/events）")
	}
	title, _ := m["title"].(string)
	eventsAny, _ := m["events"].([]interface{})
	if len(eventsAny) == 0 {
		return nil, fmt.Errorf("timeline.events 为空")
	}

	type ev struct {
		date  string
		ts    time.Time
		label string
		group string
	}
	events := make([]ev, 0, len(eventsAny))
	for _, it := range eventsAny {
		em, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		date, _ := em["date"].(string)
		label, _ := em["label"].(string)
		group, _ := em["group"].(string)
		date = strings.TrimSpace(date)
		label = strings.TrimSpace(label)
		if date == "" || label == "" {
			continue
		}
		tm := parseDateLoose(date)
		events = append(events, ev{date: date, ts: tm, label: label, group: strings.TrimSpace(group)})
	}
	if len(events) == 0 {
		return nil, fmt.Errorf("timeline.events 无有效事件（需要 date+label）")
	}

	sort.Slice(events, func(i, j int) bool {
		// 可解析时间优先；否则按字符串
		if !events[i].ts.IsZero() && !events[j].ts.IsZero() {
			return events[i].ts.Before(events[j].ts)
		}
		return events[i].date < events[j].date
	})

	// Mermaid timeline 语法：
	// timeline
	//   title xxx
	//   section group
	//     1911-10-10 : 武昌起义
	var b strings.Builder
	b.WriteString("timeline\n")
	if strings.TrimSpace(title) != "" {
		b.WriteString("  title " + title + "\n")
	}

	// 按 group 分组（无 group 的放“事件”）
	grouped := map[string][]ev{}
	order := make([]string, 0, 8)
	for _, e := range events {
		g := e.group
		if g == "" {
			g = "事件"
		}
		if _, ok := grouped[g]; !ok {
			order = append(order, g)
		}
		grouped[g] = append(grouped[g], e)
	}
	for _, g := range order {
		b.WriteString("  section " + g + "\n")
		for _, e := range grouped[g] {
			b.WriteString(fmt.Sprintf("    %s : %s\n", e.date, e.label))
		}
	}

	mmd := b.String()
	md := fmt.Sprintf("```mermaid\n%s\n```\n", mmd)

	return []File{
		{Name: "timeline.mmd", Kind: "mermaid", MimeType: "text/plain; charset=utf-8", Bytes: []byte(mmd)},
		{Name: "timeline.md", Kind: "markdown", MimeType: "text/markdown; charset=utf-8", Bytes: []byte(md)},
	}, nil
}

func parseDateLoose(s string) time.Time {
	layouts := []string{
		"2006-01-02",
		"2006/01/02",
		"2006-01",
		"2006/01",
		"2006",
	}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t
		}
	}
	return time.Time{}
}

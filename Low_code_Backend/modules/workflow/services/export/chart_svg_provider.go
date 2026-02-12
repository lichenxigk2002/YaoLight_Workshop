package export

import (
	"encoding/json"
	"fmt"
	"math"
	"strings"
)

// chartSVGProvider 生成简单 SVG 图表（最小可用版本）
// 输入建议为：
// {
//   "type": "scatter" | "pie" | "line" | "bar" | "histogram" | "heatmap",
//   "title": "...",
//   "data": ...
// }
//
// scatter:
//   data: { "points": [ { "x": 1, "y": 2, "label": "A" } ] }
//
// pie:
//   data: { "items": [ { "label": "A", "value": 10 } ] }
//
// line:
//   data: { "series": [ { "name": "S1", "points": [ { "x": 1, "y": 2 } ] } ] }
//
// bar:
//   data: { "categories": ["A","B"], "series": [ { "name":"S1", "values":[1,2] } ] }
//
// histogram:
//   data: { "values": [1,2,3], "binCount": 10 }
//
// heatmap:
//   data: { "xLabels":["X1"], "yLabels":["Y1"], "values":[[0.1]] }
type chartSVGProvider struct{}

func (p *chartSVGProvider) Name() string { return "chart_svg" }

func (p *chartSVGProvider) Export(input interface{}, _ map[string]interface{}) ([]File, error) {
	m, ok := input.(map[string]interface{})
	if !ok {
		// 尝试从 JSON 字符串解析
		if s, ok := input.(string); ok {
			s = extractBodyFromFencedCodeBlock(s)
			var mm map[string]interface{}
			if err := json.Unmarshal([]byte(s), &mm); err == nil {
				m = mm
				ok = true
			}
		}
	}
	if !ok || m == nil {
		return nil, fmt.Errorf("chart 需要对象输入（包含 type/data）")
	}

	typ, _ := m["type"].(string)
	typ = strings.ToLower(strings.TrimSpace(typ))
	title, _ := m["title"].(string)
	data := m["data"]
	// 兼容：data 可能是 JSON 字符串（例如上游 AI 输出被包装后 data 仍为 string）
	if s, ok := data.(string); ok && strings.TrimSpace(s) != "" {
		s = extractBodyFromFencedCodeBlock(s)
		var any interface{}
		if err := json.Unmarshal([]byte(s), &any); err == nil {
			data = any
		}
	}

	switch typ {
	case "scatter":
		svg, err := renderScatterSVG(title, data)
		if err != nil {
			return nil, err
		}
		return []File{{
			Name:     "chart_scatter.svg",
			Kind:     "svg",
			MimeType: "image/svg+xml",
			Bytes:    []byte(svg),
		}}, nil
	case "pie":
		svg, err := renderPieSVG(title, data)
		if err != nil {
			return nil, err
		}
		return []File{{
			Name:     "chart_pie.svg",
			Kind:     "svg",
			MimeType: "image/svg+xml",
			Bytes:    []byte(svg),
		}}, nil
	case "line":
		svg, err := renderLineSVG(title, data)
		if err != nil {
			return nil, err
		}
		return []File{{
			Name:     "chart_line.svg",
			Kind:     "svg",
			MimeType: "image/svg+xml",
			Bytes:    []byte(svg),
		}}, nil
	case "bar":
		svg, err := renderBarSVG(title, data)
		if err != nil {
			return nil, err
		}
		return []File{{
			Name:     "chart_bar.svg",
			Kind:     "svg",
			MimeType: "image/svg+xml",
			Bytes:    []byte(svg),
		}}, nil
	case "histogram":
		svg, err := renderHistogramSVG(title, data)
		if err != nil {
			return nil, err
		}
		return []File{{
			Name:     "chart_histogram.svg",
			Kind:     "svg",
			MimeType: "image/svg+xml",
			Bytes:    []byte(svg),
		}}, nil
	case "heatmap":
		svg, err := renderHeatmapSVG(title, data)
		if err != nil {
			return nil, err
		}
		return []File{{
			Name:     "chart_heatmap.svg",
			Kind:     "svg",
			MimeType: "image/svg+xml",
			Bytes:    []byte(svg),
		}}, nil
	default:
		return nil, fmt.Errorf("不支持的 chart.type: %s（当前支持 scatter/pie/line/bar/histogram/heatmap）", typ)
	}
}

func extractBodyFromFencedCodeBlock(s string) string {
	ss := strings.TrimSpace(s)
	if !strings.HasPrefix(ss, "```") {
		return ss
	}
	nl := strings.Index(ss, "\n")
	if nl <= 0 {
		return ss
	}
	body := ss[nl+1:]
	if end := strings.LastIndex(body, "```"); end >= 0 {
		body = body[:end]
	}
	return strings.TrimSpace(body)
}

func renderLineSVG(title string, data interface{}) (string, error) {
	dm, ok := data.(map[string]interface{})
	if !ok || dm == nil {
		return "", fmt.Errorf("line.data 需要对象")
	}
	seriesAny, _ := dm["series"].([]interface{})
	if len(seriesAny) == 0 {
		return "", fmt.Errorf("line.data.series 为空")
	}

	type pt struct{ x, y float64 }
	type series struct {
		name   string
		points []pt
	}
	seriesList := make([]series, 0, len(seriesAny))
	minX, maxX := math.Inf(1), math.Inf(-1)
	minY, maxY := math.Inf(1), math.Inf(-1)
	for _, it := range seriesAny {
		sm, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := sm["name"].(string)
		pointsAny, _ := sm["points"].([]interface{})
		pts := make([]pt, 0, len(pointsAny))
		for _, pit := range pointsAny {
			pm, ok := pit.(map[string]interface{})
			if !ok {
				continue
			}
			x, okX := toFloat(pm["x"])
			y, okY := toFloat(pm["y"])
			if !okX || !okY {
				continue
			}
			pts = append(pts, pt{x: x, y: y})
			if x < minX {
				minX = x
			}
			if x > maxX {
				maxX = x
			}
			if y < minY {
				minY = y
			}
			if y > maxY {
				maxY = y
			}
		}
		if len(pts) == 0 {
			continue
		}
		seriesList = append(seriesList, series{name: name, points: pts})
	}
	if len(seriesList) == 0 {
		return "", fmt.Errorf("line.data.series 无有效点")
	}

	// 画布
	w, h := 900.0, 520.0
	padL, padR, padT, padB := 60.0, 160.0, 50.0, 50.0
	plotW := w - padL - padR
	plotH := h - padT - padB
	if minX == maxX {
		minX -= 1
		maxX += 1
	}
	if minY == maxY {
		minY -= 1
		maxY += 1
	}
	mapX := func(x float64) float64 { return padL + (x-minX)/(maxX-minX)*plotW }
	mapY := func(y float64) float64 { return padT + (1-(y-minY)/(maxY-minY))*plotH }

	colors := []string{"#1677ff", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2"}

	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" viewBox="0 0 %.0f %.0f">`, w, h, w, h))
	b.WriteString(`<rect x="0" y="0" width="100%" height="100%" fill="white"/>`)
	if strings.TrimSpace(title) != "" {
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="28" font-size="18" font-family="Arial" fill="#111">%s</text>`, padL, escapeXML(title)))
	}
	// 轴
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT, padL, padT+plotH))
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT+plotH, padL+plotW, padT+plotH))

	// 系列折线
	for i, s := range seriesList {
		color := colors[i%len(colors)]
		// path
		var path strings.Builder
		for j, p := range s.points {
			x, y := mapX(p.x), mapY(p.y)
			if j == 0 {
				path.WriteString(fmt.Sprintf("M %.2f %.2f", x, y))
			} else {
				path.WriteString(fmt.Sprintf(" L %.2f %.2f", x, y))
			}
		}
		b.WriteString(fmt.Sprintf(`<path d="%s" fill="none" stroke="%s" stroke-width="2"/>`, path.String(), color))
		// 点
		for _, p := range s.points {
			x, y := mapX(p.x), mapY(p.y)
			b.WriteString(fmt.Sprintf(`<circle cx="%.2f" cy="%.2f" r="3" fill="%s"/>`, x, y, color))
		}
	}

	// 图例
	lx, ly := padL+plotW+20, padT+10
	for i, s := range seriesList {
		color := colors[i%len(colors)]
		b.WriteString(fmt.Sprintf(`<rect x="%.0f" y="%.0f" width="14" height="14" fill="%s"/>`, lx, ly+float64(i)*22, color))
		name := s.name
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("S%d", i+1)
		}
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="%.0f" font-size="12" font-family="Arial" fill="#333" dx="22" dy="12">%s</text>`,
			lx, ly+float64(i)*22, escapeXML(name)))
	}

	b.WriteString(`</svg>`)
	return b.String(), nil
}

func renderBarSVG(title string, data interface{}) (string, error) {
	dm, ok := data.(map[string]interface{})
	if !ok || dm == nil {
		return "", fmt.Errorf("bar.data 需要对象")
	}
	catsAny, _ := dm["categories"].([]interface{})
	categories := make([]string, 0, len(catsAny))
	for _, c := range catsAny {
		if s, ok := c.(string); ok {
			categories = append(categories, s)
		}
	}
	seriesAny, _ := dm["series"].([]interface{})
	// 兼容：上游输出为 traits（如：{ person, traits:[{name,score,...}] }），自动转换为 bar 所需结构
	if len(categories) == 0 || len(seriesAny) == 0 {
		if cats, vals, ok := extractBarFromTraits(dm); ok {
			categories = cats
			seriesAny = []interface{}{
				map[string]interface{}{
					"name":   "评分",
					"values": vals,
				},
			}
		} else {
			return "", fmt.Errorf("bar.data 需要 categories + series")
		}
	}

	type series struct {
		name   string
		values []float64
	}
	seriesList := make([]series, 0, len(seriesAny))
	maxV := 0.0
	for _, it := range seriesAny {
		sm, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := sm["name"].(string)
		valsAny, _ := sm["values"].([]interface{})
		vals := make([]float64, 0, len(valsAny))
		for _, v := range valsAny {
			f, okF := toFloat(v)
			if !okF {
				f = 0
			}
			vals = append(vals, f)
			if f > maxV {
				maxV = f
			}
		}
		if len(vals) == 0 {
			continue
		}
		seriesList = append(seriesList, series{name: name, values: vals})
	}
	if len(seriesList) == 0 {
		return "", fmt.Errorf("bar.data.series 无有效数据")
	}
	if maxV == 0 {
		maxV = 1
	}

	w, h := 900.0, 520.0
	padL, padR, padT, padB := 60.0, 160.0, 50.0, 70.0
	plotW := w - padL - padR
	plotH := h - padT - padB

	colors := []string{"#1677ff", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2"}

	catN := float64(len(categories))
	serN := float64(len(seriesList))
	groupW := plotW / catN
	barW := groupW / (serN + 1)

	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" viewBox="0 0 %.0f %.0f">`, w, h, w, h))
	b.WriteString(`<rect x="0" y="0" width="100%" height="100%" fill="white"/>`)
	if strings.TrimSpace(title) != "" {
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="28" font-size="18" font-family="Arial" fill="#111">%s</text>`, padL, escapeXML(title)))
	}
	// 轴
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT, padL, padT+plotH))
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT+plotH, padL+plotW, padT+plotH))

	// bars
	for ci, cat := range categories {
		gx := padL + float64(ci)*groupW
		// x label
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="middle" dy="22">%.20s</text>`,
			gx+groupW/2, padT+plotH, escapeXML(cat)))
		for si, s := range seriesList {
			color := colors[si%len(colors)]
			v := 0.0
			if ci < len(s.values) {
				v = s.values[ci]
			}
			barH := (v / maxV) * plotH
			x := gx + barW*(float64(si)+0.5)
			y := padT + (plotH - barH)
			b.WriteString(fmt.Sprintf(`<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s" opacity="0.9"/>`, x, y, barW*0.9, barH, color))
		}
	}

	// y ticks
	for i := 0; i <= 5; i++ {
		tv := maxV * float64(i) / 5.0
		y := padT + (1-float64(i)/5.0)*plotH
		b.WriteString(fmt.Sprintf(`<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="#666" stroke-width="1"/>`, padL-5, y, padL, y))
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="end" dx="-8" dy="4">%.2f</text>`, padL, y, tv))
	}

	// legend
	lx, ly := padL+plotW+20, padT+10
	for i, s := range seriesList {
		color := colors[i%len(colors)]
		b.WriteString(fmt.Sprintf(`<rect x="%.0f" y="%.0f" width="14" height="14" fill="%s"/>`, lx, ly+float64(i)*22, color))
		name := s.name
		if strings.TrimSpace(name) == "" {
			name = fmt.Sprintf("S%d", i+1)
		}
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="%.0f" font-size="12" font-family="Arial" fill="#333" dx="22" dy="12">%s</text>`,
			lx, ly+float64(i)*22, escapeXML(name)))
	}

	b.WriteString(`</svg>`)
	return b.String(), nil
}

func extractBarFromTraits(dm map[string]interface{}) (categories []string, values []float64, ok bool) {
	traitsAny, _ := dm["traits"].([]interface{})
	if len(traitsAny) == 0 {
		return nil, nil, false
	}
	cats := make([]string, 0, len(traitsAny))
	vals := make([]float64, 0, len(traitsAny))
	for _, it := range traitsAny {
		tm, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := tm["name"].(string)
		score, okS := toFloat(tm["score"])
		name = strings.TrimSpace(name)
		if name == "" || !okS {
			continue
		}
		cats = append(cats, name)
		vals = append(vals, score)
	}
	if len(cats) == 0 || len(vals) == 0 {
		return nil, nil, false
	}
	return cats, vals, true
}

func renderHistogramSVG(title string, data interface{}) (string, error) {
	dm, ok := data.(map[string]interface{})
	if !ok || dm == nil {
		return "", fmt.Errorf("histogram.data 需要对象")
	}
	valsAny, _ := dm["values"].([]interface{})
	if len(valsAny) == 0 {
		return "", fmt.Errorf("histogram.data.values 为空")
	}
	binCountF, _ := toFloat(dm["binCount"])
	binCount := int(binCountF)
	if binCount <= 0 {
		binCount = 10
	}
	values := make([]float64, 0, len(valsAny))
	minV, maxV := math.Inf(1), math.Inf(-1)
	for _, v := range valsAny {
		f, okF := toFloat(v)
		if !okF {
			continue
		}
		values = append(values, f)
		if f < minV {
			minV = f
		}
		if f > maxV {
			maxV = f
		}
	}
	if len(values) == 0 {
		return "", fmt.Errorf("histogram.data.values 无有效数值")
	}
	if minV == maxV {
		minV -= 1
		maxV += 1
	}
	bins := make([]int, binCount)
	for _, v := range values {
		idx := int((v - minV) / (maxV - minV) * float64(binCount))
		if idx == binCount {
			idx--
		}
		if idx < 0 {
			idx = 0
		}
		if idx >= binCount {
			idx = binCount - 1
		}
		bins[idx]++
	}
	maxC := 0
	for _, c := range bins {
		if c > maxC {
			maxC = c
		}
	}
	if maxC == 0 {
		maxC = 1
	}

	w, h := 900.0, 520.0
	padL, padR, padT, padB := 60.0, 30.0, 50.0, 70.0
	plotW := w - padL - padR
	plotH := h - padT - padB

	barW := plotW / float64(binCount)

	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" viewBox="0 0 %.0f %.0f">`, w, h, w, h))
	b.WriteString(`<rect x="0" y="0" width="100%" height="100%" fill="white"/>`)
	if strings.TrimSpace(title) != "" {
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="28" font-size="18" font-family="Arial" fill="#111">%s</text>`, padL, escapeXML(title)))
	}
	// 轴
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT, padL, padT+plotH))
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT+plotH, padL+plotW, padT+plotH))

	for i, c := range bins {
		x := padL + float64(i)*barW
		hh := float64(c) / float64(maxC) * plotH
		y := padT + (plotH - hh)
		b.WriteString(fmt.Sprintf(`<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="#1677ff" opacity="0.85"/>`, x+barW*0.05, y, barW*0.9, hh))
	}

	// y ticks
	for i := 0; i <= 5; i++ {
		tc := float64(maxC) * float64(i) / 5.0
		y := padT + (1-float64(i)/5.0)*plotH
		b.WriteString(fmt.Sprintf(`<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="#666" stroke-width="1"/>`, padL-5, y, padL, y))
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="end" dx="-8" dy="4">%.0f</text>`, padL, y, tc))
	}

	// x labels（只标 0/25/50/75/100%）
	for _, frac := range []float64{0, 0.25, 0.5, 0.75, 1} {
		v := minV + (maxV-minV)*frac
		x := padL + plotW*frac
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="middle" dy="22">%.2f</text>`, x, padT+plotH, v))
	}

	b.WriteString(`</svg>`)
	return b.String(), nil
}

func renderHeatmapSVG(title string, data interface{}) (string, error) {
	dm, ok := data.(map[string]interface{})
	if !ok || dm == nil {
		return "", fmt.Errorf("heatmap.data 需要对象")
	}
	xAny, _ := dm["xLabels"].([]interface{})
	yAny, _ := dm["yLabels"].([]interface{})
	valsAny, _ := dm["values"].([]interface{})
	if len(xAny) == 0 || len(yAny) == 0 || len(valsAny) == 0 {
		return "", fmt.Errorf("heatmap 需要 xLabels/yLabels/values")
	}
	xLabels := make([]string, 0, len(xAny))
	for _, v := range xAny {
		if s, ok := v.(string); ok {
			xLabels = append(xLabels, s)
		}
	}
	yLabels := make([]string, 0, len(yAny))
	for _, v := range yAny {
		if s, ok := v.(string); ok {
			yLabels = append(yLabels, s)
		}
	}
	rows := len(yLabels)
	cols := len(xLabels)

	matrix := make([][]float64, 0, rows)
	minV, maxV := math.Inf(1), math.Inf(-1)
	for r := 0; r < rows; r++ {
		rowAny, ok := valsAny[r].([]interface{})
		if !ok {
			return "", fmt.Errorf("heatmap.values[%d] 不是数组", r)
		}
		row := make([]float64, 0, cols)
		for c := 0; c < cols; c++ {
			var f float64
			if c < len(rowAny) {
				ff, okF := toFloat(rowAny[c])
				if okF {
					f = ff
				}
			}
			row = append(row, f)
			if f < minV {
				minV = f
			}
			if f > maxV {
				maxV = f
			}
		}
		matrix = append(matrix, row)
	}
	if minV == maxV {
		minV -= 1
		maxV += 1
	}

	w, h := 900.0, 520.0
	padL, padR, padT, padB := 120.0, 120.0, 50.0, 70.0
	plotW := w - padL - padR
	plotH := h - padT - padB
	cellW := plotW / float64(cols)
	cellH := plotH / float64(rows)

	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" viewBox="0 0 %.0f %.0f">`, w, h, w, h))
	b.WriteString(`<rect x="0" y="0" width="100%" height="100%" fill="white"/>`)
	if strings.TrimSpace(title) != "" {
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="28" font-size="18" font-family="Arial" fill="#111">%s</text>`, padL, escapeXML(title)))
	}

	for r := 0; r < rows; r++ {
		for c := 0; c < cols; c++ {
			v := matrix[r][c]
			t := (v - minV) / (maxV - minV)
			color := heatColor(t)
			x := padL + float64(c)*cellW
			y := padT + float64(r)*cellH
			b.WriteString(fmt.Sprintf(`<rect x="%.2f" y="%.2f" width="%.2f" height="%.2f" fill="%s"/>`, x, y, cellW, cellH, color))
		}
	}

	// labels
	for c, lbl := range xLabels {
		x := padL + float64(c)*cellW + cellW/2
		y := padT + plotH
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="middle" dy="22">%.12s</text>`, x, y, escapeXML(lbl)))
	}
	for r, lbl := range yLabels {
		x := padL
		y := padT + float64(r)*cellH + cellH/2
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="end" dx="-10" dy="4">%.14s</text>`, x, y, escapeXML(lbl)))
	}

	// legend（右侧）
	lx := padL + plotW + 30
	ly := padT
	lh := plotH
	for i := 0; i < 100; i++ {
		t := 1 - float64(i)/99.0
		color := heatColor(t)
		y := ly + float64(i)/100.0*lh
		b.WriteString(fmt.Sprintf(`<rect x="%.2f" y="%.2f" width="16" height="%.2f" fill="%s"/>`, lx, y, lh/100.0+0.5, color))
	}
	b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" dx="22" dy="4">%.2f</text>`, lx, ly, maxV))
	b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" dx="22" dy="4">%.2f</text>`, lx, ly+lh, minV))

	b.WriteString(`</svg>`)
	return b.String(), nil
}

func heatColor(t float64) string {
	// clamp
	if t < 0 {
		t = 0
	}
	if t > 1 {
		t = 1
	}
	// 简单蓝->红渐变
	r := int(255 * t)
	g := int(80 * (1 - math.Abs(t-0.5)*2))
	b := int(255 * (1 - t))
	return fmt.Sprintf("rgb(%d,%d,%d)", r, g, b)
}

func renderScatterSVG(title string, data interface{}) (string, error) {
	dm, ok := data.(map[string]interface{})
	if !ok || dm == nil {
		return "", fmt.Errorf("scatter.data 需要对象")
	}
	pointsAny, _ := dm["points"].([]interface{})
	if len(pointsAny) == 0 {
		return "", fmt.Errorf("scatter.data.points 为空")
	}

	type pt struct {
		x     float64
		y     float64
		label string
	}
	pts := make([]pt, 0, len(pointsAny))
	minX, maxX := math.Inf(1), math.Inf(-1)
	minY, maxY := math.Inf(1), math.Inf(-1)
	for _, it := range pointsAny {
		pm, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		x, _ := toFloat(pm["x"])
		y, _ := toFloat(pm["y"])
		lbl, _ := pm["label"].(string)
		pts = append(pts, pt{x: x, y: y, label: lbl})
		if x < minX {
			minX = x
		}
		if x > maxX {
			maxX = x
		}
		if y < minY {
			minY = y
		}
		if y > maxY {
			maxY = y
		}
	}
	if len(pts) == 0 {
		return "", fmt.Errorf("scatter.data.points 无有效点")
	}

	// 画布
	w, h := 900.0, 520.0
	padL, padR, padT, padB := 60.0, 30.0, 50.0, 50.0
	plotW := w - padL - padR
	plotH := h - padT - padB

	// 防止 min==max
	if minX == maxX {
		minX -= 1
		maxX += 1
	}
	if minY == maxY {
		minY -= 1
		maxY += 1
	}

	mapX := func(x float64) float64 { return padL + (x-minX)/(maxX-minX)*plotW }
	mapY := func(y float64) float64 { return padT + (1-(y-minY)/(maxY-minY))*plotH }

	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" viewBox="0 0 %.0f %.0f">`, w, h, w, h))
	b.WriteString(`<rect x="0" y="0" width="100%" height="100%" fill="white"/>`)
	if strings.TrimSpace(title) != "" {
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="28" font-size="18" font-family="Arial" fill="#111">%s</text>`, padL, escapeXML(title)))
	}
	// 轴
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT, padL, padT+plotH))
	b.WriteString(fmt.Sprintf(`<line x1="%.0f" y1="%.0f" x2="%.0f" y2="%.0f" stroke="#333" stroke-width="1"/>`, padL, padT+plotH, padL+plotW, padT+plotH))

	// 点
	for _, p := range pts {
		cx, cy := mapX(p.x), mapY(p.y)
		b.WriteString(fmt.Sprintf(`<circle cx="%.2f" cy="%.2f" r="4" fill="#1677ff" opacity="0.9"/>`, cx, cy))
		if strings.TrimSpace(p.label) != "" {
			b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="12" font-family="Arial" fill="#333" dx="6" dy="-6">%s</text>`,
				cx, cy, escapeXML(p.label)))
		}
	}

	// 简单刻度（5段）
	for i := 0; i <= 5; i++ {
		tx := minX + (maxX-minX)*float64(i)/5.0
		x := mapX(tx)
		y := padT + plotH
		b.WriteString(fmt.Sprintf(`<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="#666" stroke-width="1"/>`, x, y, x, y+5))
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="middle" dy="18">%.2f</text>`, x, y, tx))
	}
	for i := 0; i <= 5; i++ {
		ty := minY + (maxY-minY)*float64(i)/5.0
		y := mapY(ty)
		x := padL
		b.WriteString(fmt.Sprintf(`<line x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f" stroke="#666" stroke-width="1"/>`, x-5, y, x, y))
		b.WriteString(fmt.Sprintf(`<text x="%.2f" y="%.2f" font-size="11" font-family="Arial" fill="#555" text-anchor="end" dx="-8" dy="4">%.2f</text>`, x, y, ty))
	}

	b.WriteString(`</svg>`)
	return b.String(), nil
}

func renderPieSVG(title string, data interface{}) (string, error) {
	dm, ok := data.(map[string]interface{})
	if !ok || dm == nil {
		return "", fmt.Errorf("pie.data 需要对象")
	}
	itemsAny, _ := dm["items"].([]interface{})
	if len(itemsAny) == 0 {
		return "", fmt.Errorf("pie.data.items 为空")
	}
	type item struct {
		label string
		value float64
	}
	items := make([]item, 0, len(itemsAny))
	sum := 0.0
	for _, it := range itemsAny {
		im, ok := it.(map[string]interface{})
		if !ok {
			continue
		}
		lbl, _ := im["label"].(string)
		val, _ := toFloat(im["value"])
		if val <= 0 {
			continue
		}
		items = append(items, item{label: lbl, value: val})
		sum += val
	}
	if len(items) == 0 || sum <= 0 {
		return "", fmt.Errorf("pie.data.items 无有效数据")
	}

	// 画布
	w, h := 900.0, 520.0
	cx, cy := 260.0, 280.0
	r := 160.0

	colors := []string{"#1677ff", "#52c41a", "#faad14", "#f5222d", "#722ed1", "#13c2c2", "#eb2f96", "#2f54eb"}

	var b strings.Builder
	b.WriteString(fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="%.0f" height="%.0f" viewBox="0 0 %.0f %.0f">`, w, h, w, h))
	b.WriteString(`<rect x="0" y="0" width="100%" height="100%" fill="white"/>`)
	if strings.TrimSpace(title) != "" {
		b.WriteString(fmt.Sprintf(`<text x="60" y="40" font-size="18" font-family="Arial" fill="#111">%s</text>`, escapeXML(title)))
	}

	start := -math.Pi / 2
	for i, it := range items {
		ang := it.value / sum * math.Pi * 2
		end := start + ang
		large := 0
		if ang > math.Pi {
			large = 1
		}
		x1 := cx + r*math.Cos(start)
		y1 := cy + r*math.Sin(start)
		x2 := cx + r*math.Cos(end)
		y2 := cy + r*math.Sin(end)
		color := colors[i%len(colors)]
		path := fmt.Sprintf("M %.2f %.2f L %.2f %.2f A %.2f %.2f 0 %d 1 %.2f %.2f Z", cx, cy, x1, y1, r, r, large, x2, y2)
		b.WriteString(fmt.Sprintf(`<path d="%s" fill="%s" opacity="0.92"/>`, path, color))
		start = end
	}

	// 图例
	lx, ly := 520.0, 120.0
	for i, it := range items {
		color := colors[i%len(colors)]
		pct := it.value / sum * 100
		b.WriteString(fmt.Sprintf(`<rect x="%.0f" y="%.0f" width="14" height="14" fill="%s"/>`, lx, ly+float64(i)*26, color))
		b.WriteString(fmt.Sprintf(`<text x="%.0f" y="%.0f" font-size="13" font-family="Arial" fill="#333" dx="22" dy="12">%s (%.1f%%)</text>`,
			lx, ly+float64(i)*26, escapeXML(it.label), pct))
	}

	b.WriteString(`</svg>`)
	return b.String(), nil
}

func toFloat(v interface{}) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case float32:
		return float64(t), true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	default:
		return 0, false
	}
}

func escapeXML(s string) string {
	repl := strings.NewReplacer(
		"&", "&amp;",
		"<", "&lt;",
		">", "&gt;",
		`"`, "&quot;",
		"'", "&apos;",
	)
	return repl.Replace(s)
}

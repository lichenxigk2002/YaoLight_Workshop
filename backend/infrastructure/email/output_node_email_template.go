package email

import (
	"fmt"
	"html"
	"regexp"
	"strings"
)

var (
	inlineCodeRe = regexp.MustCompile("`([^`]+)`")
	boldRe       = regexp.MustCompile(`\*\*(.+?)\*\*`)
	italicRe     = regexp.MustCompile(`\*(.+?)\*`)
)

func renderInlineMarkdown(text string) string {
	escaped := html.EscapeString(text)
	escaped = inlineCodeRe.ReplaceAllString(escaped, "<code>$1</code>")
	escaped = boldRe.ReplaceAllString(escaped, "<strong>$1</strong>")
	escaped = italicRe.ReplaceAllString(escaped, "<em>$1</em>")
	return escaped
}

func simpleMarkdownToHTML(markdown string) string {
	if markdown == "" {
		return ""
	}
	trimmed := strings.TrimSpace(markdown)

	if strings.HasPrefix(trimmed, "```") {
		withoutFence := strings.TrimPrefix(trimmed, "```")
		withoutFence = strings.TrimSpace(withoutFence)
		if idx := strings.IndexByte(withoutFence, '\n'); idx >= 0 {
			withoutFence = withoutFence[idx+1:]
		}
		if endIdx := strings.LastIndex(withoutFence, "```"); endIdx >= 0 {
			withoutFence = withoutFence[:endIdx]
		}
		trimmed = strings.TrimSpace(withoutFence)
	}

	text := strings.ReplaceAll(trimmed, "\r\n", "\n")
	lines := strings.Split(text, "\n")

	var b strings.Builder
	inUL := false
	inOL := false
	var para []string

	flushParagraph := func() {
		if len(para) == 0 {
			return
		}
		b.WriteString("<p>")
		b.WriteString(strings.Join(para, "<br />"))
		b.WriteString("</p>")
		para = para[:0]
	}

	closeLists := func() {
		if inUL {
			b.WriteString("</ul>")
			inUL = false
		}
		if inOL {
			b.WriteString("</ol>")
			inOL = false
		}
	}

	for _, line := range lines {
		l := strings.TrimSpace(line)
		if l == "" {
			flushParagraph()
			closeLists()
			continue
		}

		if strings.HasPrefix(l, "#") {
			flushParagraph()
			closeLists()
			level := 0
			for level < len(l) && l[level] == '#' && level < 6 {
				level++
			}
			if level == 0 {
				para = append(para, renderInlineMarkdown(l))
				continue
			}
			content := strings.TrimSpace(l[level:])
			if content == "" {
				continue
			}
			b.WriteString(fmt.Sprintf("<h%d>%s</h%d>", level, renderInlineMarkdown(content), level))
			continue
		}

		if strings.HasPrefix(l, "- ") || strings.HasPrefix(l, "* ") {
			flushParagraph()
			if inOL {
				b.WriteString("</ol>")
				inOL = false
			}
			if !inUL {
				b.WriteString("<ul>")
				inUL = true
			}
			item := strings.TrimSpace(l[2:])
			b.WriteString("<li>")
			b.WriteString(renderInlineMarkdown(item))
			b.WriteString("</li>")
			continue
		}

		if idx := strings.Index(l, ". "); idx > 0 {
			isDigits := true
			for i := 0; i < idx; i++ {
				if l[i] < '0' || l[i] > '9' {
					isDigits = false
					break
				}
			}
			if isDigits {
				flushParagraph()
				if inUL {
					b.WriteString("</ul>")
					inUL = false
				}
				if !inOL {
					b.WriteString("<ol>")
					inOL = true
				}
				item := strings.TrimSpace(l[idx+2:])
				b.WriteString("<li>")
				b.WriteString(renderInlineMarkdown(item))
				b.WriteString("</li>")
				continue
			}
		}

		para = append(para, renderInlineMarkdown(l))
	}

	flushParagraph()
	closeLists()

	return b.String()
}

func buildOutputEmailHTML(title, contentHTML string) string {
	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      margin: 0;
      padding: 16px 12px;
      background: #f5f5f5;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .container {
      max-width: 600px;
      width: 100%%;
      margin: 0;
      background: #ffffff;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 2px 10px rgba(0,0,0,0.06);
    }
    .header {
      background: #000000;
      color: #ffffff;
      padding: 20px 24px;
    }
    .header h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.4;
    }
    .content {
      padding: 24px 24px 20px;
      color: #222222;
      font-size: 14px;
      line-height: 1.7;
    }
    .content p {
      margin: 0.6em 0;
    }
    .content h1,
    .content h2,
    .content h3,
    .content h4,
    .content h5,
    .content h6 {
      margin: 1.4em 0 0.6em;
      font-weight: 600;
      line-height: 1.4;
      color: #111111;
    }
    .content h1 { font-size: 24px; }
    .content h2 { font-size: 20px; }
    .content h3 { font-size: 18px; }
    .content h4 { font-size: 16px; }
    .content h5 { font-size: 14px; }
    .content h6 { font-size: 13px; color: #555555; }
    .content ul,
    .content ol {
      margin: 0.6em 0 0.6em 1.4em;
      padding: 0;
    }
    .content li {
      margin: 0.2em 0;
    }
    .content a {
      color: #1677ff;
      text-decoration: none;
    }
    .content a:hover {
      text-decoration: underline;
    }
    .content code {
      font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      background: #f6f6f6;
      padding: 0.1em 0.3em;
      border-radius: 4px;
      font-size: 0.9em;
    }
    .content pre {
      background: #111111;
      color: #f5f5f5;
      padding: 12px 14px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 13px;
      line-height: 1.5;
      margin: 1em 0;
    }
    .content pre code {
      background: transparent;
      padding: 0;
      color: inherit;
      white-space: pre;
    }
    .content blockquote {
      margin: 0.8em 0;
      padding: 0.6em 0.8em;
      border-left: 3px solid #dddddd;
      background: #fafafa;
      color: #555555;
    }
    .content hr {
      border: none;
      border-top: 1px solid #eeeeee;
      margin: 1.4em 0;
    }
    .content img {
      max-width: 100%%;
      height: auto;
      border-radius: 4px;
      margin: 0.6em 0;
    }
    .content table {
      border-collapse: collapse;
      width: 100%%;
      margin: 1em 0;
      font-size: 13px;
    }
    .content th,
    .content td {
      border: 1px solid #e5e5e5;
      padding: 6px 8px;
      text-align: left;
    }
    .content th {
      background: #fafafa;
      font-weight: 600;
    }
    .footer {
      padding: 14px 24px 18px;
      border-top: 1px solid #f0f0f0;
      color: #999999;
      font-size: 12px;
      text-align: center;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>%s</h1>
    </div>
    <div class="content">
      %s
    </div>
    <div class="footer">
      <p>本邮件由瑶光工坊自动发送，请勿直接回复。</p>
    </div>
  </div>
</body>
</html>`, html.EscapeString(title), contentHTML)
}

func SendWorkflowOutputEmail(to, subject, title, markdownBody string, attachments []Attachment) error {
	htmlBody := simpleMarkdownToHTML(markdownBody)
	body := buildOutputEmailHTML(title, htmlBody)
	svc := NewEmailService()
	return svc.SendWithAttachments(to, subject, body, attachments)
}

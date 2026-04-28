package services

import "testing"

func TestParseCodeRepairResponseJSON(t *testing.T) {
	content := `{"fixedSource":"return input;","explanation":"Removed unsupported syntax."}`
	fixed, explanation := parseCodeRepairResponse(content, "")
	if fixed != "return input;" {
		t.Fatalf("unexpected fixed source: %q", fixed)
	}
	if explanation == "" {
		t.Fatalf("expected explanation")
	}
}

func TestParseCodeRepairResponseMarkdownJSON(t *testing.T) {
	content := "```json\n{\"fixedSource\":\"return { ok: true };\",\"explanation\":\"Normalized return value.\"}\n```"
	fixed, _ := parseCodeRepairResponse(content, "")
	if fixed != "return { ok: true };" {
		t.Fatalf("unexpected fixed source: %q", fixed)
	}
}

func TestParseCodeRepairResponseCodeBlockFallback(t *testing.T) {
	content := "修复如下：\n```javascript\nreturn input?.items ?? [];\n```"
	fixed, explanation := parseCodeRepairResponse(content, "return input;")
	if fixed != "return input?.items ?? [];" {
		t.Fatalf("unexpected fixed source: %q", fixed)
	}
	if explanation == "" {
		t.Fatalf("expected fallback explanation")
	}
}

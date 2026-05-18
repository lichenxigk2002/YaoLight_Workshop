package export

import (
	"strings"
	"testing"
)

func TestToPrettyTextPrefersKnownStringFields(t *testing.T) {
	got, err := ToPrettyText(map[string]interface{}{
		"tokens":  10,
		"content": "  rendered markdown  ",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if got != "  rendered markdown  " {
		t.Fatalf("unexpected text: %q", got)
	}
}

func TestToPrettyTextFallsBackToPrettyJSON(t *testing.T) {
	got, err := ToPrettyText(map[string]interface{}{"b": 2, "a": 1})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if !strings.Contains(got, "\n") || !strings.Contains(got, `"a": 1`) {
		t.Fatalf("expected pretty json, got %q", got)
	}
}

func TestToPrettyTextHandlesNilStringAndBytes(t *testing.T) {
	got, err := ToPrettyText(nil)
	if err != nil || got != "" {
		t.Fatalf("expected empty nil text, got %q err=%v", got, err)
	}

	got, err = ToPrettyText("plain")
	if err != nil || got != "plain" {
		t.Fatalf("expected plain string, got %q err=%v", got, err)
	}

	got, err = ToPrettyText([]byte("bytes"))
	if err != nil || got != "bytes" {
		t.Fatalf("expected bytes string, got %q err=%v", got, err)
	}
}

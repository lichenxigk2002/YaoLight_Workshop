package services

import "testing"

func TestNormalizeScopesDefaultsToReadScopes(t *testing.T) {
	got := NormalizeScopes(nil, true)
	if len(got) != len(DefaultReadScopes) {
		t.Fatalf("expected default scopes length %d, got %d", len(DefaultReadScopes), len(got))
	}
	for i, scope := range DefaultReadScopes {
		if got[i] != scope {
			t.Fatalf("expected scope %q at index %d, got %q", scope, i, got[i])
		}
	}
}

func TestNormalizeScopesFiltersUnsupportedAndDeduplicates(t *testing.T) {
	got := NormalizeScopes([]string{
		"projects:read",
		"projects:read",
		"delete_project",
		"workflows:execute",
		"tasks:write",
	}, true)

	want := []string{"projects:read", "workflows:execute", "tasks:write"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("expected %v, got %v", want, got)
		}
	}
}

func TestNormalizeScopesDropsExecutionWhenDisabled(t *testing.T) {
	got := NormalizeScopes([]string{"projects:read", "workflows:execute", "tasks:write"}, false)
	want := []string{"projects:read"}
	if len(got) != len(want) || got[0] != want[0] {
		t.Fatalf("expected %v, got %v", want, got)
	}
}

func TestHashTokenDoesNotReturnPlainToken(t *testing.T) {
	token := "yl_mcp_example"
	hash := HashToken(token)
	if hash == token {
		t.Fatal("hash should not equal plain token")
	}
	if len(hash) != 64 {
		t.Fatalf("expected sha256 hex length 64, got %d", len(hash))
	}
}

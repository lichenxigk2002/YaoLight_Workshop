package services

import "testing"

func TestGetCrawlerRuleID(t *testing.T) {
	tests := []struct {
		name   string
		config map[string]interface{}
		want   uint
	}{
		{
			name:   "ruleId float64",
			config: map[string]interface{}{"ruleId": float64(12)},
			want:   12,
		},
		{
			name:   "rule_id string",
			config: map[string]interface{}{"rule_id": "34"},
			want:   34,
		},
		{
			name:   "invalid value",
			config: map[string]interface{}{"ruleId": "not-a-number"},
			want:   0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := getCrawlerRuleID(tt.config)
			if got != tt.want {
				t.Fatalf("expected rule id %d, got %d", tt.want, got)
			}
		})
	}
}

func TestBuildCrawlerConfigFromNode(t *testing.T) {
	exec := &WorkflowExecutor{}
	vc := NewVariableContext()
	vc.variables["auth.token"] = "abc123"
	vc.variables["auth.cookieValue"] = "tenant-1"

	node := NodeConfig{
		ID:   "crawler-1",
		Type: "crawler",
		Config: map[string]interface{}{
			"method":          "POST",
			"selector":        ".article",
			"userAgent":       "NodeUA/1.0",
			"timeout":         40,
			"headers":         "{\"Authorization\":\"Bearer {{auth.token}}\"}",
			"cookies":         map[string]interface{}{"tenant": "{{auth.cookieValue}}"},
			"proxy":           "http://127.0.0.1:7890",
			"retryCount":      5,
			"retryDelay":      2,
			"waitTime":        3,
			"extractType":     "html",
			"extractAttr":     "href",
			"encoding":        "utf-8",
			"extractMode":     "custom",
			"javascriptWait":  8,
			"followRedirect":  false,
			"verifySSL":       false,
			"useHeadless":     true,
			"waitForSelector": ".loaded",
			"disableImages":   true,
			"pagination": map[string]interface{}{
				"enabled":   true,
				"selector":  ".next",
				"maxPages":  6,
				"pageParam": "page",
				"startPage": 2,
				"increment": 1,
			},
		},
	}

	config, err := exec.buildCrawlerConfigFromNode(node, "https://example.com/page", vc)
	if err != nil {
		t.Fatalf("buildCrawlerConfigFromNode returned error: %v", err)
	}

	if config.URL != "https://example.com/page" {
		t.Fatalf("expected URL to be passed through, got %q", config.URL)
	}
	if config.Method != "POST" {
		t.Fatalf("expected method POST, got %q", config.Method)
	}
	if config.Headers["Authorization"] != "Bearer abc123" {
		t.Fatalf("expected resolved header, got %#v", config.Headers)
	}
	if config.Cookies["tenant"] != "tenant-1" {
		t.Fatalf("expected resolved cookie, got %#v", config.Cookies)
	}
	if config.Proxy != "http://127.0.0.1:7890" {
		t.Fatalf("expected proxy to be mapped, got %q", config.Proxy)
	}
	if !config.UseHeadless || !config.DisableImages {
		t.Fatalf("expected headless settings to be mapped, got %#v", config)
	}
	if config.Pagination == nil || !config.Pagination.Enabled {
		t.Fatal("expected pagination to be enabled")
	}
	if config.Pagination.Selector != ".next" || config.Pagination.MaxPages != 6 {
		t.Fatalf("unexpected pagination config: %#v", config.Pagination)
	}
}

func TestResolveCrawlerNodeURLFromVariable(t *testing.T) {
	exec := &WorkflowExecutor{}
	vc := NewVariableContext()
	vc.variables["start.data.url"] = "https://example.com/from-variable"

	node := NodeConfig{
		ID:   "crawler-1",
		Type: "crawler",
		Config: map[string]interface{}{
			"urlVariable": "{{start.data.url}}",
		},
	}

	url, result := exec.resolveCrawlerNodeURL(node, nil, vc)
	if result != nil {
		t.Fatalf("expected no error result, got %#v", result)
	}
	if url != "https://example.com/from-variable" {
		t.Fatalf("expected resolved URL, got %q", url)
	}
}

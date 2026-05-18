package services

import "testing"

func TestProviderConfigMapperCopiesExistingConfig(t *testing.T) {
	mapper := NewProviderConfigMapper()
	existing := map[string]interface{}{"custom": "keep"}

	got, stream := mapper.MapProviderConfig("deepseek", map[string]interface{}{"thinking": true}, existing)
	if stream {
		t.Fatalf("expected deepseek stream default false")
	}
	if got["custom"] != "keep" || got["thinking"] != true {
		t.Fatalf("unexpected mapped config: %#v", got)
	}
	if _, ok := existing["thinking"]; ok {
		t.Fatalf("expected existing config not to be mutated: %#v", existing)
	}
}

func TestProviderConfigMapperMapsQwenThinking(t *testing.T) {
	mapper := NewProviderConfigMapper()
	got, _ := mapper.MapProviderConfig("qwen", map[string]interface{}{"reasoning": true}, nil)
	if got["enable_thinking"] != true {
		t.Fatalf("expected enable_thinking=true, got %#v", got)
	}
}

func TestProviderConfigMapperMapsOpenRouterReasoningEffort(t *testing.T) {
	mapper := NewProviderConfigMapper()
	got, _ := mapper.MapProviderConfig("gpt", map[string]interface{}{
		"reasoning":        true,
		"reasoning_effort": "high",
	}, nil)

	reasoning, ok := got["reasoning"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected reasoning map, got %#v", got["reasoning"])
	}
	if reasoning["enabled"] != true || reasoning["effort"] != "high" {
		t.Fatalf("unexpected reasoning config: %#v", reasoning)
	}
}

func TestProviderConfigMapperDoubaoStreamDefault(t *testing.T) {
	mapper := NewProviderConfigMapper()
	got, stream := mapper.MapProviderConfig("doubao", nil, nil)
	if !stream || got["stream"] != true {
		t.Fatalf("expected doubao stream default true, got stream=%v config=%#v", stream, got)
	}
	if got["thinkingLevel"] != "medium" {
		t.Fatalf("expected default thinking level, got %#v", got)
	}
}

func TestProviderConfigMapperHunyuanSeedAndThinkingAliases(t *testing.T) {
	mapper := NewProviderConfigMapper()
	got, _ := mapper.MapProviderConfig("hunyuan", map[string]interface{}{
		"seed":     float64(12),
		"thinking": false,
		"citation": true,
	}, nil)

	if got["seed"] != 12 {
		t.Fatalf("expected integer seed, got %#v", got["seed"])
	}
	if got["enableThinking"] != false || got["enable_thinking"] != false {
		t.Fatalf("expected thinking aliases, got %#v", got)
	}
	if got["citation"] != true {
		t.Fatalf("expected citation=true, got %#v", got)
	}
}

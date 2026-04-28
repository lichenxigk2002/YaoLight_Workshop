package services

import (
	"context"
	"fmt"
	"strings"
)

const (
	defaultCodeNodeLanguage  = "javascript"
	defaultCodeNodeTimeoutMs = 3000
	maxCodeNodeTimeoutMs     = 10000
	maxCodeNodeLogLines      = 100
	maxCodeNodeLogLineLength = 2048
	maxCodeNodeResultBytes   = 256 * 1024
)

type CodeExecutionRequest struct {
	NodeID         string
	Language       string
	Source         string
	TimeoutMs      int
	InputMode      string
	Input          interface{}
	Variables      map[string]interface{}
	ConsoleEnabled bool
	RuntimeConfig  map[string]interface{}
}

type CodeExecutionResult struct {
	Result     interface{}            `json:"result"`
	Stdout     []string               `json:"stdout,omitempty"`
	Stderr     []string               `json:"stderr,omitempty"`
	DurationMs int64                  `json:"durationMs"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type CodeRuntime interface {
	Language() string
	Execute(ctx context.Context, req CodeExecutionRequest) (*CodeExecutionResult, error)
}

type CodeRuntimeRegistry struct {
	runtimes map[string]CodeRuntime
}

func NewCodeRuntimeRegistry() *CodeRuntimeRegistry {
	return &CodeRuntimeRegistry{
		runtimes: make(map[string]CodeRuntime),
	}
}

func NewDefaultCodeRuntimeRegistry() *CodeRuntimeRegistry {
	registry := NewCodeRuntimeRegistry()
	registry.Register(NewJavaScriptCodeRuntime())
	registry.Register(NewPythonCodeRuntime())
	return registry
}

func (r *CodeRuntimeRegistry) Register(runtime CodeRuntime) {
	if r == nil || runtime == nil {
		return
	}
	r.runtimes[strings.ToLower(runtime.Language())] = runtime
}

func (r *CodeRuntimeRegistry) Get(language string) (CodeRuntime, bool) {
	if r == nil {
		return nil, false
	}
	rt, ok := r.runtimes[strings.ToLower(strings.TrimSpace(language))]
	return rt, ok
}

func normalizeCodeNodeLanguage(raw string) string {
	language := strings.ToLower(strings.TrimSpace(raw))
	if language == "" {
		return defaultCodeNodeLanguage
	}
	return language
}

func normalizeCodeNodeTimeout(timeoutMs int) int {
	if timeoutMs <= 0 {
		return defaultCodeNodeTimeoutMs
	}
	if timeoutMs > maxCodeNodeTimeoutMs {
		return maxCodeNodeTimeoutMs
	}
	return timeoutMs
}

func unsupportedCodeRuntimeError(language string) error {
	return fmt.Errorf("%s runtime not enabled", normalizeCodeNodeLanguage(language))
}

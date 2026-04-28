package services

import (
	"context"
)

type PythonCodeRuntime struct{}

func NewPythonCodeRuntime() *PythonCodeRuntime {
	return &PythonCodeRuntime{}
}

func (r *PythonCodeRuntime) Language() string {
	return "python"
}

func (r *PythonCodeRuntime) Execute(ctx context.Context, req CodeExecutionRequest) (*CodeExecutionResult, error) {
	return nil, unsupportedCodeRuntimeError("python")
}

package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"time"
)

type JavaScriptCodeRuntime struct{}

func NewJavaScriptCodeRuntime() *JavaScriptCodeRuntime {
	return &JavaScriptCodeRuntime{}
}

func (r *JavaScriptCodeRuntime) Language() string {
	return "javascript"
}

func (r *JavaScriptCodeRuntime) Execute(ctx context.Context, req CodeExecutionRequest) (*CodeExecutionResult, error) {
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(req.TimeoutMs)*time.Millisecond)
	defer cancel()

	payload := map[string]interface{}{
		"input":            req.Input,
		"vars":             req.Variables,
		"source":           req.Source,
		"timeoutMs":        req.TimeoutMs,
		"consoleEnabled":   req.ConsoleEnabled,
		"runtimeConfig":    req.RuntimeConfig,
		"maxLogLines":      maxCodeNodeLogLines,
		"maxLogLineLength": maxCodeNodeLogLineLength,
		"maxResultBytes":   maxCodeNodeResultBytes,
		"node": map[string]interface{}{
			"id":       req.NodeID,
			"language": req.Language,
		},
	}
	inputBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	startedAt := time.Now()
	cmd := exec.CommandContext(timeoutCtx, "node", "-e", javaScriptNodeWrapper)
	cmd.Stdin = bytes.NewReader(inputBytes)
	var stdoutBuffer bytes.Buffer
	var stderrBuffer bytes.Buffer
	cmd.Stdout = &stdoutBuffer
	cmd.Stderr = &stderrBuffer
	err = cmd.Run()
	if err != nil {
		if timeoutCtx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("javascript runtime timed out after %dms", req.TimeoutMs)
		}
		if stderrBuffer.Len() > 0 {
			return nil, fmt.Errorf("javascript runtime failed: %s", stderrBuffer.String())
		}
		return nil, err
	}

	var result CodeExecutionResult
	decoder := json.NewDecoder(bytes.NewReader(stdoutBuffer.Bytes()))
	decoder.UseNumber()
	if err := decoder.Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode javascript runtime output: %w", err)
	}
	if result.DurationMs <= 0 {
		result.DurationMs = time.Since(startedAt).Milliseconds()
	}
	return &result, nil
}

var javaScriptNodeWrapper = `
const fs = require('node:fs');
const vm = require('node:vm');

const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
const startedAt = Date.now();
const stdout = [];

const consoleApi = {
  log: (...args) => {
    if (!payload.consoleEnabled) return;
    if (stdout.length >= payload.maxLogLines) return;
    let line = args.map((item) => {
      if (typeof item === 'string') return item;
      try {
        return JSON.stringify(item);
      } catch {
        return String(item);
      }
    }).join(' ');
    if (line.length > payload.maxLogLineLength) {
      line = line.slice(0, payload.maxLogLineLength) + '...(truncated)';
    }
    stdout.push(line);
  }
};

const ctx = {
  input: payload.input,
  vars: payload.vars,
  node: payload.node,
  console: consoleApi,
};

const strictPrefix = payload.runtimeConfig && payload.runtimeConfig.strictMode === false ? '' : '"use strict";\n';
const script = '(function(){\n' +
  'const input = ctx.input;\n' +
  'const vars = ctx.vars;\n' +
  'const node = ctx.node;\n' +
  'const console = ctx.console;\n' +
  strictPrefix + payload.source + '\n})()';

try {
  const result = vm.runInNewContext(script, { ctx }, {
    timeout: payload.timeoutMs,
    microtaskMode: 'afterEvaluate',
  });
  const serializedResult = JSON.stringify(result);
  if (serializedResult && Buffer.byteLength(serializedResult, 'utf8') > payload.maxResultBytes) {
    throw new Error('javascript result exceeds ' + payload.maxResultBytes + ' bytes');
  }
  process.stdout.write(JSON.stringify({
    result,
    stdout,
    stderr: [],
    durationMs: Date.now() - startedAt,
    metadata: {
      language: 'javascript',
    },
  }));
} catch (error) {
  process.stderr.write(error && error.message ? error.message : String(error));
  process.exit(1);
}
`

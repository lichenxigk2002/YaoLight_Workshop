package agentic

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// HookResult Hook 回调返回：是否允许继续、拒绝原因
type HookResult struct {
	Allow  bool   `json:"allow"`
	Reason string `json:"reason,omitempty"`
}

// Hook 事件名称常量
const (
	EventBeforeGenerate      = "BeforeGenerate"
	EventAfterGenerate       = "AfterGenerate"
	EventBeforeApplyWorkflow = "BeforeApplyWorkflow"
	EventOnWorkflowRunFailed = "OnWorkflowRunFailed"
)

// 环境变量名称
const (
	EnvBeforeGenerateURL      = "ALKAID_HOOK_BEFORE_GENERATE_URL"
	EnvAfterGenerateURL       = "ALKAID_HOOK_AFTER_GENERATE_URL"
	EnvBeforeApplyWorkflowURL = "ALKAID_HOOK_BEFORE_APPLY_WORKFLOW_URL"
	EnvOnWorkflowRunFailedURL = "ALKAID_HOOK_ON_WORKFLOW_RUN_FAILED_URL"
)

// BeforeGeneratePayload 生成前 Hook 的请求 body
type BeforeGeneratePayload struct {
	Event       string `json:"event"`
	SessionID   uint   `json:"sessionId"`
	UserID      uint   `json:"userId"`
	UserMessage string `json:"userMessage"`
}

// AfterGeneratePayload 生成后 Hook 的请求 body
type AfterGeneratePayload struct {
	Event     string                 `json:"event"`
	SessionID uint                   `json:"sessionId"`
	UserID    uint                   `json:"userId"`
	Workflow  map[string]interface{} `json:"workflow"`
}

// BeforeApplyWorkflowPayload 应用工作流前 Hook 的请求 body
type BeforeApplyWorkflowPayload struct {
	Event      string `json:"event"`
	SessionID  uint   `json:"sessionId"`
	WorkflowID uint   `json:"workflowId"`
	UserID     uint   `json:"userId"`
}

// OnWorkflowRunFailedPayload 工作流运行失败 Hook 的请求 body
type OnWorkflowRunFailedPayload struct {
	Event          string                 `json:"event"`
	SessionID      uint                   `json:"sessionId"`
	UserID         uint                   `json:"userId"`
	WorkflowID     uint                   `json:"workflowId,omitempty"`
	ExecutionError map[string]interface{} `json:"executionError"`
}

// callHook 通用 Hook 调用函数
func callHook(url string, payload interface{}, hookName string) (allow bool, reason string, err error) {
	if url == "" {
		// 未配置 Hook URL，默认允许继续
		return true, "", nil
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return false, "", fmt.Errorf("序列化 Hook payload 失败: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return false, "", fmt.Errorf("创建 Hook 请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		// Hook 调用失败，默认允许继续，但记录错误
		fmt.Printf("[Hook %s] 调用失败，默认允许继续: %v\n", hookName, err)
		return true, "", nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// 非 200 状态码，默认允许继续
		fmt.Printf("[Hook %s] 返回非 200 状态码 %d，默认允许继续\n", hookName, resp.StatusCode)
		return true, "", nil
	}

	var result HookResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		// 解析失败，默认允许继续
		fmt.Printf("[Hook %s] 解析返回失败，默认允许继续: %v\n", hookName, err)
		return true, "", nil
	}

	if !result.Allow {
		return false, result.Reason, nil
	}
	return true, "", nil
}

// CallBeforeGenerate 调用 BeforeGenerate Hook（生成前）
func CallBeforeGenerate(sessionID, userID uint, userMessage string) (allow bool, reason string, err error) {
	url := os.Getenv(EnvBeforeGenerateURL)
	payload := BeforeGeneratePayload{
		Event:       EventBeforeGenerate,
		SessionID:   sessionID,
		UserID:      userID,
		UserMessage: userMessage,
	}
	return callHook(url, payload, "BeforeGenerate")
}

// CallAfterGenerate 调用 AfterGenerate Hook（生成后）
func CallAfterGenerate(sessionID, userID uint, workflow map[string]interface{}) (allow bool, reason string, err error) {
	url := os.Getenv(EnvAfterGenerateURL)
	payload := AfterGeneratePayload{
		Event:     EventAfterGenerate,
		SessionID: sessionID,
		UserID:    userID,
		Workflow:  workflow,
	}
	return callHook(url, payload, "AfterGenerate")
}

// CallBeforeApplyWorkflow 调用 BeforeApplyWorkflow Hook（应用工作流前）
func CallBeforeApplyWorkflow(sessionID, workflowID, userID uint) (allow bool, reason string, err error) {
	url := os.Getenv(EnvBeforeApplyWorkflowURL)
	payload := BeforeApplyWorkflowPayload{
		Event:      EventBeforeApplyWorkflow,
		SessionID:  sessionID,
		WorkflowID: workflowID,
		UserID:     userID,
	}
	return callHook(url, payload, "BeforeApplyWorkflow")
}

// CallOnWorkflowRunFailed 调用 OnWorkflowRunFailed Hook（工作流运行失败时）
func CallOnWorkflowRunFailed(sessionID, userID, workflowID uint, executionError map[string]interface{}) (allow bool, reason string, err error) {
	url := os.Getenv(EnvOnWorkflowRunFailedURL)
	payload := OnWorkflowRunFailedPayload{
		Event:          EventOnWorkflowRunFailed,
		SessionID:      sessionID,
		UserID:         userID,
		WorkflowID:     workflowID,
		ExecutionError: executionError,
	}
	return callHook(url, payload, "OnWorkflowRunFailed")
}

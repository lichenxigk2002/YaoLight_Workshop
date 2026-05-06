package services

import (
	"strings"
	"testing"

	"gorm.io/gorm"
	"yaolight-workshop/backend/domain/entity"
)

type stubUserRepo struct {
	balance int64
	err     error
}

func (s *stubUserRepo) Create(user *entity.User) error                       { return nil }
func (s *stubUserRepo) CreateWithDB(db *gorm.DB, user *entity.User) error    { return nil }
func (s *stubUserRepo) FindByID(id uint) (*entity.User, error)               { return nil, nil }
func (s *stubUserRepo) FindByUserNo(userNo int64) (*entity.User, error)      { return nil, nil }
func (s *stubUserRepo) FindByUsername(username string) (*entity.User, error) { return nil, nil }
func (s *stubUserRepo) FindByEmail(email string) (*entity.User, error)       { return nil, nil }
func (s *stubUserRepo) EmailTakenByOther(email string, excludeUserID uint) (bool, error) {
	return false, nil
}
func (s *stubUserRepo) FindByUsernameOrEmail(username, email string) (*entity.User, error) {
	return nil, nil
}
func (s *stubUserRepo) FindByOAuth(provider, oauthID string) (*entity.User, error)      { return nil, nil }
func (s *stubUserRepo) Update(user *entity.User) error                                  { return nil }
func (s *stubUserRepo) Delete(id uint) error                                            { return nil }
func (s *stubUserRepo) DeductTokens(userID uint, amount int64) error                    { return nil }
func (s *stubUserRepo) DeductTokensWithDB(db *gorm.DB, userID uint, amount int64) error { return nil }
func (s *stubUserRepo) GetTokenBalance(userID uint) (int64, error)                      { return s.balance, s.err }

func TestValidateExecutionRequestBlocksSystemAIWhenBalanceNotPositive(t *testing.T) {
	exec := &WorkflowExecutor{userRepo: &stubUserRepo{balance: 0}}
	req := ExecutionRequest{
		UserID: 7,
		Nodes: []NodeConfig{
			{ID: "ai-1", Type: "ai", Config: map[string]interface{}{"prompt": "hello", "modelMode": "system"}},
		},
	}

	err := exec.ValidateExecutionRequest(req)
	if err == nil {
		t.Fatal("expected insufficient balance error")
	}
	if !IsInsufficientTokenBalanceError(err) {
		t.Fatalf("expected insufficient balance sentinel, got %v", err)
	}
}

func TestValidateExecutionRequestSkipsNonSystemAI(t *testing.T) {
	exec := &WorkflowExecutor{userRepo: &stubUserRepo{balance: 0}}
	req := ExecutionRequest{
		UserID: 7,
		Nodes: []NodeConfig{
			{ID: "ai-1", Type: "ai", Config: map[string]interface{}{"prompt": "hello", "modelMode": "saved"}},
			{ID: "code-1", Type: "code", Config: map[string]interface{}{}},
		},
	}

	if err := exec.ValidateExecutionRequest(req); err != nil {
		t.Fatalf("expected non-system workflow to bypass balance check, got %v", err)
	}
}

func TestValidateExecutionRequestSkipsInactiveSystemAIBranchOnResume(t *testing.T) {
	exec := &WorkflowExecutor{userRepo: &stubUserRepo{balance: 0}}
	req := ExecutionRequest{
		UserID: 7,
		Nodes: []NodeConfig{
			{ID: "start", Type: "start", Config: map[string]interface{}{}},
			{ID: "cond", Type: "condition", Config: map[string]interface{}{}},
			{ID: "true-delay", Type: "delay", Config: map[string]interface{}{"seconds": 0}},
			{ID: "false-ai", Type: "ai", Config: map[string]interface{}{"modelMode": "system"}},
		},
		Edges: []EdgeConfig{
			{Source: "start", Target: "cond"},
			{Source: "cond", Target: "true-delay", SourceHandle: "true"},
			{Source: "cond", Target: "false-ai", SourceHandle: "false"},
		},
		ResumeState: &ResumeExecutionState{
			Mode:         "resume_failed",
			SourceTaskID: 1,
			ReusedNodes: map[string]ResumeNodeState{
				"start": {OutputData: map[string]interface{}{"flag": true}, HasOutputData: true},
				"cond":  {OutputData: map[string]interface{}{"result": true}, HasOutputData: true},
			},
		},
	}

	if err := exec.ValidateExecutionRequest(req); err != nil {
		t.Fatalf("expected inactive false branch to be ignored during preflight, got %v", err)
	}
}

func TestExecuteAINodeBlocksBeforeProviderCallWhenBalanceNotPositive(t *testing.T) {
	exec := &WorkflowExecutor{userRepo: &stubUserRepo{balance: 0}}
	result := exec.executeAINode(
		NodeConfig{
			ID:     "ai-1",
			Type:   "ai",
			Config: map[string]interface{}{"prompt": "hello"},
		},
		NewDataFlow(nil),
		NewVariableContext(),
		7,
	)

	if result.Success {
		t.Fatalf("expected failure, got %#v", result)
	}
	if !strings.Contains(result.Error, insufficientTokenBalanceMessage) {
		t.Fatalf("expected insufficient balance message, got %q", result.Error)
	}
}

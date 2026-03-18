package agentic

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	alkaidModels "yaolight-workshop/backend/modules/alkaid/models"
	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

type SSEWriter struct {
	ctx                *gin.Context
	flush              func() error
	closed             bool
	sessionID          uint
	currentPhase       string
	userMessageID      uint
	userMessageContent string
	toolSteps          []alkaidModels.AgentToolStep
	planSteps          []alkaidModels.AgentPlanStep
}

func NewSSEWriter(ctx *gin.Context, sessionID uint, userMessageID uint, userMessageContent string) *SSEWriter {
	ctx.Header("Content-Type", "text/event-stream")
	ctx.Header("Cache-Control", "no-cache")
	ctx.Header("Connection", "keep-alive")
	ctx.Header("X-Accel-Buffering", "no")

	var flush func() error
	if f, ok := ctx.Writer.(http.Flusher); ok {
		flush = func() error { f.Flush(); return nil }
	} else {
		flush = func() error { return nil }
	}

	return &SSEWriter{
		ctx:                ctx,
		flush:              flush,
		sessionID:          sessionID,
		userMessageID:      userMessageID,
		userMessageContent: userMessageContent,
		toolSteps:          make([]alkaidModels.AgentToolStep, 0, 50),
		planSteps:          make([]alkaidModels.AgentPlanStep, 0, 12),
	}
}

func (w *SSEWriter) writeEvent(event string, data interface{}) error {
	if w.closed {
		return nil
	}
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	_, _ = w.ctx.Writer.WriteString("event: " + event + "\n")
	_, _ = w.ctx.Writer.WriteString("data: " + string(payload) + "\n\n")
	return w.flush()
}

func (w *SSEWriter) WriteContent(delta string) error {
	return w.writeEvent("content", alkaidModels.SSEContent{Delta: delta})
}

func (w *SSEWriter) WritePhaseChanged(phase string) error {
	w.currentPhase = phase
	return w.writeEvent("phase_changed", alkaidModels.SSEPhaseChanged{
		Phase: phase,
		At:    time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) WritePlanCreated(steps []alkaidModels.AgentPlanStep) error {
	w.planSteps = append([]alkaidModels.AgentPlanStep(nil), steps...)
	return w.writeEvent("plan_created", alkaidModels.SSEPlanCreated{Steps: steps})
}

func (w *SSEWriter) WritePlanStepStarted(step alkaidModels.AgentPlanStep) error {
	now := time.Now().UTC()
	step.UserMessageID = w.userMessageID
	step.UserMessageContent = w.userMessageContent
	step.StartedAt = now
	step.Status = alkaidModels.PlanStepRunning

	found := false
	for i := range w.planSteps {
		if w.planSteps[i].PlanStepID == step.PlanStepID {
			w.planSteps[i] = step
			found = true
			break
		}
	}
	if !found {
		w.planSteps = append(w.planSteps, step)
	}

	return w.writeEvent("plan_step_started", alkaidModels.SSEPlanStepStarted{
		PlanStepID:         step.PlanStepID,
		UserMessageID:      step.UserMessageID,
		UserMessageContent: step.UserMessageContent,
		Phase:              step.Phase,
		Source:             step.Source,
		Title:              step.Title,
		Reason:             step.Reason,
		ExpectedOutput:     step.ExpectedOutput,
		ToolHints:          step.ToolHints,
		Status:             step.Status,
		At:                 now.Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) WritePlanStepUpdated(step alkaidModels.AgentPlanStep) error {
	now := time.Now().UTC()
	found := false
	for i := range w.planSteps {
		if w.planSteps[i].PlanStepID == step.PlanStepID {
			if step.UserMessageID == 0 {
				step.UserMessageID = w.planSteps[i].UserMessageID
			}
			if step.UserMessageContent == "" {
				step.UserMessageContent = w.planSteps[i].UserMessageContent
			}
			if step.StartedAt.IsZero() {
				step.StartedAt = w.planSteps[i].StartedAt
			}
			if step.Phase == "" {
				step.Phase = w.planSteps[i].Phase
			}
			if step.Source == "" {
				step.Source = w.planSteps[i].Source
			}
			if step.Title == "" {
				step.Title = w.planSteps[i].Title
			}
			if step.Reason == "" {
				step.Reason = w.planSteps[i].Reason
			}
			if step.ExpectedOutput == "" {
				step.ExpectedOutput = w.planSteps[i].ExpectedOutput
			}
			if len(step.ToolHints) == 0 {
				step.ToolHints = w.planSteps[i].ToolHints
			}
			if step.Status == "" {
				step.Status = w.planSteps[i].Status
			}
			if step.ResultSummary == "" {
				step.ResultSummary = w.planSteps[i].ResultSummary
			}
			if step.ErrorMessage == "" {
				step.ErrorMessage = w.planSteps[i].ErrorMessage
			}
			if step.FinishedAt == nil {
				step.FinishedAt = w.planSteps[i].FinishedAt
			}
			w.planSteps[i] = step
			found = true
			break
		}
	}
	if !found {
		step.UserMessageID = w.userMessageID
		step.UserMessageContent = w.userMessageContent
		if step.StartedAt.IsZero() {
			step.StartedAt = now
		}
		w.planSteps = append(w.planSteps, step)
	}

	return w.writeEvent("plan_step_updated", alkaidModels.SSEPlanStepUpdated{
		PlanStepID:     step.PlanStepID,
		Phase:          step.Phase,
		Source:         step.Source,
		Title:          step.Title,
		Reason:         step.Reason,
		ExpectedOutput: step.ExpectedOutput,
		ToolHints:      step.ToolHints,
		Status:         step.Status,
		ResultSummary:  step.ResultSummary,
		ErrorMessage:   step.ErrorMessage,
		At:             now.Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) WritePlanStepFinished(planStepID, status, resultSummary, errorMessage string) error {
	now := time.Now().UTC()
	for i := range w.planSteps {
		if w.planSteps[i].PlanStepID == planStepID {
			w.planSteps[i].Status = status
			w.planSteps[i].FinishedAt = &now
			w.planSteps[i].ResultSummary = resultSummary
			w.planSteps[i].ErrorMessage = errorMessage
			break
		}
	}
	return w.writeEvent("plan_step_finished", alkaidModels.SSEPlanStepFinished{
		PlanStepID:    planStepID,
		Status:        status,
		ResultSummary: resultSummary,
		ErrorMessage:  errorMessage,
		At:            now.Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) WriteToolStepStarted(stepID, toolName, phase string) error {
	return w.WriteToolStepStartedWithPlan(stepID, toolName, phase, "")
}

func (w *SSEWriter) WriteToolStepStartedWithPlan(stepID, toolName, phase, planStepID string) error {
	now := time.Now().UTC()
	step := alkaidModels.AgentToolStep{
		StepID:             stepID,
		PlanStepID:         planStepID,
		UserMessageID:      w.userMessageID,
		UserMessageContent: w.userMessageContent,
		Phase:              phase,
		ToolName:           toolName,
		Status:             alkaidModels.ToolStepRunning,
		StartedAt:          now,
	}
	w.toolSteps = append(w.toolSteps, step)

	return w.writeEvent("tool_step_started", alkaidModels.SSEToolStepStarted{
		StepID:             stepID,
		PlanStepID:         planStepID,
		UserMessageID:      w.userMessageID,
		UserMessageContent: w.userMessageContent,
		ToolName:           toolName,
		Phase:              phase,
		At:                 now.Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) WriteToolStepFinished(stepID, status, resultSummary, errorMessage string) error {
	now := time.Now().UTC()
	for i := range w.toolSteps {
		if w.toolSteps[i].StepID == stepID {
			w.toolSteps[i].Status = status
			w.toolSteps[i].FinishedAt = &now
			w.toolSteps[i].ResultSummary = resultSummary
			if errorMessage != "" {
				w.toolSteps[i].ErrorMessage = errorMessage
			}
			break
		}
	}
	return w.writeEvent("tool_step_finished", alkaidModels.SSEToolStepFinished{
		StepID:        stepID,
		Status:        status,
		ResultSummary: resultSummary,
		ErrorMessage:  errorMessage,
		At:            now.Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) WritePendingWorkflow(nodeCount, edgeCount int) error {
	data := alkaidModels.SSEPendingWorkflow{}
	data.Summary.NodeCount = nodeCount
	data.Summary.EdgeCount = edgeCount
	return w.writeEvent("pending_workflow", data)
}

func (w *SSEWriter) WritePendingPatch(patchCount int) error {
	return w.writeEvent("pending_patch", alkaidModels.SSEPendingPatch{PatchCount: patchCount})
}

func (w *SSEWriter) WriteDone() error {
	return w.writeEvent("done", alkaidModels.SSEDone{})
}

func (w *SSEWriter) WriteError(message string) error {
	return w.writeEvent("error", alkaidModels.SSEError{Message: message})
}

func (w *SSEWriter) WriteInterrupted() error {
	return w.writeEvent("interrupted", alkaidModels.SSEInterrupted{
		At: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (w *SSEWriter) SaveProgressToSession() error {
	if w.sessionID == 0 {
		return nil
	}

	repo := alkaidRepos.NewAlkaidRepository()
	session, err := repo.GetSessionByID(w.sessionID)
	if err != nil {
		return err
	}

	var existingToolSteps []alkaidModels.AgentToolStep
	if session.ToolStepsJSON.Data != nil {
		if stepsData, ok := session.ToolStepsJSON.Data.([]interface{}); ok {
			for _, raw := range stepsData {
				if stepMap, ok := raw.(map[string]interface{}); ok {
					existingToolSteps = append(existingToolSteps, mapToAgentToolStep(stepMap))
				}
			}
		}
	}

	if len(w.toolSteps) > 0 {
		allToolSteps := append(existingToolSteps, w.toolSteps...)
		if len(allToolSteps) > 100 {
			allToolSteps = allToolSteps[len(allToolSteps)-100:]
		}
		session.ToolStepsJSON.Data = allToolSteps
	}

	var existingPlanSteps []alkaidModels.AgentPlanStep
	if session.PlanStepsJSON.Data != nil {
		if stepsData, ok := session.PlanStepsJSON.Data.([]interface{}); ok {
			for _, raw := range stepsData {
				if stepMap, ok := raw.(map[string]interface{}); ok {
					existingPlanSteps = append(existingPlanSteps, mapToAgentPlanStep(stepMap))
				}
			}
		}
	}

	if len(w.planSteps) > 0 {
		allPlanSteps := append(existingPlanSteps, w.planSteps...)
		if len(allPlanSteps) > 100 {
			allPlanSteps = allPlanSteps[len(allPlanSteps)-100:]
		}
		session.PlanStepsJSON.Data = allPlanSteps
	}

	if w.currentPhase != "" {
		session.CurrentPhase = w.currentPhase
	}

	return repo.UpdateSession(session)
}

func mapToAgentToolStep(m map[string]interface{}) alkaidModels.AgentToolStep {
	step := alkaidModels.AgentToolStep{}
	if v, ok := m["stepId"].(string); ok {
		step.StepID = v
	}
	if v, ok := m["planStepId"].(string); ok {
		step.PlanStepID = v
	}
	if v, ok := m["userMessageId"].(float64); ok {
		step.UserMessageID = uint(v)
	}
	if v, ok := m["userMessageContent"].(string); ok {
		step.UserMessageContent = v
	}
	if v, ok := m["phase"].(string); ok {
		step.Phase = v
	}
	if v, ok := m["toolName"].(string); ok {
		step.ToolName = v
	}
	if v, ok := m["status"].(string); ok {
		step.Status = v
	}
	if v, ok := m["startedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			step.StartedAt = t
		}
	}
	if v, ok := m["finishedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			step.FinishedAt = &t
		}
	}
	if v, ok := m["resultSummary"].(string); ok {
		step.ResultSummary = v
	}
	if v, ok := m["errorMessage"].(string); ok {
		step.ErrorMessage = v
	}
	return step
}

func mapToAgentPlanStep(m map[string]interface{}) alkaidModels.AgentPlanStep {
	step := alkaidModels.AgentPlanStep{}
	if v, ok := m["planStepId"].(string); ok {
		step.PlanStepID = v
	}
	if v, ok := m["userMessageId"].(float64); ok {
		step.UserMessageID = uint(v)
	}
	if v, ok := m["userMessageContent"].(string); ok {
		step.UserMessageContent = v
	}
	if v, ok := m["phase"].(string); ok {
		step.Phase = v
	}
	if v, ok := m["source"].(string); ok {
		step.Source = v
	}
	if v, ok := m["title"].(string); ok {
		step.Title = v
	}
	if v, ok := m["reason"].(string); ok {
		step.Reason = v
	}
	if v, ok := m["expectedOutput"].(string); ok {
		step.ExpectedOutput = v
	}
	if hints, ok := m["toolHints"].([]interface{}); ok {
		toolHints := make([]string, 0, len(hints))
		for _, raw := range hints {
			if hint, ok := raw.(string); ok {
				toolHints = append(toolHints, hint)
			}
		}
		step.ToolHints = toolHints
	}
	if v, ok := m["status"].(string); ok {
		step.Status = v
	}
	if v, ok := m["startedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			step.StartedAt = t
		}
	}
	if v, ok := m["finishedAt"].(string); ok {
		if t, err := time.Parse(time.RFC3339Nano, v); err == nil {
			step.FinishedAt = &t
		}
	}
	if v, ok := m["resultSummary"].(string); ok {
		step.ResultSummary = v
	}
	if v, ok := m["errorMessage"].(string); ok {
		step.ErrorMessage = v
	}
	return step
}

func (w *SSEWriter) Close() {
	if w.closed {
		return
	}
	_ = w.SaveProgressToSession()
	w.closed = true
}

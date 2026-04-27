package agentic

import (
	"context"
	"fmt"
	"sync"
)

type sessionRunHandle struct {
	cancel context.CancelFunc
	done   chan struct{}
}

type sessionRunManager struct {
	mu   sync.Mutex
	runs map[uint]sessionRunHandle
}

var globalSessionRunManager = &sessionRunManager{
	runs: make(map[uint]sessionRunHandle),
}

func (m *sessionRunManager) Start(sessionID uint) (context.Context, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if _, exists := m.runs[sessionID]; exists {
		return nil, fmt.Errorf("当前会话仍在处理中，请稍后或先停止当前任务")
	}

	ctx, cancel := context.WithCancel(context.Background())
	m.runs[sessionID] = sessionRunHandle{cancel: cancel, done: make(chan struct{})}
	return ctx, nil
}

func (m *sessionRunManager) Stop(sessionID uint) (<-chan struct{}, bool) {
	m.mu.Lock()
	run, exists := m.runs[sessionID]
	m.mu.Unlock()
	if !exists {
		return nil, false
	}

	run.cancel()
	return run.done, true
}

func (m *sessionRunManager) Finish(sessionID uint) {
	m.mu.Lock()
	run, exists := m.runs[sessionID]
	if exists {
		delete(m.runs, sessionID)
	}
	m.mu.Unlock()

	if exists {
		close(run.done)
		run.cancel()
	}
}

func (m *sessionRunManager) IsRunning(sessionID uint) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, exists := m.runs[sessionID]
	return exists
}

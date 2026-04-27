package agentic

import (
	"fmt"
	"time"

	alkaidRepos "yaolight-workshop/backend/modules/alkaid/repositories"
)

type InterruptSessionRequest struct {
	SessionID uint
	UserID    uint
}

func InterruptSession(req InterruptSessionRequest) error {
	repo := alkaidRepos.NewAlkaidRepository()
	session, err := repo.GetSessionByID(req.SessionID)
	if err != nil {
		return err
	}
	if session.UserID != req.UserID {
		return fmt.Errorf("无权操作该会话")
	}

	doneCh, ok := globalSessionRunManager.Stop(req.SessionID)
	if !ok {
		return fmt.Errorf("当前会话没有正在运行的任务")
	}

	select {
	case <-doneCh:
		return nil
	case <-time.After(8 * time.Second):
		return fmt.Errorf("停止任务超时，请稍后重试")
	}
}

package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

// Task 任务持久化实体
type Task struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	WorkflowID        uint           `gorm:"not null;index" json:"workflowId"`
	UserID            uint           `gorm:"not null;index" json:"userId"`
	ScheduleID        *uint          `gorm:"index" json:"scheduleId"`
	Name              *string        `gorm:"type:varchar(200)" json:"name"`
	Status            string         `gorm:"type:varchar(20);default:'pending';index;check:status IN ('pending','queued','running','paused','completed','failed','cancelled','timeout')" json:"status"`
	Priority          int            `gorm:"default:5;check:priority >= 1 AND priority <= 10" json:"priority"`
	Progress          int            `gorm:"default:0;check:progress >= 0 AND progress <= 100" json:"progress"`
	InputData         *shared.JSONB  `gorm:"type:jsonb" json:"inputData"`
	Result            *shared.JSONB  `gorm:"type:jsonb" json:"result"`
	ErrorMessage      *string        `gorm:"type:text" json:"errorMessage"`
	ErrorStack        *string        `gorm:"type:text" json:"errorStack"`
	RetryCount        int            `gorm:"default:0" json:"retryCount"`
	MaxRetries        int            `gorm:"default:0" json:"maxRetries"`
	RetryConfig       *shared.JSONB  `gorm:"type:jsonb" json:"retryConfig"`
	Timeout           *int           `json:"timeout"`
	EstimatedDuration *int           `json:"estimatedDuration"`
	ActualDuration    *int           `json:"actualDuration"`
	ResourceUsage     *shared.JSONB  `gorm:"type:jsonb" json:"resourceUsage"`
	ExecutionContext  *shared.JSONB  `gorm:"type:jsonb" json:"executionContext"`
	Tags              shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"tags"`
	Metadata          *shared.JSONB  `gorm:"type:jsonb" json:"metadata"`
	StartedAt         *time.Time     `json:"startedAt"`
	CompletedAt       *time.Time     `json:"completedAt"`
	CancelledAt       *time.Time     `json:"cancelledAt"`
	CancelledBy       *uint          `gorm:"index" json:"cancelledBy"`
	CreatedAt         time.Time      `json:"createdAt"`
	UpdatedAt         time.Time      `json:"updatedAt"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Task) TableName() string {
	return "tasks"
}

// TaskNodeExecution 任务节点执行记录持久化实体
type TaskNodeExecution struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	TaskID        uint          `gorm:"not null;index" json:"taskId"`
	NodeID        string        `gorm:"type:varchar(100);not null" json:"nodeId"`
	NodeType      string        `gorm:"type:varchar(50);not null" json:"nodeType"`
	Status        string        `gorm:"type:varchar(20);not null;index;check:status IN ('pending','running','completed','failed','skipped','timeout','cancelled')" json:"status"`
	InputData     *shared.JSONB `gorm:"type:jsonb" json:"inputData"`
	OutputData    *shared.JSONB `gorm:"type:jsonb" json:"outputData"`
	ErrorMessage  *string       `gorm:"type:text" json:"errorMessage"`
	ErrorStack    *string       `gorm:"type:text" json:"errorStack"`
	ExecutionTime *int          `json:"executionTime"`
	RetryCount    int           `gorm:"default:0" json:"retryCount"`
	ResourceUsage *shared.JSONB `gorm:"type:jsonb" json:"resourceUsage"`
	StartedAt     *time.Time    `json:"startedAt"`
	CompletedAt   *time.Time    `json:"completedAt"`
	CreatedAt     time.Time     `json:"createdAt"`
}

// TableName 指定表名
func (TaskNodeExecution) TableName() string {
	return "task_node_executions"
}

// TaskLog 任务日志持久化实体
type TaskLog struct {
	ID         uint          `gorm:"primaryKey" json:"id"`
	TaskID     uint          `gorm:"not null;index" json:"taskId"`
	NodeID     *string       `gorm:"type:varchar(100);index" json:"nodeId"`
	Level      string        `gorm:"type:varchar(20);not null;index;check:level IN ('debug','info','warn','error','fatal')" json:"level"`
	Message    string        `gorm:"type:text;not null" json:"message"`
	Metadata   *shared.JSONB `gorm:"type:jsonb" json:"metadata"`
	StackTrace *string       `gorm:"type:text" json:"stackTrace"`
	CreatedAt  time.Time     `gorm:"index" json:"createdAt"`
}

// TableName 指定表名
func (TaskLog) TableName() string {
	return "task_logs"
}

// TaskSchedule 任务调度持久化实体
type TaskSchedule struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	WorkflowID         uint           `gorm:"not null;index" json:"workflow_id"`
	UserID             uint           `gorm:"not null;index" json:"user_id"`
	Name               string         `gorm:"type:varchar(200);not null" json:"name"`
	Description        *string        `gorm:"type:text" json:"description"`
	TriggerType        string         `gorm:"type:varchar(20);not null;default:'cron';index" json:"trigger_type"`
	CronExpression     string         `gorm:"type:varchar(100);not null" json:"cron_expression"`
	Timezone           string         `gorm:"type:varchar(50);default:'UTC'" json:"timezone"`
	IsActive           bool           `gorm:"default:true;index" json:"is_active"`
	StartDate          *time.Time     `json:"start_date"`
	EndDate            *time.Time     `json:"end_date"`
	MaxRuns            *int           `json:"max_runs"`
	RunCount           int            `gorm:"default:0" json:"run_count"`
	NextRunAt          *time.Time     `gorm:"index" json:"next_run_at"`
	LastRunAt          *time.Time     `json:"last_run_at"`
	LastRunStatus      *string        `gorm:"type:varchar(20)" json:"last_run_status"`
	WebhookToken       *string        `gorm:"type:varchar(120);uniqueIndex" json:"webhook_token"`
	WebhookSecretHash  *string        `gorm:"type:varchar(128)" json:"-"`
	WebhookSecretEnc   *string        `gorm:"column:webhook_secret_encrypted;type:text" json:"-"`
	LastErrorMessage   *string        `gorm:"type:text" json:"last_error_message"`
	RetryPolicy        *shared.JSONB  `gorm:"type:jsonb" json:"retry_policy"`
	InputTemplate      *shared.JSONB  `gorm:"type:jsonb" json:"input_template"`
	LastTriggerRequest *string        `gorm:"column:last_trigger_request_id;type:varchar(120)" json:"last_trigger_request_id"`
	Config             *shared.JSONB  `gorm:"type:jsonb" json:"config"`
	NotificationConfig *shared.JSONB  `gorm:"type:jsonb" json:"notification_config"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (TaskSchedule) TableName() string {
	return "task_schedules"
}

// TaskScheduleRun 计划执行记录
type TaskScheduleRun struct {
	ID           uint           `gorm:"primaryKey" json:"id"`
	ScheduleID   uint           `gorm:"not null;index" json:"schedule_id"`
	WorkflowID   uint           `gorm:"not null;index" json:"workflow_id"`
	UserID       uint           `gorm:"not null;index" json:"user_id"`
	TriggerType  string         `gorm:"type:varchar(20);not null;index" json:"trigger_type"`
	TriggerKey   string         `gorm:"type:varchar(200);not null" json:"trigger_key"`
	RequestID    *string        `gorm:"type:varchar(120)" json:"request_id"`
	Status       string         `gorm:"type:varchar(20);not null;default:'queued';index" json:"status"`
	TaskID       *uint          `gorm:"index" json:"task_id"`
	AttemptCount int            `gorm:"not null;default:0" json:"attempt_count"`
	ErrorMessage *string        `gorm:"type:text" json:"error_message"`
	InputPayload *shared.JSONB  `gorm:"type:jsonb" json:"input_payload"`
	Metadata     *shared.JSONB  `gorm:"type:jsonb" json:"metadata"`
	TriggeredAt  time.Time      `gorm:"not null;index" json:"triggered_at"`
	FinishedAt   *time.Time     `json:"finished_at"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}

func (TaskScheduleRun) TableName() string {
	return "task_schedule_runs"
}

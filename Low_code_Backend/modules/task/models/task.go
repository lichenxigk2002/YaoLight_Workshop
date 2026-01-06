package models

import (
	"time"

	"gorm.io/gorm"
	"workflow-management-system/backend/infrastructure/shared"
)

// Task 任务持久化实体
type Task struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	WorkflowID        uint           `gorm:"not null;index" json:"workflow_id"`
	UserID            uint           `gorm:"not null;index" json:"user_id"`
	ScheduleID        *uint          `gorm:"index" json:"schedule_id"`
	Name              *string        `gorm:"type:varchar(200)" json:"name"`
	Status            string         `gorm:"type:varchar(20);default:'pending';index;check:status IN ('pending','queued','running','paused','completed','failed','cancelled','timeout')" json:"status"`
	Priority          int            `gorm:"default:5;check:priority >= 1 AND priority <= 10" json:"priority"`
	Progress          int            `gorm:"default:0;check:progress >= 0 AND progress <= 100" json:"progress"`
	InputData         *shared.JSONB  `gorm:"type:jsonb" json:"input_data"`
	Result            *shared.JSONB  `gorm:"type:jsonb" json:"result"`
	ErrorMessage      *string        `gorm:"type:text" json:"error_message"`
	ErrorStack        *string        `gorm:"type:text" json:"error_stack"`
	RetryCount        int            `gorm:"default:0" json:"retry_count"`
	MaxRetries        int            `gorm:"default:0" json:"max_retries"`
	RetryConfig       *shared.JSONB  `gorm:"type:jsonb" json:"retry_config"`
	Timeout           *int           `json:"timeout"`
	EstimatedDuration *int           `json:"estimated_duration"`
	ActualDuration    *int           `json:"actual_duration"`
	ResourceUsage     *shared.JSONB  `gorm:"type:jsonb" json:"resource_usage"`
	ExecutionContext  *shared.JSONB  `gorm:"type:jsonb" json:"execution_context"`
	Tags              shared.JSONB   `gorm:"type:jsonb;default:'[]'" json:"tags"`
	Metadata          *shared.JSONB  `gorm:"type:jsonb" json:"metadata"`
	StartedAt         *time.Time     `json:"started_at"`
	CompletedAt       *time.Time     `json:"completed_at"`
	CancelledAt       *time.Time     `json:"cancelled_at"`
	CancelledBy       *uint          `gorm:"index" json:"cancelled_by"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `gorm:"index" json:"-"`
}

// TableName 指定表名
func (Task) TableName() string {
	return "tasks"
}

// TaskNodeExecution 任务节点执行记录持久化实体
type TaskNodeExecution struct {
	ID            uint          `gorm:"primaryKey" json:"id"`
	TaskID        uint          `gorm:"not null;index" json:"task_id"`
	NodeID        string        `gorm:"type:varchar(100);not null" json:"node_id"`
	NodeType      string        `gorm:"type:varchar(50);not null" json:"node_type"`
	Status        string        `gorm:"type:varchar(20);not null;index;check:status IN ('pending','running','completed','failed','skipped','timeout')" json:"status"`
	InputData     *shared.JSONB `gorm:"type:jsonb" json:"input_data"`
	OutputData    *shared.JSONB `gorm:"type:jsonb" json:"output_data"`
	ErrorMessage  *string       `gorm:"type:text" json:"error_message"`
	ErrorStack    *string       `gorm:"type:text" json:"error_stack"`
	ExecutionTime *int          `json:"execution_time"`
	RetryCount    int           `gorm:"default:0" json:"retry_count"`
	ResourceUsage *shared.JSONB `gorm:"type:jsonb" json:"resource_usage"`
	StartedAt     *time.Time    `json:"started_at"`
	CompletedAt   *time.Time    `json:"completed_at"`
	CreatedAt     time.Time     `json:"created_at"`
}

// TableName 指定表名
func (TaskNodeExecution) TableName() string {
	return "task_node_executions"
}

// TaskLog 任务日志持久化实体
type TaskLog struct {
	ID         uint          `gorm:"primaryKey" json:"id"`
	TaskID     uint          `gorm:"not null;index" json:"task_id"`
	NodeID     *string       `gorm:"type:varchar(100);index" json:"node_id"`
	Level      string        `gorm:"type:varchar(20);not null;index;check:level IN ('debug','info','warn','error','fatal')" json:"level"`
	Message    string        `gorm:"type:text;not null" json:"message"`
	Metadata   *shared.JSONB `gorm:"type:jsonb" json:"metadata"`
	StackTrace *string       `gorm:"type:text" json:"stack_trace"`
	CreatedAt  time.Time     `gorm:"index" json:"created_at"`
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

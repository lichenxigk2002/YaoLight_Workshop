package models

import (
	"time"

	"gorm.io/gorm"
	"yaolight-workshop/backend/infrastructure/shared"
)

type WorkflowAPIEndpoint struct {
	ID                 uint           `gorm:"primaryKey" json:"id"`
	UserID             uint           `gorm:"not null;index" json:"userId"`
	ProjectID          *uint          `gorm:"index" json:"projectId,omitempty"`
	WorkflowID         uint           `gorm:"not null;uniqueIndex" json:"workflowId"`
	Name               string         `gorm:"type:varchar(200);not null" json:"name"`
	Slug               string         `gorm:"type:varchar(120);not null;uniqueIndex" json:"slug"`
	Description        *string        `gorm:"type:text" json:"description,omitempty"`
	Status             string         `gorm:"type:varchar(20);not null;default:'draft';index" json:"status"`
	ResponseMode       string         `gorm:"type:varchar(20);not null;default:'wait'" json:"responseMode"`
	ResultMode         string         `gorm:"type:varchar(20);not null;default:'json'" json:"resultMode"`
	RequestSchema      *shared.JSONB  `gorm:"type:jsonb" json:"requestSchema,omitempty"`
	InputMapping       *shared.JSONB  `gorm:"type:jsonb" json:"inputMapping,omitempty"`
	ResponseSchema     *shared.JSONB  `gorm:"type:jsonb" json:"responseSchema,omitempty"`
	OutputMapping      *shared.JSONB  `gorm:"type:jsonb" json:"outputMapping,omitempty"`
	ExposeArtifacts    string         `gorm:"type:varchar(20);not null;default:'all'" json:"exposeArtifacts"`
	ExposedArtifactIDs *shared.JSONB  `gorm:"type:jsonb" json:"exposedArtifactNodeIds,omitempty"`
	WaitTimeoutSeconds int            `gorm:"not null;default:15" json:"waitTimeoutSeconds"`
	RequestExample     *shared.JSONB  `gorm:"type:jsonb" json:"requestExample,omitempty"`
	ResponseExample    *shared.JSONB  `gorm:"type:jsonb" json:"responseExample,omitempty"`
	PublishedAt        *time.Time     `json:"publishedAt,omitempty"`
	CreatedAt          time.Time      `json:"createdAt"`
	UpdatedAt          time.Time      `json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WorkflowAPIEndpoint) TableName() string {
	return "workflow_api_endpoints"
}

type WorkflowAPIKey struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	EndpointID uint           `gorm:"not null;index" json:"endpointId"`
	Name       string         `gorm:"type:varchar(120);not null" json:"name"`
	KeyPrefix  string         `gorm:"type:varchar(20);not null;index" json:"keyPrefix"`
	KeyHash    string         `gorm:"type:varchar(255);not null" json:"-"`
	Status     string         `gorm:"type:varchar(20);not null;default:'active';index" json:"status"`
	ExpiresAt  *time.Time     `json:"expiresAt,omitempty"`
	LastUsedAt *time.Time     `json:"lastUsedAt,omitempty"`
	CreatedAt  time.Time      `json:"createdAt"`
	UpdatedAt  time.Time      `json:"updatedAt"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WorkflowAPIKey) TableName() string {
	return "workflow_api_keys"
}

type WorkflowAPIInvocation struct {
	ID               uint           `gorm:"primaryKey" json:"id"`
	EndpointID       uint           `gorm:"not null;index" json:"endpointId"`
	APIKeyID         *uint          `gorm:"index" json:"apiKeyId,omitempty"`
	TaskID           *uint          `gorm:"index" json:"taskId,omitempty"`
	RequestID        string         `gorm:"type:varchar(80);not null;uniqueIndex" json:"requestId"`
	Status           string         `gorm:"type:varchar(20);not null;index" json:"status"`
	RequestBody      *shared.JSONB  `gorm:"type:jsonb" json:"requestBody,omitempty"`
	ResponseSnapshot *shared.JSONB  `gorm:"type:jsonb" json:"responseSnapshot,omitempty"`
	ErrorMessage     *string        `gorm:"type:text" json:"errorMessage,omitempty"`
	ClientIP         *string        `gorm:"type:varchar(64)" json:"clientIp,omitempty"`
	UserAgent        *string        `gorm:"type:text" json:"userAgent,omitempty"`
	StartedAt        *time.Time     `json:"startedAt,omitempty"`
	CompletedAt      *time.Time     `json:"completedAt,omitempty"`
	CreatedAt        time.Time      `json:"createdAt"`
	UpdatedAt        time.Time      `json:"updatedAt"`
	DeletedAt        gorm.DeletedAt `gorm:"index" json:"-"`
}

func (WorkflowAPIInvocation) TableName() string {
	return "workflow_api_invocations"
}

package services

import (
	"gorm.io/gorm"

	"yaolight-workshop/backend/infrastructure/logx"
	"yaolight-workshop/backend/infrastructure/shared"
	systemModels "yaolight-workshop/backend/modules/system/models"
)

func NewAppLogSink(db *gorm.DB) logx.LogSink {
	return func(entry logx.Entry) {
		if db == nil {
			return
		}

		var filePath *string
		if entry.FilePath != "" {
			filePath = &entry.FilePath
		}

		var contextJSON *shared.JSONB
		if len(entry.Context) > 0 {
			payload := shared.JSONB{Data: entry.Context}
			contextJSON = &payload
		}

		_ = db.Create(&systemModels.AppLog{
			LoggedAt: entry.LoggedAt,
			Level:    entry.Level,
			Owner:    entry.Owner,
			Code:     entry.Code,
			Message:  entry.Message,
			FilePath: filePath,
			Context:  contextJSON,
		}).Error
	}
}

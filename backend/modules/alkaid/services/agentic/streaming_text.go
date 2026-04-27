package agentic

import "time"

func streamAssistantText(sw *SSEWriter, content string, chunkSize int, pause time.Duration) {
	if sw == nil || content == "" {
		return
	}
	if chunkSize <= 0 {
		chunkSize = 12
	}

	runes := []rune(content)
	for i := 0; i < len(runes); i += chunkSize {
		end := i + chunkSize
		if end > len(runes) {
			end = len(runes)
		}
		_ = sw.WriteContent(string(runes[i:end]))
		if pause > 0 {
			time.Sleep(pause)
		}
	}
}

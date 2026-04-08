package logx

import (
	"encoding/json"
	"fmt"
	stdlog "log"
	"os"
	"runtime"
	"strings"
	"sync"
	"time"
)

type Level string

const (
	LevelInfo  Level = "info"
	LevelWarn  Level = "warn"
	LevelError Level = "error"

	DefaultOwner = "LCX"

	defaultInfoCode  = 197
	defaultWarnCode  = 198
	defaultErrorCode = 199
)

type Entry struct {
	LoggedAt time.Time
	Level    string
	Owner    string
	Code     int
	Message  string
	FilePath string
	Context  map[string]any
}

type LogSink func(Entry)

var shanghaiTZ = time.FixedZone("UTC+8", 8*60*60)

var (
	sinkMu sync.RWMutex
	sink   LogSink
)

var callerCodeMap = map[string]int{
	"backend/cmd/server/main.go":                                             1000,
	"backend/infrastructure/config/config.go":                                1101,
	"backend/infrastructure/database/database.go":                            1111,
	"backend/infrastructure/database/sql_migrations.go":                      1112,
	"backend/infrastructure/middleware/admin_operation_log_middleware.go":    1121,
	"backend/infrastructure/storage/cos.go":                                  1131,
	"backend/infrastructure/redis/redis.go":                                  1141,
	"backend/modules/user/services/invitation_service.go":                    2001,
	"backend/modules/user/services/auth_service.go":                          2002,
	"backend/modules/user/services/transaction_service.go":                   2003,
	"backend/modules/user/controllers/oauth_controller.go":                   2011,
	"backend/modules/user/controllers/auth_controller.go":                    2012,
	"backend/modules/project/controllers/project_controller.go":              2301,
	"backend/modules/payment/services/payment_service.go":                    3000,
	"backend/modules/payment/controllers/payment_controller.go":              3001,
	"backend/modules/workflow/services/crawler_node.go":                      4001,
	"backend/modules/workflow/services/variable_context.go":                  4002,
	"backend/modules/workflow/services/workflow_executor_stream_override.go": 4003,
	"backend/modules/workflow/services/workflow_executor_stream.go":          4004,
	"backend/modules/workflow/controllers/workflow_controller.go":            4011,
	"backend/modules/workflow/services/output_node.go":                       4012,
	"backend/modules/workflow/services/provider_config_mapper.go":            4013,
	"backend/modules/workflow/services/workflow_executor_concurrent.go":      4014,
	"backend/modules/workflow/services/ai_node.go":                           4015,
	"backend/modules/workflow/services/export/svg2png.go":                    4021,
	"backend/modules/ai/services/pricing_service.go":                         4601,
	"backend/modules/ai/services/providers/spark/spark_provider.go":          4611,
	"backend/modules/ai/services/providers/qwen/qwen_provider.go":            4612,
	"backend/modules/ai/services/providers/gpt/gpt_provider.go":              4613,
	"backend/modules/ai/services/providers/claude/claude_provider.go":        4614,
	"backend/modules/ai/services/providers/doubao/doubao_provider.go":        4615,
	"backend/modules/crawler/services/crawler_service.go":                    5001,
	"backend/modules/crawler/services/headless_crawler.go":                   5002,
	"backend/modules/notification/hub/hub.go":                                6001,
	"backend/modules/notification/controllers/notification_controller.go":    6002,
	"backend/modules/task/services/task_schedule_service.go":                 6101,
}

func ConfigureStdLogger() {
	stdlog.SetFlags(0)
	stdlog.SetPrefix("")
}

func SetSink(next LogSink) {
	sinkMu.Lock()
	defer sinkMu.Unlock()
	sink = next
}

func Timestamp() string {
	return time.Now().In(shanghaiTZ).Format("2006-01-02T15:04:05.000+08:00")
}

func BuildPrefix(level Level, owner string, code int) string {
	if owner == "" {
		owner = DefaultOwner
	}
	return fmt.Sprintf("[%s]-%s-%04d", level, owner, code)
}

func BuildMessage(level Level, owner string, code int, message string) string {
	prefix := BuildPrefix(level, owner, code)
	if strings.TrimSpace(message) == "" {
		return fmt.Sprintf("%s %s", Timestamp(), prefix)
	}
	return fmt.Sprintf("%s %s %s", Timestamp(), prefix, message)
}

func Infof(code int, format string, args ...any) {
	emitf(LevelInfo, DefaultOwner, code, 4, nil, format, args...)
}

func Warnf(code int, format string, args ...any) {
	emitf(LevelWarn, DefaultOwner, code, 4, nil, format, args...)
}

func Errorf(code int, format string, args ...any) {
	emitf(LevelError, DefaultOwner, code, 4, nil, format, args...)
}

func Fatalf(args ...any) {
	if len(args) == 0 {
		emitEntry(LevelError, DefaultOwner, defaultErrorCode, "", "", nil)
		os.Exit(1)
	}

	if code, ok := args[0].(int); ok {
		if len(args) == 1 {
			emitEntry(LevelError, DefaultOwner, code, "", inferCallerFile(3), nil)
			os.Exit(1)
		}
		format, _ := args[1].(string)
		emitEntry(LevelError, DefaultOwner, code, fmt.Sprintf(format, args[2:]...), inferCallerFile(3), nil)
		os.Exit(1)
	}

	format, _ := args[0].(string)
	emitEntry(LevelError, DefaultOwner, inferCallerCode(3), fmt.Sprintf(format, args[1:]...), inferCallerFile(3), nil)
	os.Exit(1)
}

func Info(code int, args ...any) {
	emit(LevelInfo, DefaultOwner, code, 4, nil, args...)
}

func Warn(code int, args ...any) {
	emit(LevelWarn, DefaultOwner, code, 4, nil, args...)
}

func Error(code int, args ...any) {
	emit(LevelError, DefaultOwner, code, 4, nil, args...)
}

func Printf(format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	level := detectLevel(message, LevelInfo)
	emitEntry(level, DefaultOwner, inferCallerCode(3), message, inferCallerFile(3), nil)
}

func Println(args ...any) {
	message := strings.TrimSuffix(fmt.Sprintln(args...), "\n")
	level := detectLevel(message, LevelInfo)
	emitEntry(level, DefaultOwner, inferCallerCode(3), message, inferCallerFile(3), nil)
}

func Fatal(args ...any) {
	message := strings.TrimSuffix(fmt.Sprintln(args...), "\n")
	emitEntry(LevelError, DefaultOwner, inferCallerCode(3), message, inferCallerFile(3), nil)
	os.Exit(1)
}

func Panic(args ...any) {
	message := strings.TrimSuffix(fmt.Sprintln(args...), "\n")
	emitEntry(LevelError, DefaultOwner, inferCallerCode(3), message, inferCallerFile(3), nil)
	panic(message)
}

func Panicf(format string, args ...any) {
	message := fmt.Sprintf(format, args...)
	emitEntry(LevelError, DefaultOwner, inferCallerCode(3), message, inferCallerFile(3), nil)
	panic(message)
}

func Panicln(args ...any) {
	Panic(args...)
}

func Fatalln(args ...any) {
	Fatal(args...)
}

func WithContext(level Level, code int, message string, context map[string]any) {
	emitEntry(level, DefaultOwner, code, message, inferCallerFile(3), context)
}

func emitf(level Level, owner string, code int, callerSkip int, context map[string]any, format string, args ...any) {
	emitEntry(level, owner, code, fmt.Sprintf(format, args...), inferCallerFile(callerSkip), context)
}

func emit(level Level, owner string, code int, callerSkip int, context map[string]any, args ...any) {
	emitEntry(level, owner, code, fmt.Sprint(args...), inferCallerFile(callerSkip), context)
}

func emitEntry(level Level, owner string, code int, message string, filePath string, context map[string]any) {
	stdlog.Print(BuildMessage(level, owner, code, renderMessageWithContext(message, context)))

	sinkMu.RLock()
	activeSink := sink
	sinkMu.RUnlock()
	if activeSink == nil {
		return
	}

	activeSink(Entry{
		LoggedAt: time.Now().In(shanghaiTZ),
		Level:    string(level),
		Owner:    owner,
		Code:     code,
		Message:  message,
		FilePath: filePath,
		Context:  cloneContext(context),
	})
}

func inferCallerCode(skip int) int {
	file, ok := callerFile(skip)
	if !ok {
		return defaultInfoCode
	}
	normalized := strings.ReplaceAll(file, "\\", "/")
	for suffix, code := range callerCodeMap {
		if strings.HasSuffix(normalized, suffix) {
			return code
		}
	}
	return defaultInfoCode
}

func inferCallerFile(skip int) string {
	file, ok := callerFile(skip)
	if !ok {
		return ""
	}
	return strings.ReplaceAll(file, "\\", "/")
}

func callerFile(skip int) (string, bool) {
	_, file, _, ok := runtime.Caller(skip)
	return file, ok
}

func detectLevel(message string, fallback Level) Level {
	lower := strings.ToLower(message)
	switch {
	case strings.Contains(lower, "error"),
		strings.Contains(lower, "failed"),
		strings.Contains(lower, "fatal"),
		strings.Contains(lower, "panic"),
		strings.Contains(message, "错误"),
		strings.Contains(message, "失败"),
		strings.Contains(message, "异常"):
		return LevelError
	case strings.Contains(lower, "warn"),
		strings.Contains(lower, "warning"),
		strings.Contains(message, "警告"):
		return LevelWarn
	default:
		return fallback
	}
}

func renderMessageWithContext(message string, context map[string]any) string {
	if len(context) == 0 {
		return message
	}
	payload, err := json.Marshal(context)
	if err != nil {
		return fmt.Sprintf("%s | context_marshal_error=%v", message, err)
	}
	if strings.TrimSpace(message) == "" {
		return fmt.Sprintf("context=%s", string(payload))
	}
	return fmt.Sprintf("%s | context=%s", message, string(payload))
}

func cloneContext(context map[string]any) map[string]any {
	if len(context) == 0 {
		return nil
	}
	cloned := make(map[string]any, len(context))
	for k, v := range context {
		cloned[k] = v
	}
	return cloned
}

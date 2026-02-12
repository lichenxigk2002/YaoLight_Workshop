package export

// File 表示一次导出的文件结果（内存中）
type File struct {
	Name     string
	Kind     string // json/markdown/text/...
	MimeType string
	Bytes    []byte
}

// Provider 导出提供商接口（仿 AI ProviderFactory 的注册模式）
// 输出节点会根据 format 选择 provider。
type Provider interface {
	Name() string
	Export(input interface{}, config map[string]interface{}) ([]File, error)
}

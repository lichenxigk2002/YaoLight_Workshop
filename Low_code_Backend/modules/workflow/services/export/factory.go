package export

import "fmt"

// Factory 导出提供商工厂（注册式）
type Factory struct {
	providers map[string]Provider
}

func NewFactory() *Factory {
	return &Factory{providers: make(map[string]Provider)}
}

func (f *Factory) Register(name string, p Provider) {
	f.providers[name] = p
}

func (f *Factory) Get(name string) (Provider, error) {
	p, ok := f.providers[name]
	if !ok {
		return nil, fmt.Errorf("export provider %s not found", name)
	}
	return p, nil
}

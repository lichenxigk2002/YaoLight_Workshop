# 豆包（Doubao）Provider 使用说明

## 依赖安装

### 如果遇到网络问题（需要代理）

1. **设置 Go 代理**（推荐使用国内镜像）：
```bash
# 使用七牛云镜像（国内）
go env -w GOPROXY=https://goproxy.cn,direct

# 或使用阿里云镜像
go env -w GOPROXY=https://mirrors.aliyun.com/goproxy/,direct
```

2. **如果使用代理**：
```bash
# 设置 HTTP 代理
go env -w GOPROXY=https://proxy.golang.org,direct
# 然后配置系统代理或环境变量
set HTTP_PROXY=http://your-proxy:port
set HTTPS_PROXY=http://your-proxy:port
```

3. **安装依赖**：
```bash
cd Low_code_Backend
go mod tidy
```

### SDK 版本

当前使用的 SDK 版本：`github.com/volcengine/volcengine-go-sdk v1.0.142`

如果版本不存在，可以尝试：
- 查看最新版本：访问 https://github.com/volcengine/volcengine-go-sdk/releases
- 或使用 `go get github.com/volcengine/volcengine-go-sdk@latest`

## 配置

在 `.env` 文件中添加：
```
DOUBAO_API_KEY=your_api_key_here
```

## 注意事项

1. **流式输出**：当前实现使用 HTTP 直接调用，因为 SDK 可能不支持流式
2. **响应格式**：流式响应的解析逻辑可能需要根据实际 API 格式调整
3. **多模态**：支持图片输入，通过 `providerConfig["images"]` 传递图片 URL 列表


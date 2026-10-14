# 构建阶段
FROM golang:1.24-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git ca-certificates

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# 运行阶段（如需爬虫/Chromium 可改用带 Chrome 的 Dockerfile.chromium）
FROM alpine:3.19
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
  && ln -sf /usr/bin/chromium-browser /usr/bin/google-chrome
ENV TZ=Asia/Shanghai

WORKDIR /app
COPY --from=builder /server .
# 上传目录（挂载卷或由环境变量指定）
RUN mkdir -p /app/uploads

EXPOSE 8080
ENTRYPOINT ["/app/server"]

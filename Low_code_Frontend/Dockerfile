# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# 生产环境 API 通过 Nginx 代理到 /api，构建时无需改 VITE_BASE_URL
ENV VITE_BASE_URL=/api
RUN npm run build

# 运行阶段：Nginx 托管静态资源并反向代理 /api
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM node:20-alpine AS builder
WORKDIR /app

# 1) 先复制 lockfile + package.json → 安装依赖（利用 Docker 层缓存）
COPY package.json package-lock.json ./
# RUN npm config set registry https://registry.npmmirror.com && npm ci --prefer-offline
RUN npm ci --prefer-offline

# 2) 再复制源码并构建
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

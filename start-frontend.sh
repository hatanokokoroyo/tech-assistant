#!/bin/bash
#
# start-frontend.sh — 启动前端开发服务器 (Vite · 端口 3000)
#
# 用法:
#   ./start-frontend.sh            # 启动开发服务器
#   ./start-frontend.sh --build    # 构建生产版本
#   ./start-frontend.sh --preview  # 预览构建产物
#
# 前置条件: Node.js (>=18) + npm
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

cd "$FRONTEND_DIR"

# 检测参数
case "${1:-dev}" in
    dev)
        echo "🚀 启动 Vite 开发服务器 (端口 3000)..."
        echo "   → 后端代理: /api → http://backend:8000 (开发时请确保后端已启动)"
        echo ""
        # 检查 node_modules，若缺失则自动安装
        if [ ! -d node_modules ]; then
            echo "📦 安装前端依赖..."
            npm install
        fi
        exec npm run dev
        ;;
    --build|build)
        echo "🔨 构建生产版本..."
        exec npm run build
        ;;
    --preview|preview)
        echo "🔍 启动预览服务器..."
        exec npm run preview
        ;;
    *)
        echo "用法: $0 [dev|--build|--preview]" >&2
        exit 1
        ;;
esac

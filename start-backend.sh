#!/bin/bash
#
# start-backend.sh — 启动后端开发服务器 (FastAPI · 端口 8000)
#
# 用法:
#   ./start-backend.sh              # 启动 uvicorn 开发服务器 (热重载)
#   ./start-backend.sh --docker-db  # 先启动 Docker PostgreSQL, 再启动后端
#   ./start-backend.sh --venv-only  # 仅创建/更新 venv，不启动服务器
#
# 前置条件:
#   - Python 3.13
#   - PostgreSQL 运行中 (或使用 --docker-db 自动启动 Docker 版)
#   - .env 文件 (可从 .env.example 复制)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$BACKEND_DIR/.env.example"
VENV_DIR="$BACKEND_DIR/.venv"
POSTGRES_CONTAINER="tech-assistant-postgres"

# ---------- 辅助函数 ----------
ensure_env_file() {
    if [ ! -f "$ENV_FILE" ]; then
        if [ -f "$ENV_EXAMPLE" ]; then
            echo "📄 未发现 .env 文件，正在从 .env.example 复制..."
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            echo "⚠️   请编辑 $ENV_FILE 填入实际的配置值 (数据库密码、API Key 等) 后重新运行。"
            exit 1
        else
            echo "❌ 找不到 .env 或 .env.example 文件。" >&2
            exit 1
        fi
    fi
}

ensure_venv() {
    if [ ! -d "$VENV_DIR" ]; then
        echo "🔧 创建 Python 虚拟环境 (.venv)..."
        python3 -m venv "$VENV_DIR"
    fi

    # 激活虚拟环境 (仅对当前脚本生效)
    # shellcheck disable=SC1091
    source "$VENV_DIR/bin/activate"

    echo "📦 安装/更新后端依赖..."
    pip install --upgrade pip
    pip3 install -r "$BACKEND_DIR/requirements.txt"
}

start_docker_postgres() {
    if docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$"; then
        echo "✅ PostgreSQL 容器 ($POSTGRES_CONTAINER) 已在运行。"
        return 0
    fi

    echo "🐘 启动 PostgreSQL 容器 ($POSTGRES_CONTAINER)..."
    # 从 .env 中读取 PostgreSQL 配置
    # shellcheck disable=SC1090
    source "$ENV_FILE" 2>/dev/null || true

    docker run -d \
        --name "$POSTGRES_CONTAINER" \
        -e POSTGRES_DB="${POSTGRES_DB:-tech_assistant}" \
        -e POSTGRES_USER="${POSTGRES_USER:-tech_user}" \
        -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-change_this_password}" \
        -p 5432:5432 \
        --network "bridge" \
        postgres:16-alpine

    echo "⏳ 等待 PostgreSQL 就绪..."
    sleep 3
    echo "   PostgreSQL 已启动 (localhost:5432)"
}

wait_for_postgres() {
    # 尝试连接 PostgreSQL (最多重试 10 次)
    for i in $(seq 1 10); do
        if command -v pg_isready &>/dev/null; then
            pg_isready -h localhost -p 5432 -q && return 0
        else
            # 用 docker 检测
            docker exec "$POSTGRES_CONTAINER" pg_isready -U "${PGUSER:-tech_user}" -q 2>/dev/null && return 0
        fi
        sleep 1
    done
    echo "⚠️   PostgreSQL 未就绪，后端启动后可能仍然无法连接数据库。"
}

# ---------- 主流程 ----------
MODE="${1:-dev}"

case "$MODE" in
    --venv-only|venv-only)
        ensure_env_file
        ensure_venv
        echo "✅ 虚拟环境就绪 (位于 $VENV_DIR)"
        echo "   激活: source $VENV_DIR/bin/activate"
        exit 0
        ;;

    --docker-db|docker-db)
        ensure_env_file
        ensure_venv
        start_docker_postgres
        wait_for_postgres
        echo ""
        echo "🚀 启动 FastAPI 开发服务器 (热重载 · 端口 8000)..."
        cd "$BACKEND_DIR"
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
        ;;

    dev|*)
        ensure_env_file
        ensure_venv
        echo ""
        echo "🚀 启动 FastAPI 开发服务器 (热重载 · 端口 8000)..."
        echo ""
        echo "📌 请确保 PostgreSQL 已运行 (host: localhost:5432)"
        echo "   若需自动启动 Docker PostgreSQL，请使用: $0 --docker-db"
        echo ""
        cd "$BACKEND_DIR"
        exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
        ;;
esac

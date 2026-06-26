#!/bin/bash
#
# deploy.sh — 高效率 Docker 镜像构建 & 全服务启动脚本
#
# 用法:
#   ./deploy.sh              # 增量构建并启动所有服务（默认）
#   ./deploy.sh --no-cache   # 完全重新构建（清除构建缓存）
#   ./deploy.sh --pull       # 拉取最新基础镜像后构建
#   ./deploy.sh --logs       # 启动后自动跟踪日志
#   ./deploy.sh --down       # 停止所有服务
#   ./deploy.sh --restart    # 重启所有服务（不重新构建）
#   ./deploy.sh --status     # 查看服务状态
#   ./deploy.sh --clean      # 停止服务并清除所有数据卷
#   ./deploy.sh --backend    # 仅重新构建并重启后端
#   ./deploy.sh --frontend   # 仅重新构建并重启前端
#
# 组合使用:
#   ./deploy.sh --no-cache --logs    # 完全重建 + 跟踪日志
#   ./deploy.sh --pull --logs        # 拉取基础镜像后构建 + 跟踪日志
#
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── 颜色 & 符号 ──────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'  # 重置

info()  { echo -e "${CYAN}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✔${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✘${NC} $*" >&2; }
step()  { echo -e "\n${BOLD}[$1/6]${NC} ${CYAN}$2${NC}"; }

# ── 参数解析 ──────────────────────────────────────────
NO_CACHE=""
PULL=false
FOLLOW_LOGS=false
ACTION="up"
TARGET=""

for arg in "$@"; do
    case "$arg" in
        --no-cache)  NO_CACHE="--no-cache" ;;
        --pull)      PULL=true ;;
        --logs)      FOLLOW_LOGS=true ;;
        --down)      ACTION="down" ;;
        --restart)   ACTION="restart" ;;
        --status)    ACTION="status" ;;
        --clean)     ACTION="clean" ;;
        --backend)   TARGET="backend" ;;
        --frontend)  TARGET="frontend" ;;
        -h|--help)
            sed -n '4,/^# ==/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            err "未知参数: $arg"
            echo "使用 $0 --help 查看用法"
            exit 1
            ;;
    esac
done

# ── 前置检查 ──────────────────────────────────────────
check_prerequisites() {
    if ! command -v docker &>/dev/null; then
        err "未找到 Docker，请先安装 Docker Desktop"
        exit 1
    fi

    # 检查 docker compose (V2) 或 docker-compose (V1)
    if docker compose version &>/dev/null; then
        COMPOSE="docker compose"
    elif command -v docker-compose &>/dev/null; then
        COMPOSE="docker-compose"
    else
        err "未找到 Docker Compose，请安装 Docker Desktop 或 docker-compose-plugin"
        exit 1
    fi

    # 检查 Docker 守护进程是否运行
    if ! docker info &>/dev/null; then
        err "Docker 守护进程未运行，请启动 Docker Desktop"
        exit 1
    fi
}

# ── .env 检查 ─────────────────────────────────────────
check_env() {
    if [ ! -f ".env" ]; then
        err "未找到 .env 文件"
        if [ -f "backend/.env.example" ]; then
            warn "检测到 backend/.env.example，是否复制为 .env？[y/N]"
            read -r answer
            if [[ "$answer" =~ ^[Yy] ]]; then
                cp backend/.env.example .env
                ok "已复制为 .env，请编辑配置后重新运行"
            fi
        fi
        exit 1
    fi
}

# ── 确保数据目录存在 ──────────────────────────────────
ensure_data_dirs() {
    local data_dir="${HOST_DATA_DIR:-./data/tech-assistant}"
    if [ ! -d "$data_dir" ]; then
        info "创建数据目录: $data_dir"
        mkdir -p "$data_dir"
    fi
    if [ ! -d "./data/logs" ]; then
        info "创建日志目录: ./data/logs"
        mkdir -p "./data/logs"
    fi
}

# ── 计时 ──────────────────────────────────────────────
timer_start() {
    START_TIME=$(date +%s)
}

timer_end() {
    local end_time=$(date +%s)
    local elapsed=$((end_time - START_TIME))
    local min=$((elapsed / 60))
    local sec=$((elapsed % 60))
    if [ $min -gt 0 ]; then
        echo -e "${DIM}耗时 ${min}m ${sec}s${NC}"
    else
        echo -e "${DIM}耗时 ${sec}s${NC}"
    fi
}

# ── 构建 & 启动 ──────────────────────────────────────
do_build_and_up() {
    step "1" "环境检查"
    check_env
    ensure_data_dirs
    ok "环境检查通过 (${COMPOSE})"

    step "2" "拉取基础镜像"
    if [ "$PULL" = true ]; then
        info "拉取最新基础镜像..."
        $COMPOSE pull --quiet 2>/dev/null || $COMPOSE pull
        ok "基础镜像已更新"
    else
        info "跳过（使用 --pull 可拉取最新基础镜像）"
    fi

    step "3" "构建镜像"
    timer_start

    if [ -n "$TARGET" ]; then
        info "仅构建: ${TARGET} ${NO_CACHE:+(无缓存)}"
        DOCKER_BUILDKIT=0 $COMPOSE build $NO_CACHE "$TARGET"
    else
        info "并行构建所有服务 ${NO_CACHE:+(无缓存)}..."
        DOCKER_BUILDKIT=0 $COMPOSE build $NO_CACHE
    fi

    ok "镜像构建完成"
    timer_end

    step "4" "启动服务"
    timer_start
    if [ -n "$TARGET" ]; then
        info "重启 ${TARGET}..."
        $COMPOSE up -d "$TARGET"
    else
        info "启动所有服务..."
        $COMPOSE up -d
    fi
    ok "服务已启动"
    timer_end

    step "5" "数据库迁移"
    info "执行 alembic upgrade head..."
    $COMPOSE run --rm backend alembic upgrade head 2>&1 || warn "数据库迁移失败，请检查 Alembic 配置"
    ok "数据库迁移完成"

    step "5" "服务状态"
    sleep 2
    $COMPOSE ps

    echo ""
    ok "${BOLD}部署完成！${NC}"
    echo -e "   前端: ${CYAN}http://localhost${NC}"
    echo -e "   后端: ${CYAN}http://localhost:8000${NC}"
    echo -e "   API 文档: ${CYAN}http://localhost:8000/docs${NC}"
    echo ""
    echo -e "${DIM}常用命令:${NC}"
    echo -e "   $COMPOSE logs -f          # 跟踪日志"
    echo -e "   $COMPOSE ps               # 查看状态"
    echo -e "   $COMPOSE restart backend  # 重启后端"
    echo -e "   $0 --down                 # 停止服务"
    echo ""

    if [ "$FOLLOW_LOGS" = true ]; then
        info "跟踪日志 (Ctrl+C 退出)..."
        $COMPOSE logs -f
    fi
}

# ── 停止 ──────────────────────────────────────────────
do_down() {
    info "停止所有服务..."
    $COMPOSE down
    ok "服务已停止"
}

# ── 重启（不重建） ────────────────────────────────────
do_restart() {
    info "重启所有服务..."
    if [ -n "$TARGET" ]; then
        $COMPOSE restart "$TARGET"
    else
        $COMPOSE restart
    fi
    ok "服务已重启"
    $COMPOSE ps
}

# ── 状态 ──────────────────────────────────────────────
do_status() {
    $COMPOSE ps
    echo ""
    info "数据卷使用:"
    docker volume ls --filter "name=tech-assistant" --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || true
}

# ── 清理 ──────────────────────────────────────────────
do_clean() {
    warn "即将停止服务并删除所有数据卷（包括数据库数据）！"
    read -p "确认清除？[y/N] " -r answer
    if [[ ! "$answer" =~ ^[Yy] ]]; then
        info "已取消"
        exit 0
    fi
    $COMPOSE down -v --remove-orphans
    ok "服务已停止，数据卷已清除"
}

# ── 主入口 ────────────────────────────────────────────
echo -e "\n${BOLD}${CYAN}⚡ Tech Assistant Deploy${NC}\n"

check_prerequisites

case "$ACTION" in
    up)       do_build_and_up ;;
    down)     do_down ;;
    restart)  do_restart ;;
    status)   do_status ;;
    clean)    do_clean ;;
esac

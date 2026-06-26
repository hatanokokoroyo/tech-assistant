# REASONIX.md

## 技术栈
- **后端：** Python 3.12 + FastAPI + SQLAlchemy 2.0（异步）+ PostgreSQL 16
- **前端：** TypeScript + React 19 + Vite + Tailwind CSS v4 + shadcn/ui（Radix UI）+ Zustand + TanStack Query
- **AI：** OpenAI SDK → DeepSeek V4（Flash/Pro），SSE 流式输出，Tool Calls API
- **部署：** Docker Compose（3 服务：frontend Nginx、backend FastAPI、postgres）

## 目录结构
- `backend/app/api/v1/` — REST 路由：auth、projects、repos、ssh_keys、files、conversations、stream、events
- `backend/app/models/` — 7 个 SQLAlchemy ORM 模型（User、CustomProject、CodeRepo、SshKey、Conversation、Message、EventLog）
- `backend/app/services/` — 业务逻辑（project、repo、file、conversation、event）
- `backend/app/ai/` — DeepSeek 客户端 + 6 个 Tool Calls（命令/读/写/搜索/列出/删除）
- `backend/app/core/` — 配置（.env）、安全（JWT+bcrypt）、依赖注入（get_current_user）
- `frontend/src/` — React 19 应用（详见 `doc/前端目录结构.md`）
- `doc/` — 设计文档 + schema.sql
- `doc/record/` — 开发汇总日志（每次重要功能开发完成后生成，命名格式：`yyyy-MM-dd <改动主题>.md`）

## 常用命令
```
npm --prefix frontend run dev          # Vite 开发服务器（端口 3000，/api 代理到 backend:8000）
npm --prefix frontend run build        # tsc 类型检查 + vite 构建 → dist/
uvicorn app.main:app --host 0.0.0.0 --port 8000   # 后端（Docker 内或 venv 中）
docker compose up -d --build           # 构建并启动全部服务
docker compose down -v                 # 停止并清除数据卷
```

## 设计原则
- **后端设计原则** — `doc/后端设计原则.md`：项目结构、命名规范、响应 envelope、认证授权、数据库、软删除、Service 层、错误处理、AI 模块、路径沙箱
- **前端设计原则** — `doc/前端设计原则.md`：设计 Token、组件规范、交互规范、API 集成、状态认证、路由、SSE 流式

## 核心约定
- **API 响应：** `{code: 0, message: "ok", data: ...}`，list 接口含 `{items, total}`，错误用 HTTP 状态码
- **前后端分层：** 后端 `api/v1/` → `services/` → `models/`；前端 `pages/` → `queries/` → `api/`
- **逻辑删除：** 所有表有 `deleted_at`，查询过滤 `WHERE deleted_at IS NULL`
- **时间戳：** `TIMESTAMP`（无时区），UTC，响应中格式化为 `"%Y-%m-%d %H:%M:%S"`
- **SSE 格式：** `event: <type>\ndata: <json>\n\n`，详见设计原则文档
- **Git 提交：** Conventional Commits 格式，描述使用中文. 没有明确指令, 禁止自发提交代码.
- **代码检索：** 优先使用 CodeGraph MCP 工具（`codegraph_explore` / `codegraph_search` / `codegraph_node` / `codegraph_callers`）进行代码搜索和分析，而非使用 `grep` 工具。CodeGraph 基于完整知识图谱，能提供符号定义、调用链、依赖关系等语义信息，比纯文本 grep 更准确高效。

## 数据库迁移（Alembic）
- 项目使用 Alembic 管理 PostgreSQL schema 迁移
- ORM 模型位于 `backend/app/models/`，迁移脚本位于 `backend/alembic/versions/`
- `deploy.sh` 第 5 步自动执行 `alembic upgrade head`

**⚠️ 提交规则：修改 ORM 模型后必须执行迁移**
如果 `git diff` 中包含 `backend/app/models/` 下的文件改动（新增/修改/删除字段、表），提交前必须：
```bash
# 1. 生成迁移脚本（对比当前模型与 DB schema）
docker compose run --rm backend alembic revision --autogenerate -m '<改动描述>'

# 2. 检查生成的迁移文件内容是否正确
# 3. 应用迁移
docker compose run --rm backend alembic upgrade head
```
**禁止跳过此步骤直接提交模型改动**，否则其他服务器部署时数据库 schema 不同步会导致运行异常。

## 注意事项
- 需要 Docker Desktop（bind mount 宿主机路径）
- DeepSeek API Key 需在 `.env` 中配置
- SSE 依赖 Nginx `proxy_buffering off`
- 尚无测试、无 lint/格式化工具
- 每次开发完成后需对改动进行 code review

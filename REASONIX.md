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
- `frontend/src/api/` — 按领域封装的 fetch 调用（自封装 api-client.ts，JWT 注入 + 401 拦截）
- `frontend/src/queries/` — TanStack Query hooks（缓存/刷新/乐观更新），query key 前缀统一
- `frontend/src/stores/` — Zustand stores（auth-store persist 到 localStorage，app-store 存 UI 状态）
- `frontend/src/pages/` — 页面组件：login、register、app/（layout + project-list + file-panel + file-editor + chat-panel + chat-view + repo-panel）
- `frontend/src/components/ui/` — shadcn/ui 组件（由 CLI 生成，代码在项目中，完全可控）
- `frontend/src/hooks/` — 自定义 Hooks（use-sse SSE 流式、use-auto-scroll 消息自动滚动）
- `frontend/src/lib/` — 核心工具（api-client fetch wrapper、utils cn()、format 时间格式化）
- `frontend/src/router/` — React Router 路由定义 + ProtectedRoute / PublicRoute 守卫
- `doc/` — 设计文档 + schema.sql
- `doc/record/` — 重构记录（前端重构设计.md）

## 常用命令
```
# 前端
npm --prefix frontend run dev          # Vite 开发服务器（端口 3000，/api 代理到 backend:8000）
npm --prefix frontend run build        # tsc 类型检查 + vite 构建 → dist/

# 后端（Docker 内或 venv 中执行）
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 部署
docker compose up -d --build           # 构建并启动全部服务
docker compose down -v                 # 停止并清除数据卷
```

## 约定
- **API 响应格式：** 统一包裹 `{code: 0, message: "ok", data: ...}`，`code: 0` 表示成功；list 接口 data 内含 `{items, total}` 分页结构
- **前端 HTTP 客户端：** 自封装 fetch wrapper（`lib/api-client.ts`），自动注入 JWT、拦截 401 跳转登录、规范化错误；API 函数返回类型为 `data` 字段内容
- **前端状态管理：** 服务端数据由 TanStack Query 管理（queries/），客户端状态由 Zustand 管理（stores/），页面内 UI 状态用 React useState
- **前端 API 集成规范：** envelope 解包、字段命名对齐、token 读取、路由布局、SSE 解析等规则详见 `doc/前端设计原则.md` 第六至九章
- **前端路径别名：** `@/` → `src/`（vite.config.ts + tsconfig.json 中配置）
- **前端样式：** Tailwind CSS v4，设计 token 在 `src/index.css` 的 `@theme` 中定义（OKLCH 色彩空间），组件使用 shadcn/ui
- **逻辑删除：** 所有表均有 `deleted_at TIMESTAMP` 字段，查询需过滤 `WHERE deleted_at IS NULL`
- **主键：** BIGSERIAL 自增整数（用户 ID 即工作区目录名）
- **时间戳：** `TIMESTAMP`（无时区），代码层统一写入 UTC
- **后端分层：** `api/v1/`（路由）→ `services/`（业务）→ `models/`（ORM），AI 模块由 stream 端点直接调用
- **SSE 格式：** `event: <type>\ndata: <json>\n\n`，token 事件携带 `{type, content}`，message_start / message_end 包裹每次对话；**前端解析规则见 `doc/前端设计原则.md` 第九章**
- **前端构建：** `tsc -b && vite build`，TypeScript 严格模式（noUnusedLocals / noUnusedParameters）
- **Git 提交：** 每次提交使用 Conventional Commits 格式，描述使用中文

## 注意事项
- **需要 Docker Desktop** — compose 中的 bind mount 使用宿主机路径（`./data/tech-assistant`、`./data/postgres`），需创建目录或在 `.env` 中调整
- **DeepSeek API Key** 需在 `.env` 中配置，缺少则 AI 对话接口 `/conversations/{id}/stream` 将失败
- **尚无测试** — `backend/tests/` 为空，前端亦无测试配置
- **无 lint/格式化工具** — 未配置 eslint、prettier、ruff 等
- **SSE 依赖 Nginx 配置** — `frontend/nginx.conf` 中 `proxy_buffering off` 是流式输出生效的必要条件
- **前端设计原则** — 详见 `doc/record/前端重构设计.md` 和 `doc/前端设计原则.md`，开发时必须遵循

## 开发原则
- 每次开发完成后, 需要对改动内容进行一轮code review, 发现问题并修复.

## Git 提交规范
- **每次提交必须使用 `npx cz`（或 `git cz`）**，遵循 Conventional Commits 格式
- 提交类型：`feat`（新功能）、`fix`（修复）、`refactor`（重构）、`docs`（文档）、`chore`（杂项）、`style`（格式调整）
- **提交内容（description + body）必须使用中文**，类型/scope 使用英文
- 示例：`feat(auth): 实现注册和登录 API`

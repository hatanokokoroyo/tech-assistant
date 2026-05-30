# REASONIX.md

## 技术栈
- **后端：** Python 3.12 + FastAPI + SQLAlchemy 2.0（异步）+ PostgreSQL 16
- **前端：** TypeScript + Vue 3 + Vite + Element Plus + Pinia
- **AI：** OpenAI SDK → DeepSeek V4（Flash/Pro），SSE 流式输出，Tool Calls API
- **部署：** Docker Compose（3 服务：frontend Nginx、backend FastAPI、postgres）

## 目录结构
- `backend/app/api/v1/` — REST 路由：auth、projects、repos、ssh_keys、files、conversations、stream、events
- `backend/app/models/` — 7 个 SQLAlchemy ORM 模型（User、CustomProject、CodeRepo、SshKey、Conversation、Message、EventLog）
- `backend/app/services/` — 业务逻辑（project、repo、file、conversation、event）
- `backend/app/ai/` — DeepSeek 客户端 + 6 个 Tool Calls（命令/读/写/搜索/列出/删除）
- `backend/app/core/` — 配置（.env）、安全（JWT+bcrypt）、依赖注入（get_current_user）
- `frontend/src/api/` — 按领域封装的 Axios 调用，拦截器自动剥离响应外层
- `frontend/src/views/` — 页面：Login、Register、project/*、chat/*（ChatPanel + ChatView SSE 流式对话）
- `frontend/src/layouts/AppLayout.vue` — 三栏布局外壳
- `doc/` — 设计文档 + schema.sql + TODOS.md

## 常用命令
```
# 前端
npm --prefix frontend run dev          # Vite 开发服务器（端口 3000，/api 代理到 backend:8000）
npm --prefix frontend run build        # vue-tsc 类型检查 + vite 构建 → dist/

# 后端（Docker 内或 venv 中执行）
uvicorn app.main:app --host 0.0.0.0 --port 8000

# 部署
docker compose up -d --build           # 构建并启动全部服务
docker compose down -v                 # 停止并清除数据卷
```

## 约定
- **API 响应格式：** 统一包裹 `{code: 0, message: "ok", data: ...}`，`code: 0` 表示成功
- **Axios 拦截器：** 自动剥离 axios 外层 → `res.data` 即 API 响应的 `data` 字段；API 函数返回类型为 `DataResponse<T>`
- **前端路径别名：** `@/` → `src/`（vite.config.ts + tsconfig.json 中配置）
- **逻辑删除：** 所有表均有 `deleted_at TIMESTAMP` 字段，查询需过滤 `WHERE deleted_at IS NULL`
- **主键：** BIGSERIAL 自增整数（用户 ID 即工作区目录名）
- **时间戳：** `TIMESTAMP`（无时区），代码层统一写入 UTC
- **后端分层：** `api/v1/`（路由）→ `services/`（业务）→ `models/`（ORM），AI 模块由 stream 端点直接调用
- **SSE 格式：** `event: <type>\ndata: <json>\n\n`，token 事件携带 `{type, content}`，message_start / message_end 包裹每次对话

## 注意事项
- **需要 Docker Desktop** — compose 中的 bind mount 使用宿主机路径（`./data/tech-assistant`、`./data/postgres`），需创建目录或在 `.env` 中调整
- **DeepSeek API Key** 需在 `.env` 中配置，缺少则 AI 对话接口 `/conversations/{id}/stream` 将失败
- **尚无测试** — `backend/tests/` 为空，前端亦无测试配置
- **无 lint/格式化工具** — 未配置 eslint、prettier、ruff 等
- **SSE 依赖 Nginx 配置** — `frontend/nginx.conf` 中 `proxy_buffering off` 是流式输出生效的必要条件

## Git 提交规范
- **每次提交必须使用 `npx cz`（或 `git cz`）**，遵循 Conventional Commits 格式
- 提交类型：`feat`（新功能）、`fix`（修复）、`refactor`（重构）、`docs`（文档）、`chore`（杂项）、`style`（格式调整）
- **提交内容（description + body）必须使用中文**，类型/scope 使用英文
- 示例：`feat(auth): 实现注册和登录 API`

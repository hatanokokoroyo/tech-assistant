# Agent 数据库查询能力设计方案

## 概述

为项目中的 AI Agent 赋予 MySQL / Redis / TDengine 数据库的**只读查询**能力。设计方案以确保数据库凭证绝对安全为首要目标，采用**独立 MCP 服务**实现进程级隔离——Agent 永远无法接触数据库连接串/账号/密码。

---

## 架构

```
┌──────────────┐      SSE/HTTP       ┌──────────────────────┐    MCP over HTTP    ┌──────────────────┐
│   Frontend   │ ◀──────────────────▶│  FastAPI Backend     │ ◀─────────────────▶ │  DB Query MCP    │
│   (React)    │                     │  + AiClient          │    localhost:9100   │  Server (独立)   │
│              │                     │  + MCP Client 集成   │                     │  FastMCP         │
└──────────────┘                     └────────┬─────────────┘                     └────────┬─────────┘
                                              │                                            │
                         管理凭证 (明文→加密)  │  PostgreSQL                                │  MySQL/Redis/
                         Agent 查数据源列表   │  (datasource_configs)                      │  TDengine
                                              ▼                                            ▼
                                     ┌──────────────────┐                       ┌──────────────────┐
                                     │   PostgreSQL 16  │                       │  用户业务数据库    │
                                     └──────────────────┘                       └──────────────────┘
```

**安全边界：**
- **FastAPI + AiClient（黄色区域）**：Agent 只知道数据源的**名称和类型**，永远看不到 host/port/user/password
- **MCP Server（绿色区域）**：持有解密密钥和凭证，但只暴露有限的查询接口，凭证仅在其内存中短暂存在
- **PostgreSQL**：敏感字段（password）AES-256-GCM 加密存储，密钥来自环境变量

---

## 安全纵深防御

| 层级 | 机制 | 说明 |
|------|------|------|
| 第 1 层：加密存储 | AES-256-GCM | 密码加密存储，密钥仅存在于环境变量 `DATASOURCE_ENCRYPTION_KEY` |
| 第 2 层：进程隔离 | 独立 MCP 服务 | 连接字符串仅在 MCP Server 进程内存中存在，AiClient 进程永远看不到 |
| 第 3 层：网络隔离 | 绑定 127.0.0.1 | MCP Server 仅接受本机连接，Docker 内网不暴露到外部 |
| 第 4 层：只读强制 | SQL 白名单 + 命令白名单 | MySQL/TDengine 仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN；Redis 仅允许 GET/HGET/LRANGE 等只读命令；MySQL 额外 `SET TRANSACTION READ ONLY` |
| 第 5 层：资源限制 | 行数/超时 | 最大 1000 行、30 秒超时、Redis KEYS 限制 100 条 |
| 第 6 层：权限审批 | ToolPermissionConfig | 默认 `ask_user`，每次查询需用户在前端确认；可配置 `auto_approve` 或 `deny` |
| 第 7 层：审计追踪 | EventLog | 记录每次查询：谁、哪个项目、哪个数据源、SQL、结果行数、耗时、成功/失败 |

---

## 详细设计

### 1. 数据模型：`datasource_configs`

```sql
CREATE TABLE datasource_configs (
    id                  BIGSERIAL PRIMARY KEY,
    project_id          BIGINT NOT NULL REFERENCES custom_projects(id),
    name                VARCHAR(100) NOT NULL,         -- 用户命名的别名，如 "生产MySQL"
    db_type             VARCHAR(20) NOT NULL,           -- mysql / redis / tdengine
    host                VARCHAR(255) NOT NULL,          -- 明文
    port                INTEGER NOT NULL,               -- 明文
    database_name       VARCHAR(100),                   -- 明文，Redis 可空
    username            VARCHAR(100),                   -- 明文
    encrypted_password  TEXT NOT NULL,                  -- AES-256-GCM 加密
    extra_config        JSONB,                          -- SSL/TLS/超时等附加配置（明文）
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP,
    
    UNIQUE(project_id, name)                            -- 同一项目下名称唯一（软删除后允许重名）
);
```

**加密策略：仅 `encrypted_password` 加密。** host/port/database_name/username 明文存储，方便列表显示和检索。密码字段使用 AES-256-GCM 加密，密钥来自环境变量。

**加密工具类：** `backend/app/core/datasource_crypto.py`

- `encrypt_password(plaintext: str) -> str`：AES-256-GCM 加密，返回 Base64 编码的密文
- `decrypt_password(ciphertext: str) -> str`：解密，返回明文密码
- 密钥：`os.environ["DATASOURCE_ENCRYPTION_KEY"]`（32 字节）

---

### 2. 后端管理 API（用户可见，Agent 不可访问）

所有端点挂载在 `/api/v1/projects/{project_id}/datasources` 下。**这些 API 不注册到 Agent 的 Tool 列表中。**

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/datasources` | 创建数据源。接收明文 password → 加密存储。响应不含 password |
| `GET` | `/datasources` | 列表。仅返回 `id/name/db_type/host/port/created_at`，**无密码** |
| `GET` | `/datasources/{ds_id}` | 详情。返回 host/port/database_name/username，**密码返回 `******`** |
| `PUT` | `/datasources/{ds_id}` | 更新。password 为空字符串时保留原密码；否则更新 |
| `DELETE` | `/datasources/{ds_id}` | 软删除（设置 deleted_at） |
| `POST` | `/datasources/{ds_id}/test` | 测试连接。使用解密后的凭证尝试连接并返回成功/失败 |

**关键安全约束：**
- 创建时：用户提交明文凭证 → 后端加密 → 存库 → 响应**不包含密码**
- 查询时：GET 响应**永远不包含**密码字段明文
- 更新时：password=`""` 表示保留原密码；password=非空 → 加密并更新

---

### 3. MCP Server（独立进程）

#### 3.1 技术选型

- **框架：** Python `mcp`（Anthropic 官方 SDK）+ `FastMCP`
- **通信：** HTTP（`streamable-http` transport），监听 `0.0.0.0:9100`
- **部署：** Docker Compose 独立服务 `dbquery-mcp`

#### 3.2 启动流程

```
1. 读取环境变量：DATASOURCE_ENCRYPTION_KEY, DATABASE_URL
2. 连接 tech-assistant 的 PostgreSQL（只读 datasource_configs 表）
3. 注册 4 个 MCP Tools
4. 启动 HTTP 服务，等待 Backend 的 MCP Client 连接
```

#### 3.3 工具列表

| Tool 名称 | 参数 | 返回值 | 说明 |
|-----------|------|--------|------|
| `list_datasources` | `project_id: int` | `[{name, db_type}]` | 列出项目下所有数据源的名称和类型 |
| `query_mysql` | `project_id: int, datasource_name: str, query: str` | JSON 字符串（查询结果） | 执行 MySQL 只读 SQL |
| `query_redis` | `project_id: int, datasource_name: str, command: str, args: list[str]` | JSON 字符串（命令结果） | 执行 Redis 只读命令 |
| `query_tdengine` | `project_id: int, datasource_name: str, query: str` | JSON 字符串（查询结果） | 执行 TDengine 只读 SQL |

#### 3.4 安全策略（内置于工具函数中）

**MySQL / TDengine SQL 白名单：**

```python
# 仅允许这些前缀
ALLOWED_PREFIXES = ["SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH"]

# 禁止的关键词（大小写不敏感匹配）
FORBIDDEN_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "CALL",
    "LOAD", "INTO", "OUTFILE", "DUMPFILE",
]
```

校验逻辑：
1. 去除前导空白，转为大写
2. 检查是否以 `ALLOWED_PREFIXES` 之一开头
3. 正则 `\b(FORBIDDEN_KEYWORDS)\b` 检查是否包含禁止关键词
4. 不通过 → 返回错误 `"仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN 查询"`

**MySQL 额外保护：** 连接后执行 `SET SESSION TRANSACTION READ ONLY`

**Redis 命令白名单：**

```python
ALLOWED_COMMANDS = {
    "GET", "MGET", "HGET", "HGETALL", "HMGET",
    "LRANGE", "SMEMBERS", "ZRANGE", "ZRANGEBYSCORE",
    "TTL", "PTTL", "EXISTS", "TYPE", "STRLEN",
    "HKEYS", "HVALS", "HLEN", "LLEN", "SCARD", "ZCARD",
    "SCAN",
}
```

**资源限制：**

| 限制 | 值 |
|------|-----|
| MySQL/TDengine 最大行数 | 1000 |
| MySQL/TDengine 查询超时 | 30 秒 |
| Redis KEYS/SCAN 最大返回 key | 100 条 |
| Redis 命令超时 | 30 秒 |

#### 3.5 工具执行流程（以 `query_mysql` 为例）

```
1. 接收参数: project_id=5, datasource_name="生产MySQL", query="SELECT * FROM users LIMIT 10"
2. 从 PG 查询: SELECT * FROM datasource_configs WHERE project_id=5 AND name='生产MySQL' AND deleted_at IS NULL
3. 数据源不存在 → 返回 "数据源 '生产MySQL' 不存在"
4. 解密 encrypted_password
5. SQL 白名单校验 → 通过
6. 建立 MySQL 连接（with 上下文管理器，确保连接关闭）
7. SET SESSION TRANSACTION READ ONLY
8. 设置查询超时 30s
9. 执行查询，pandas.read_sql 或直接 cursor.fetchmany(1000)
10. 截断到 MAX_ROWS
11. 返回 JSON: {"columns": ["id", "name"], "rows": [[1, "Alice"], ...], "row_count": 10}
12. 记录审计日志
```

---

### 4. Backend MCP Client 集成

#### 4.1 AiClient 改造

在 `AiClient.__init__` 中初始化 MCP 客户端：

```python
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

class AiClient:
    def __init__(self, ...):
        # ... 现有代码 ...
        self._mcp_tools: list[dict] = []       # MCP 工具列表（OpenAI function calling 格式）
        self._mcp_session = None               # MCP ClientSession 实例
    
    async def _init_mcp(self):
        """连接 MCP Server，获取工具列表，转为 OpenAI function calling schema"""
        self._mcp_session = await streamablehttp_client(settings.db_query_mcp_url)
        mcp_tools = await self._mcp_session.list_tools()
        self._mcp_tools = [self._mcp_to_openai_tool(t) for t in mcp_tools]
        # 从 tool schema 中移除 project_id 参数（Agent 不应感知）
    
    def _get_tools(self) -> list[dict]:
        """返回完整工具列表：本地工具 + MCP 数据库工具"""
        return TOOLS + self._mcp_tools
```

#### 4.2 `project_id` 自动注入

Agent 看到的工具定义中**没有 `project_id` 参数**。Backend 在执行时自动注入：

```python
async def _execute_tool(self, name: str, args: dict) -> str:
    # 本地工具：直接分发
    if name in LOCAL_TOOL_NAMES:
        return local_dispatch(name, args)
    
    # MCP 数据库工具：自动注入 project_id
    if name in MCP_TOOL_NAMES:
        args["project_id"] = self.custom_project_id
        return await self._mcp_session.call_tool(name, args)
    
    return f"Error: 未知工具 {name}"
```

#### 4.3 `_build_messages` 中 TOOLS 替换

```python
# 原来：
tools=TOOLS,

# 改为：
tools=self._get_tools(),
```

#### 4.4 启动时初始化

在 `stream_chat` 中创建 `AiClient` 后调用 `await client._init_mcp()`。

初始化失败时的降级策略：
- 记录 WARNING 日志：`"MCP Server 不可用，数据库查询工具不可用"`
- `_mcp_tools` 保持为空列表，仅本地工具可用
- 不阻塞对话创建

---

### 5. System Prompt 增强

在现有 system_prompt 末尾追加：

```python
"该项目可能配置了数据库数据源。你可以：\n"
"- 使用 list_datasources 查看可用的数据库及其类型（MySQL/Redis/TDengine）\n"
"- 使用 query_mysql / query_redis / query_tdengine 对指定数据源执行只读查询\n"
"- 查询时指定数据源名称（而非 ID），数据库类型由系统自动处理\n"
"- 注意：仅允许 SELECT 类只读查询，每次最多返回 1000 行，查询超时 30 秒\n"
"- 查询前请先用 list_datasources 了解有哪些数据源可用"
```

---

### 6. 权限控制

#### 6.1 新增 Tool 注册

在 `backend/app/schemas/tool_permission.py` 和 `tool_permission_config.py` 的 `ALLOWED_TOOLS` 中新增：

```python
ALLOWED_TOOLS = [
    # 现有 6 个
    "run_command", "read_file", "write_file",
    "search_content", "list_directory", "delete_file",
    # 新增 4 个数据库工具
    "list_datasources",
    "query_mysql",
    "query_redis",
    "query_tdengine",
]
```

同时更新 `ToolPermissionConfig` 的 `CHECK` 约束。

#### 6.2 默认策略

在 `GLOBAL_DEFAULTS` 中新增：

```python
GLOBAL_DEFAULTS: dict[str, str] = {
    # ... 现有默认 ...
    "list_datasources": "auto_approve",   # 仅列出名称，风险低
    "query_mysql": "ask_user",            # 查询需用户确认
    "query_redis": "ask_user",
    "query_tdengine": "ask_user",
}
```

---

### 7. 审计日志

在 `EventLog` 中记录每次数据库查询：

```python
# event_service.py 中新增
async def log_db_query(
    db: AsyncSession,
    user_id: int,
    project_id: int,
    datasource_name: str,
    db_type: str,
    query: str,
    row_count: int | None,
    duration_ms: int,
    success: bool,
    error_message: str | None = None,
):
    await create_event(db, {
        "type": "db_query",
        "user_id": user_id,
        "project_id": project_id,
        "datasource_name": datasource_name,
        "db_type": db_type,
        "query": query,
        "row_count": row_count,
        "duration_ms": duration_ms,
        "success": success,
        "error_message": error_message,
    })
```

审计日志由 MCP Server 调用 Backend 的内部 API 写入，或在 MCP Server 中直接写入 PostgreSQL。

---

### 8. 前端页面

在项目设置页面（现有 `projects/{id}/settings`）中新增 **「数据源」Tab**。

#### 8.1 页面元素

| 元素 | 说明 |
|------|------|
| 数据源列表 | 表格：名称、类型（MySQL/Redis/TDengine 图标）、主机:端口、操作（测试/编辑/删除） |
| 新增弹窗 | 表单：名称、类型（下拉选择）、主机、端口、数据库名、用户名、密码、高级配置 |
| 编辑弹窗 | 同新增，但密码字段 placeholder="留空则不修改" |
| 测试连接 | 调用 `POST .../datasources/{id}/test`，显示成功/失败提示 |
| 删除确认 | "确定删除数据源 XXX？Agent 将无法再访问此数据库。" |

#### 8.2 安全细节

- 密码输入框：`type="password"`，编辑时默认显示空（不回填）
- 编辑提交时：密码为空字符串 → 后端保留原密码
- 列表接口返回的数据中不含密码

---

### 9. 部署

#### 9.1 Docker Compose

`docker-compose.yml` 新增服务：

```yaml
dbquery-mcp:
  build:
    context: ./backend
    dockerfile: Dockerfile
  command: python -m app.mcp_server
  environment:
    - DATABASE_URL=postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    - DATASOURCE_ENCRYPTION_KEY=${DATASOURCE_ENCRYPTION_KEY}
  ports:
    - "127.0.0.1:9100:9100"
  depends_on:
    postgres:
      condition: service_healthy
  restart: unless-stopped
  networks:
    - app-network
```

#### 9.2 环境变量

`.env` 新增：

```bash
# 数据源加密密钥（32字节，Base64编码）
# 生成方式: python -c "import base64,os; print(base64.urlsafe_b64encode(os.urandom(32)).decode())"
DATASOURCE_ENCRYPTION_KEY=generate_a_random_32_byte_key_here

# MCP Server 地址（Backend 连接用）
DB_QUERY_MCP_URL=http://dbquery-mcp:9100
```

#### 9.3 Python 依赖

`backend/requirements.txt` 新增：

```
mcp>=1.0.0
cryptography>=42.0.0
aiomysql>=0.2.0       # MySQL 异步驱动
redis>=5.0.0           # Redis 异步客户端
taos-ws-py>=0.3.0      # TDengine WebSocket 连接器
```

---

### 10. 目录结构（新增/修改文件）

```
backend/
├── app/
│   ├── ai/
│   │   ├── client.py              # 修改：集成 MCP Client
│   │   ├── schemas.py             # 修改：TOOLS 动态合并 MCP 工具
│   │   └── tools.py               # 不修改（本地工具保持不变）
│   ├── api/v1/
│   │   ├── datasources.py         # 新增：数据源管理 REST API
│   │   └── stream.py              # 修改：AiClient 初始化时调用 _init_mcp()
│   ├── core/
│   │   ├── config.py              # 修改：新增 DB_QUERY_MCP_URL 配置项
│   │   └── datasource_crypto.py   # 新增：AES-256-GCM 加密工具
│   ├── models/
│   │   ├── datasource_config.py   # 新增：DatasourceConfig ORM 模型
│   │   └── tool_permission_config.py  # 修改：CHECK 约束新增 4 个工具
│   ├── schemas/
│   │   ├── datasource.py          # 新增：Pydantic 请求/响应模型
│   │   └── tool_permission.py     # 修改：ALLOWED_TOOLS 新增 4 个工具
│   ├── services/
│   │   └── datasource_service.py  # 新增：数据源 CRUD + 测试连接
│   └── mcp_server.py              # 新增：MCP Server 入口（FastMCP 应用）
└── requirements.txt               # 修改：新增依赖

frontend/
└── src/
    ├── api/
    │   └── datasources.ts          # 新增：数据源 API 客户端
    ├── queries/
    │   └── datasources.ts          # 新增：TanStack Query hooks
    └── pages/app/
        └── project-datasources.tsx # 新增：数据源管理页面
```

---

### 11. 实施阶段

| 阶段 | 内容 | 产出 |
|------|------|------|
| **Phase 1** | 数据模型 + 加密工具 + CRUD API | `DatasourceConfig` 模型、`datasource_crypto.py`、管理端点 |
| **Phase 2** | MCP Server 骨架 + MySQL 查询工具 | FastMCP 服务、`query_mysql` + `list_datasources` 工具 |
| **Phase 3** | Backend MCP Client 集成 | `AiClient` 改造、`_init_mcp`、TOOLS 动态合并 |
| **Phase 4** | Redis + TDengine 支持 | `query_redis`、`query_tdengine` 工具 |
| **Phase 5** | 前端数据源管理页面 | 项目设置 → 数据源 Tab |
| **Phase 6** | 权限集成 + 审计日志 + 联调测试 | `EventLog`、`ToolPermissionConfig`、Docker Compose |

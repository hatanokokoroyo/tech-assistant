# API 接口定义

## 通用约定

| 项目 | 规则 |
|---|---|
| 基础路径 | `/api` |
| 请求体 | JSON |
| 响应体 | JSON，统一包裹 |
| 认证 | Header `Authorization: Bearer <JWT>` |
| 时间格式 | `YYYY-MM-DD HH:MM:SS`（UTC，无时区后缀） |
| 逻辑删除 | 查询列表时自动过滤 `deleted_at IS NULL`，不返回已删除数据 |

### 统一响应结构

```json
{
    "code": 0,
    "message": "ok",
    "data": { ... }
}
```

分页列表额外字段：

```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [ ... ],
        "total": 42
    }
}
```

---

## 一、认证模块

### POST /api/auth/register

注册新用户。

**请求：**
```json
{
    "username": "zhangsan",
    "password": "abc123456",
    "alias_name": "张三"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 1,
        "username": "zhangsan",
        "alias_name": "张三",
        "role": "user",
        "created_at": "2025-01-01 08:00:00"
    }
}
```

**说明：**
- `alias_name` 可选
- `password` 长度 ≥ 6 位
- 注册即自动登录，返回 Token 需额外字段

---

### POST /api/auth/login

登录获取 Token。

**请求：**
```json
{
    "username": "zhangsan",
    "password": "abc123456"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIs...",
        "user": {
            "id": 1,
            "username": "zhangsan",
            "alias_name": "张三",
            "role": "user"
        }
    }
}
```

---

### GET /api/auth/me

获取当前登录用户信息。

**请求头：** `Authorization: Bearer <token>`

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 1,
        "username": "zhangsan",
        "alias_name": "张三",
        "role": "user",
        "created_at": "2025-01-01 08:00:00"
    }
}
```

---

### PUT /api/auth/me

更新当前用户信息。

**请求：**
```json
{
    "alias_name": "张三（研发部）"
}
```

**响应：** 同 GET /api/auth/me。

---

## 二、定制项目管理

### GET /api/projects

获取当前用户的定制项目列表。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [
            {
                "id": 1,
                "name": "XX银行数据平台",
                "description": "XX银行定制化数据展示平台",
                "repo_count": 3,
                "created_at": "2025-01-01 08:00:00"
            }
        ],
        "total": 5
    }
}
```

---

### POST /api/projects

创建定制项目（自动创建目录结构）。

**请求：**
```json
{
    "name": "XX银行数据平台",
    "description": "XX银行定制化数据展示平台"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 2,
        "name": "XX银行数据平台",
        "description": "XX银行定制化数据展示平台",
        "created_at": "2025-01-02 08:00:00"
    }
}
```

---

### GET /api/projects/{projectId}

获取定制项目详情。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 2,
        "name": "XX银行数据平台",
        "description": "XX银行定制化数据展示平台",
        "repos": [
            { "id": 1, "name": "data-api", "current_branch": "main" }
        ],
        "created_at": "2025-01-01 08:00:00"
    }
}
```

---

### PUT /api/projects/{projectId}

更新定制项目信息。

**请求：**
```json
{
    "name": "XX银行数据平台 V2",
    "description": "更新后的描述"
}
```

**响应：** 同 GET。

---

### DELETE /api/projects/{projectId}

删除定制项目（逻辑删除 + 文件系统物理删除）。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": null
}
```

---

## 三、代码仓库管理

### GET /api/projects/{projectId}/repos

获取项目的代码仓库列表。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [
            {
                "id": 1,
                "name": "data-api",
                "url": "git@github.com:org/data-api.git",
                "current_branch": "main",
                "created_at": "2025-01-01 08:00:00"
            }
        ],
        "total": 2
    }
}
```

---

### POST /api/projects/{projectId}/repos

添加代码仓库（触发 git clone）。

**请求：**
```json
{
    "name": "data-api",
    "url": "git@github.com:org/data-api.git"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 3,
        "name": "data-api",
        "url": "git@github.com:org/data-api.git",
        "current_branch": "main",
        "created_at": "2025-01-02 08:00:00"
    }
}
```

**说明：**
- 后端在响应前同步执行 `git clone`
- clone 失败返回错误码及具体错误信息
- 需要当前用户已配置 SSH Key（对 ssh 协议的仓库）

---

### DELETE /api/projects/{projectId}/repos/{repoId}

删除代码仓库（逻辑删除 + 文件系统物理删除）。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": null
}
```

---

### GET /api/projects/{projectId}/repos/{repoId}/branches

获取仓库的远程和本地分支列表。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "local_branches": ["main", "dev", "fix/login-bug"],
        "remote_branches": ["origin/main", "origin/dev", "origin/feature/report"],
        "current_branch": "main"
    }
}
```

---

### POST /api/projects/{projectId}/repos/{repoId}/checkout

切换本地分支。

**请求：**
```json
{
    "branch": "dev"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "current_branch": "dev"
    }
}
```

---

## 四、SSH 密钥管理

### GET /api/ssh-keys

获取当前用户的 SSH 密钥信息。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 1,
        "fingerprint": "SHA256:abc123...",
        "created_at": "2025-01-01 08:00:00"
    }
}
```

**说明：** 仅返回指纹和创建时间，不返回私钥内容或路径。

---

### POST /api/ssh-keys

上传 SSH 私钥。

**请求（multipart/form-data）：**
```
private_key: <file>
```

或

**请求（JSON）：**
```json
{
    "private_key_content": "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 2,
        "fingerprint": "SHA256:xyz789...",
        "created_at": "2025-01-02 08:00:00"
    }
}
```

**说明：**
- 支持文件上传和文本粘贴两种方式
- 后端将私钥保存至 `/data/tech-assistant/<user_id>/.ssh/id_rsa`
- 保存后自动计算指纹返回

---

### DELETE /api/ssh-keys/{keyId}

删除 SSH 密钥（逻辑删除 + 文件系统物理删除）。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": null
}
```

---

## 五、项目文档操作

### GET /api/projects/{projectId}/files

获取项目文档目录结构（仅限 doc/ 和 instructions.md 区域）。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "tree": [
            {
                "name": "instructions.md",
                "type": "file",
                "path": "instructions.md"
            },
            {
                "name": "doc",
                "type": "directory",
                "path": "doc",
                "children": [
                    {
                        "name": "log",
                        "type": "directory",
                        "path": "doc/log",
                        "children": []
                    },
                    {
                        "name": "reference-doc",
                        "type": "directory",
                        "path": "doc/reference-doc",
                        "children": []
                    }
                ]
            }
        ]
    }
}
```

---

### GET /api/projects/{projectId}/files/{filePath}

获取文档文件内容。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "path": "instructions.md",
        "content": "# XX银行数据平台\n\n## 项目简介\n...",
        "updated_at": "2025-01-01 08:00:00"
    }
}
```

**说明：**
- `{filePath}` 为文件的相对路径，如 `instructions.md`、`doc/log/xxx.md`
- 仅允许读取 `instructions.md`、`doc/log/`、`doc/reference-doc/` 下的文件

---

### PUT /api/projects/{projectId}/files/{filePath}

更新文档文件内容。

**请求：**
```json
{
    "content": "# XX银行数据平台\n\n## 项目简介\n...（更新后的内容）"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "path": "instructions.md",
        "updated_at": "2025-01-02 08:00:00"
    }
}
```

---

## 六、AI 对话

### GET /api/projects/{projectId}/conversations

获取某个定制项目下的对话列表。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [
            {
                "id": 1,
                "title": "登录异常排查",
                "message_count": 12,
                "created_at": "2025-01-01 08:00:00",
                "updated_at": "2025-01-01 09:30:00"
            }
        ],
        "total": 3
    }
}
```

---

### POST /api/projects/{projectId}/conversations

创建新对话。

**请求：**
```json
{
    "title": "登录异常排查"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 4,
        "title": "登录异常排查",
        "created_at": "2025-01-02 08:00:00"
    }
}
```

**说明：** `title` 可选，不传时后端可暂设为 "新对话" 或留空。

---

### GET /api/conversations/{conversationId}

获取对话详情及全部消息。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 4,
        "title": "登录异常排查",
        "messages": [
            {
                "id": 1,
                "role": "user",
                "content": "用户登录频繁报错，帮我看看代码",
                "created_at": "2025-01-02 08:00:00"
            },
            {
                "id": 2,
                "role": "assistant",
                "content": "好的，我来分析一下...",
                "tool_calls": [
                    {
                        "id": "call_abc123",
                        "type": "function",
                        "function": {
                            "name": "read_file",
                            "arguments": "{\"path\": \"...\"}"
                        }
                    }
                ],
                "created_at": "2025-01-02 08:00:05"
            },
            {
                "id": 3,
                "role": "tool",
                "tool_call_id": "call_abc123",
                "tool_name": "read_file",
                "content": "文件内容...",
                "created_at": "2025-01-02 08:00:08"
            }
        ],
        "created_at": "2025-01-02 08:00:00",
        "updated_at": "2025-01-02 08:00:08"
    }
}
```

---

### DELETE /api/conversations/{conversationId}

删除对话（逻辑删除）。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": null
}
```

---

### POST /api/conversations/{conversationId}/stream

发送用户消息并获取 AI 流式响应（SSE）。

**请求：**
```json
{
    "content": "帮我查一下登录模块的代码在哪里"
}
```

**响应（SSE 流）：**

```
event: message_start
data: {"conversation_id": 4}

event: token
data: {"type": "text", "content": "好的"}

event: token
data: {"type": "text", "content": "，我来查"}

event: token
data: {"type": "text", "content": "看一下登录模块。"}

event: token
data: {"type": "reasoning", "content": "用户需要找到登录模块代码..."}

event: token
data: {"type": "tool_call_start", "tool_call_id": "call_abc", "tool_name": "search_content", "arguments": "{\"pattern\": \"login\"}"}

event: token
data: {"type": "tool_call_end", "tool_call_id": "call_abc", "tool_name": "search_content", "content": "找到以下匹配..."}

event: token
data: {"type": "text", "content": "登录模块代码位于..."}

event: message_end
data: {"message_id": 5}
```

**SSE 事件类型说明：**

| event | data 字段 | 说明 |
|---|---|---|
| `message_start` | `conversation_id` | 消息开始 |
| `token` | `type: "text"` + `content` | 文本回复片段 |
| `token` | `type: "reasoning"` + `content` | 思维链片段（前端默认折叠） |
| `token` | `type: "tool_call_start"` + `tool_call_id, tool_name, arguments` | 工具调用开始（前端默认折叠缩略） |
| `token` | `type: "tool_call_end"` + `tool_call_id, tool_name, content` | 工具调用完成 |
| `message_end` | `message_id` | 消息结束 |

**说明：**
- 当前端收到 `message_end` 后，调用 `GET /api/conversations/{id}` 刷新完整消息列表，确保数据一致
- SSE 连接异常断开时，前端可重新加载历史消息后继续对话

---

## 七、事件日志

### POST /api/projects/{projectId}/events

完成事件处理并生成日志记录。

**请求：**
```json
{
    "conversation_id": 4,
    "summary": "已排查登录异常问题，根因为数据库连接池耗尽",
    "supplement": "已重启数据库连接池，建议监控连接数"
}
```

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "id": 1,
        "file_path": "doc/log/2025-01-02_083000_login异常排查.md",
        "created_at": "2025-01-02 08:30:00"
    }
}
```

**说明：**
- `summary` 必填，来自 AI 生成的摘要（可用户编辑后提交）
- `supplement` 可选，用户补充说明
- 后端同时生成 Markdown 文件写入 `doc/log/` 目录，`file_path` 即为生成的路径

---

### GET /api/projects/{projectId}/events

获取事件处理记录列表。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [
            {
                "id": 1,
                "summary": "已排查登录异常问题，根因为数据库连接池耗尽",
                "file_path": "doc/log/2025-01-02_083000_login异常排查.md",
                "created_at": "2025-01-02 08:30:00"
            }
        ],
        "total": 10
    }
}
```

---

## 八、管理员

### GET /api/admin/users

管理员获取所有用户列表。

**响应：**
```json
{
    "code": 0,
    "message": "ok",
    "data": {
        "items": [
            {
                "id": 1,
                "username": "zhangsan",
                "alias_name": "张三",
                "role": "user",
                "created_at": "2025-01-01 08:00:00"
            },
            {
                "id": 2,
                "username": "admin",
                "alias_name": "管理员",
                "role": "admin",
                "created_at": "2025-01-01 08:00:00"
            }
        ],
        "total": 2
    }
}
```

---

## 接口总览

| # | 方法 | 路径 | 说明 |
|---|---|---|---|
| 1 | POST | /api/auth/register | 注册 |
| 2 | POST | /api/auth/login | 登录 |
| 3 | GET | /api/auth/me | 获取当前用户信息 |
| 4 | PUT | /api/auth/me | 更新当前用户信息 |
| 5 | GET | /api/projects | 定制项目列表 |
| 6 | POST | /api/projects | 创建定制项目 |
| 7 | GET | /api/projects/{projectId} | 定制项目详情 |
| 8 | PUT | /api/projects/{projectId} | 更新定制项目 |
| 9 | DELETE | /api/projects/{projectId} | 删除定制项目 |
| 10 | GET | /api/projects/{projectId}/repos | 代码仓库列表 |
| 11 | POST | /api/projects/{projectId}/repos | 添加代码仓库 |
| 12 | DELETE | /api/projects/{projectId}/repos/{repoId} | 删除代码仓库 |
| 13 | GET | /api/projects/{projectId}/repos/{repoId}/branches | 获取分支列表 |
| 14 | POST | /api/projects/{projectId}/repos/{repoId}/checkout | 切换分支 |
| 15 | GET | /api/ssh-keys | SSH 密钥信息 |
| 16 | POST | /api/ssh-keys | 上传 SSH 密钥 |
| 17 | DELETE | /api/ssh-keys/{keyId} | 删除 SSH 密钥 |
| 18 | GET | /api/projects/{projectId}/files | 文档目录结构 |
| 19 | GET | /api/projects/{projectId}/files/{filePath} | 读取文档文件 |
| 20 | PUT | /api/projects/{projectId}/files/{filePath} | 更新文档文件 |
| 21 | GET | /api/projects/{projectId}/conversations | 对话列表 |
| 22 | POST | /api/projects/{projectId}/conversations | 创建对话 |
| 23 | GET | /api/conversations/{conversationId} | 对话详情（含消息） |
| 24 | DELETE | /api/conversations/{conversationId} | 删除对话 |
| 25 | POST | /api/conversations/{conversationId}/stream | AI 流式对话（SSE） |
| 26 | POST | /api/projects/{projectId}/events | 完成事件 |
| 27 | GET | /api/projects/{projectId}/events | 事件日志列表 |
| 28 | GET | /api/admin/users | 用户列表（管理员） |

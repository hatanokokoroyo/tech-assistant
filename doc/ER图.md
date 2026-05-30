# 数据库 ER 图

```
┌─────────────────────────────────────────────────────────────────┐
│                            users                                │
├─────────────────────┬───────────────────────────────────────────┤
│ PK │ id:BIGSERIAL  │  主键，同时也是工作区目录名               │
│     │ username      │  UNIQUE, NOT NULL                         │
│     │ alias_name    │  真实姓名（可选）                          │
│     │ password_hash │  bcrypt                                    │
│     │ role          │  'admin' | 'user'                          │
│     │ created_at    │  TIMESTAMP                                 │
│     │ deleted_at    │  TIMESTAMP（逻辑删除）                      │
└─────┴───────────────┴───────────────────────────────────────────┘
          │ 1
          │
          │
          │ N
┌─────────┼───────────────────────────────────────────────────────┐
│         │              custom_projects                           │
├─────────┼───────────────────────────────────────────────────────┤
│ PK │ id │  BIGSERIAL                                             │
│ FK │ user_id │  → users(id)                                     │
│     │ name        │  VARCHAR(200)                                │
│     │ description │  TEXT                                        │
│     │ created_at  │  TIMESTAMP                                   │
│     │ deleted_at  │  TIMESTAMP                                   │
└─────┴─────────────┴─────────────────────────────────────────────┘
          │ 1                      │ 1
          │                        │
          │                        │
          │ N                      │ N
┌─────────┼──────────┐  ┌─────────┼────────────────────┐
│  code_repos         │  │      conversations         │
├─────────────────────┤  ├───────────────────────────┤
│ PK id               │  │ PK id                     │
│ FK custom_project_id│  │ FK user_id  → users(id)   │
│    name             │  │ FK custom_project_id       │
│    url              │  │    title                   │
│    local_path       │  │    created_at              │
│    current_branch   │  │    updated_at              │
│    created_at       │  │    deleted_at              │
│    deleted_at       │  └─────┬─────────────────────┘
└─────────────────────┘        │ 1
                               │
                               │
                               │ N
                    ┌──────────┼────────────────────┐
                    │       messages                 │
                    ├───────────────────────────────┤
                    │ PK id                         │
                    │ FK conversation_id             │
                    │    role        ('user'|'assistant'|'tool'|'system')
                    │    content     TEXT            │
                    │    tool_calls  JSONB           │
                    │    tool_call_id                │
                    │    tool_name                   │
                    │    created_at                  │
                    │    deleted_at                  │
                    └───────────────────────────────┘

┌────────────────────────────────┐  ┌────────────────────────────┐
│          ssh_keys              │  │       event_logs           │
├────────────────────────────────┤  ├────────────────────────────┤
│ PK id                         │  │ PK id                      │
│ FK user_id  → users(id)       │  │ FK custom_project_id        │
│    fingerprint                │  │ FK user_id  → users(id)    │
│    file_path                  │  │ FK conversation_id（可选）   │
│    created_at                 │  │    summary                  │
│    deleted_at                 │  │    supplement               │
└────────────────────────────────┘  │    file_path                │
                                    │    created_at               │
                                    │    deleted_at               │
                                    └────────────────────────────┘
```

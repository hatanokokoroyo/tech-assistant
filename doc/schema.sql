-- ============================================================
-- Tech Assistant — 建表 DDL
-- 数据库: PostgreSQL 16
-- 约定: BIGSERIAL 主键 | TIMESTAMP(0) 无时区 | 全表逻辑删除
-- ============================================================

-- 1. users
CREATE TABLE users (
    id              BIGSERIAL       PRIMARY KEY,
    username        VARCHAR(100)    NOT NULL UNIQUE,
    alias_name      VARCHAR(100),
    password_hash   VARCHAR(255)    NOT NULL,
    role            VARCHAR(20)     NOT NULL CHECK (role IN ('admin', 'user')),
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

COMMENT ON TABLE  users          IS '用户';
COMMENT ON COLUMN users.username IS '登录账号';
COMMENT ON COLUMN users.alias_name IS '真实姓名，UI优先展示，为空回退username';
COMMENT ON COLUMN users.password_hash IS 'bcrypt哈希值';
COMMENT ON COLUMN users.role     IS '角色: admin=管理员, user=普通用户';
COMMENT ON COLUMN users.deleted_at IS '逻辑删除时间，NULL=未删除';


-- 2. custom_projects
CREATE TABLE custom_projects (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id),
    name            VARCHAR(200)    NOT NULL,
    description     TEXT,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_custom_projects_user_id ON custom_projects(user_id);

COMMENT ON TABLE  custom_projects          IS '定制项目（甲方项目）';
COMMENT ON COLUMN custom_projects.user_id  IS '所属用户';
COMMENT ON COLUMN custom_projects.name     IS '项目名称';
COMMENT ON COLUMN custom_projects.deleted_at IS '逻辑删除时间';


-- 3. code_repos
CREATE TABLE code_repos (
    id                  BIGSERIAL       PRIMARY KEY,
    custom_project_id   BIGINT          NOT NULL REFERENCES custom_projects(id),
    name                VARCHAR(200)    NOT NULL,
    url                 VARCHAR(500)    NOT NULL,
    local_path          VARCHAR(500)    NOT NULL,
    current_branch      VARCHAR(200)    NOT NULL DEFAULT 'main',
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX idx_code_repos_custom_project_id ON code_repos(custom_project_id);

COMMENT ON TABLE  code_repos                  IS '代码项目（Git仓库）';
COMMENT ON COLUMN code_repos.custom_project_id IS '所属定制项目';
COMMENT ON COLUMN code_repos.name             IS '仓库名称（从URL推断或用户指定）';
COMMENT ON COLUMN code_repos.url              IS 'Git远程仓库URL';
COMMENT ON COLUMN code_repos.local_path       IS '在定制项目目录下的相对路径';
COMMENT ON COLUMN code_repos.current_branch   IS '当前本地分支';
COMMENT ON COLUMN code_repos.deleted_at       IS '逻辑删除时间';


-- 4. ssh_keys
CREATE TABLE ssh_keys (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id),
    fingerprint     VARCHAR(256),
    file_path       VARCHAR(500)    NOT NULL,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE INDEX idx_ssh_keys_user_id ON ssh_keys(user_id);

COMMENT ON TABLE  ssh_keys            IS '用户SSH私钥';
COMMENT ON COLUMN ssh_keys.user_id    IS '所属用户';
COMMENT ON COLUMN ssh_keys.fingerprint IS '密钥指纹，用于前端展示';
COMMENT ON COLUMN ssh_keys.file_path  IS '在volume中的文件路径';
COMMENT ON COLUMN ssh_keys.deleted_at IS '逻辑删除时间';


-- 5. conversations
CREATE TABLE conversations (
    id                  BIGSERIAL       PRIMARY KEY,
    user_id             BIGINT          NOT NULL REFERENCES users(id),
    custom_project_id   BIGINT          NOT NULL REFERENCES custom_projects(id),
    title               VARCHAR(200),
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX idx_conversations_user_project ON conversations(user_id, custom_project_id);

COMMENT ON TABLE  conversations                  IS 'AI对话会话';
COMMENT ON COLUMN conversations.user_id          IS '发起用户';
COMMENT ON COLUMN conversations.custom_project_id IS '关联定制项目';
COMMENT ON COLUMN conversations.title            IS '对话标题（可由AI自动生成）';
COMMENT ON COLUMN conversations.updated_at       IS '最后消息时间';
COMMENT ON COLUMN conversations.deleted_at       IS '逻辑删除时间';


-- 6. messages
CREATE TABLE messages (
    id                  BIGSERIAL       PRIMARY KEY,
    conversation_id     BIGINT          NOT NULL REFERENCES conversations(id),
    role                VARCHAR(20)     NOT NULL CHECK (role IN ('user', 'assistant', 'tool', 'system')),
    content             TEXT,
    tool_calls          JSONB,
    tool_call_id        VARCHAR(100),
    tool_name           VARCHAR(100),
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_conversation_tool ON messages(conversation_id, tool_call_id);

COMMENT ON TABLE  messages                  IS '对话消息';
COMMENT ON COLUMN messages.conversation_id  IS '所属对话';
COMMENT ON COLUMN messages.role             IS '消息角色: user/assistant/tool/system';
COMMENT ON COLUMN messages.content          IS '文本内容（tool消息可为空）';
COMMENT ON COLUMN messages.tool_calls       IS 'assistant消息的工具调用数组';
COMMENT ON COLUMN messages.tool_call_id     IS 'tool消息对应的工具调用ID';
COMMENT ON COLUMN messages.tool_name        IS 'tool消息的工具名称';
COMMENT ON COLUMN messages.deleted_at       IS '逻辑删除时间';


-- 7. event_logs
CREATE TABLE event_logs (
    id                  BIGSERIAL       PRIMARY KEY,
    custom_project_id   BIGINT          NOT NULL REFERENCES custom_projects(id),
    user_id             BIGINT          NOT NULL REFERENCES users(id),
    conversation_id     BIGINT          REFERENCES conversations(id),
    summary             TEXT            NOT NULL,
    supplement          TEXT,
    file_path           VARCHAR(500),
    created_at          TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMP
);

CREATE INDEX idx_event_logs_project_time ON event_logs(custom_project_id, created_at);

COMMENT ON TABLE  event_logs                  IS '事件处理记录';
COMMENT ON COLUMN event_logs.custom_project_id IS '所属定制项目';
COMMENT ON COLUMN event_logs.user_id           IS '操作用户';
COMMENT ON COLUMN event_logs.conversation_id   IS '关联AI对话（可选）';
COMMENT ON COLUMN event_logs.summary           IS '事件处理摘要';
COMMENT ON COLUMN event_logs.supplement        IS '用户补充说明';
COMMENT ON COLUMN event_logs.file_path         IS '生成的Markdown文件路径';
COMMENT ON COLUMN event_logs.deleted_at        IS '逻辑删除时间';


-- 8. tool_permission_configs
CREATE TABLE tool_permission_configs (
    id              BIGSERIAL       PRIMARY KEY,
    project_id      BIGINT          NOT NULL REFERENCES custom_projects(id),
    tool_name       VARCHAR(50)     NOT NULL CHECK (tool_name IN ('run_command', 'read_file', 'write_file', 'search_content', 'list_directory', 'delete_file')),
    permission      VARCHAR(20)     NOT NULL CHECK (permission IN ('auto_approve', 'ask_user', 'deny')),
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP       NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

CREATE UNIQUE INDEX idx_tool_permission_configs_project_tool ON tool_permission_configs(project_id, tool_name);

COMMENT ON TABLE  tool_permission_configs              IS '项目级 Tool 权限配置';
COMMENT ON COLUMN tool_permission_configs.project_id   IS '所属定制项目';
COMMENT ON COLUMN tool_permission_configs.tool_name    IS 'Tool 名称';
COMMENT ON COLUMN tool_permission_configs.permission   IS '权限策略: auto_approve/ask_user/deny';
COMMENT ON COLUMN tool_permission_configs.deleted_at   IS '逻辑删除时间';

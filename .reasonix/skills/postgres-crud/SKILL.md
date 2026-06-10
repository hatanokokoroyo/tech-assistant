---
name: postgres-crud
description: 使用 Python 零依赖工具连接本机 Docker PostgreSQL，执行增删改查 SQL
---

# PostgreSQL CRUD Skill

通过 `./pg.py` 连接本机 Docker 内的 PostgreSQL，执行增删改查 SQL。

## 依赖

- Python 3 标准库（无需 pip 安装任何包）
- Docker postgres 容器正在运行（`tech-assistant-postgres-1`）

## 工具路径

```
python3 ./pg.py [--json] "<SQL>"
python3 ./pg.py < file.sql
echo "<SQL>" | python3 ./pg.py
```

## CRUD 操作示例

### 查询 (SELECT)

```bash
# 文本表格输出（默认）
python3 ./pg.py "SELECT id, username, created_at FROM users ORDER BY id"

# JSON 输出（带列名）
python3 ./pg.py --json "SELECT id, username FROM users WHERE id = 1"

# 多表 JOIN
python3 ./pg.py --json "
  SELECT p.id, p.name, COUNT(r.id) AS repo_count
  FROM custom_projects p
  LEFT JOIN code_repos r ON r.project_id = p.id
  GROUP BY p.id, p.name
  ORDER BY repo_count DESC
"
```

### 新增 (INSERT)

```bash
python3 ./pg.py "INSERT INTO users(username, password_hash, email) VALUES('new_user', 'hash_here', 'user@example.com')"
```

返回：`影响行数: 1`

### 修改 (UPDATE)

```bash
python3 ./pg.py "UPDATE users SET email = 'new@example.com' WHERE username = 'lzk'"
```

返回：`影响行数: 1`

### 删除 (DELETE)

```bash
python3 ./pg.py "DELETE FROM users WHERE username = 'temp_user'"
```

返回：`影响行数: 1`

### 其他 SQL

```bash
# 建表 / DDL
python3 ./pg.py "CREATE TABLE IF NOT EXISTS ..."

# 查看表结构
python3 ./pg.py "\d users"

# 统计计数
python3 ./pg.py --json "
  SELECT table_name, (xpath('/row/c/text()', query_to_xml('SELECT count(*) FROM '||table_name, false, true, '')))[1]::text::int AS count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  ORDER BY table_name
"
```

## 工作原理

- 通过 `docker exec -i tech-assistant-postgres-1 psql ...` 连接运行中的 postgres 容器
- 零额外依赖，只用了 Python 标准库 (`subprocess`, `csv`, `json`)
- `--json` 模式利用 psql 的 `--csv` 输出，再用 DictReader 解析为 JSON
- 文本模式直接透传 psql 原始输出

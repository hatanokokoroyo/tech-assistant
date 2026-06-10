#!/usr/bin/env python3
"""pg.py — PostgreSQL CRUD 工具, 通过 docker exec 连接本机 postgres 容器.
零依赖 (Python 标准库即可).

用法:
  python3 backend/scripts/pg.py "SELECT * FROM users"
  python3 backend/scripts/pg.py --json "SELECT id, username FROM users WHERE id=1"
  echo "INSERT INTO users(username) VALUES('test')" | python3 backend/scripts/pg.py
  python3 backend/scripts/pg.py < query.sql
"""
import csv, io, json, os, subprocess, sys

DOCKER_CONTAINER = os.environ.get("PG_CONTAINER", "tech-assistant-postgres-1")
DB_USER = os.environ.get("POSTGRES_USER", "tech_user")
DB_NAME = os.environ.get("POSTGRES_DB", "tech_assistant")
OUTPUT_JSON = "--json" in sys.argv


def main():
    # 提取 SQL
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if args:
        sql = " ".join(args)
    elif not sys.stdin.isatty():
        sql = sys.stdin.read()
    else:
        print("用法: python3 pg.py [--json] \"<SQL>\"  或通过 stdin 传入", file=sys.stderr)
        sys.exit(1)

    sql = sql.strip()
    if not sql:
        sys.exit(0)

    stmt_type = sql.strip().split()[0].upper() if sql.strip().split() else ""

    if OUTPUT_JSON and stmt_type in ("SELECT", "WITH", "VALUES", "EXPLAIN"):
        _exec_json(sql)
    else:
        _exec_text(sql, stmt_type)


def _exec_text(sql: str, stmt_type: str):
    """普通文本输出"""
    cmd = ["docker", "exec", "-i", DOCKER_CONTAINER,
           "psql", "-U", DB_USER, "-d", DB_NAME,
           "-c", sql]
    if stmt_type in ("INSERT", "UPDATE", "DELETE"):
        cmd.append("--quiet")

    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        _die(r.stderr.strip() or r.stdout.strip())

    out = r.stdout.strip()
    err = r.stderr.strip()

    if stmt_type in ("INSERT", "UPDATE", "DELETE"):
        for line in (out + "\n" + err).split("\n"):
            line = line.strip()
            if line and line.split()[0].isdigit():
                print(f"影响行数: {line.split()[0]}")
                return
        print("执行成功")
    else:
        print(out)


def _exec_json(sql: str):
    """JSON 格式输出 — 利用 psql --csv 解析为 dict 列表"""
    cmd = ["docker", "exec", "-i", DOCKER_CONTAINER,
           "psql", "-U", DB_USER, "-d", DB_NAME,
           "--csv", "-c", sql]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if r.returncode != 0:
        _die(r.stderr.strip() or r.stdout.strip())

    reader = csv.DictReader(io.StringIO(r.stdout))
    rows = list(reader)
    print(json.dumps(rows, ensure_ascii=False, indent=2))


def _die(msg: str):
    print(f"错误: {msg}", file=sys.stderr)
    sys.exit(1)


if __name__ == "__main__":
    main()

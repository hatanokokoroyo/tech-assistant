"""MCP Server — 数据库查询独立进程。

通过 FastMCP + HTTP transport 对外暴露数据库只读查询工具。
Agent 永远无法接触数据库连接串/账号/密码，仅通过此处有限的 Tool 接口访问。

启动方式: python -m app.mcp_server
监听: 0.0.0.0:9100
"""

import asyncio
import json
import logging
import os
import re
import time
from urllib.parse import quote as url_quote

from mcp.server.fastmcp import FastMCP
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.datasource_crypto import decrypt_password

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mcp_server")

# ── 配置 ──────────────────────────────────────────────

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://tech_user:change_this_password@localhost:5432/tech_assistant",
)
ENCRYPTION_KEY = os.environ.get("DATASOURCE_ENCRYPTION_KEY", "")

if not ENCRYPTION_KEY:
    logger.warning("DATASOURCE_ENCRYPTION_KEY 未设置，密码解密将失败")

# ── FastMCP 应用 ──────────────────────────────────────

mcp = FastMCP(
    "dbquery-mcp",
    instructions="数据库只读查询服务 — 支持 MySQL / Redis / TDengine",
    host="0.0.0.0",
    port=9100,
)

# ── 数据库会话 ────────────────────────────────────────

engine = create_async_engine(DATABASE_URL, echo=False, pool_size=5, max_overflow=5)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def _get_datasource(project_id: int, datasource_name: str) -> dict | None:
    """从 PG 查询数据源配置，解密密码后返回完整凭证。"""
    from app.models.datasource_config import DatasourceConfig

    async with async_session() as session:
        result = await session.execute(
            select(DatasourceConfig).where(
                DatasourceConfig.project_id == project_id,
                DatasourceConfig.name == datasource_name,
                DatasourceConfig.deleted_at.is_(None),
            )
        )
        ds = result.scalar()
        if ds is None:
            return None
        return {
            "id": ds.id,
            "name": ds.name,
            "db_type": ds.db_type,
            "host": ds.host,
            "port": ds.port,
            "database_name": ds.database_name,
            "username": ds.username,
            "password": decrypt_password(ds.encrypted_password),
            "extra_config": ds.extra_config,
        }


# ═══════════════════════════════════════════════════════
# SQL 白名单 + 安全校验
# ═══════════════════════════════════════════════════════

ALLOWED_SQL_PREFIXES = ("SELECT", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "WITH")

FORBIDDEN_SQL_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "CREATE",
    "TRUNCATE", "GRANT", "REVOKE", "EXEC", "EXECUTE", "CALL",
    "LOAD", "INTO", "OUTFILE", "DUMPFILE",
]

FORBIDDEN_PATTERN = re.compile(
    r"\b(" + "|".join(FORBIDDEN_SQL_KEYWORDS) + r")\b",
    re.IGNORECASE,
)


def _validate_sql(sql: str) -> tuple[bool, str]:
    """校验 SQL 是否为合法的只读查询。返回 (通过, 错误消息)。"""
    stripped = sql.strip()
    upper = stripped.upper()

    # 检查是否以允许的前缀开头
    if not any(upper.startswith(p) for p in ALLOWED_SQL_PREFIXES):
        return False, f"仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN/WITH 查询，当前 SQL: {_truncate(stripped, 100)}"

    # 检查是否包含禁止关键词
    match = FORBIDDEN_PATTERN.search(stripped)
    if match:
        return False, f"SQL 包含禁止的关键词 '{match.group(0)}'，仅允许只读查询"

    return True, ""


MAX_ROWS = 1000
QUERY_TIMEOUT = 30

# ═══════════════════════════════════════════════════════
# Redis 命令白名单
# ═══════════════════════════════════════════════════════

ALLOWED_REDIS_COMMANDS = {
    "GET", "MGET", "HGET", "HGETALL", "HMGET",
    "LRANGE", "SMEMBERS", "ZRANGE", "ZRANGEBYSCORE",
    "TTL", "PTTL", "EXISTS", "TYPE", "STRLEN",
    "HKEYS", "HVALS", "HLEN", "LLEN", "SCARD", "ZCARD",
    "SCAN",
}

REDIS_MAX_KEYS = 100


def _truncate(s: str, max_len: int = 200) -> str:
    if len(s) <= max_len:
        return s
    return s[:max_len] + f"...({len(s)} chars)"


# ═══════════════════════════════════════════════════════
# Tools
# ═══════════════════════════════════════════════════════

@mcp.tool()
async def list_datasources(project_id: int) -> str:
    """列出指定项目下所有可用数据源的名称和类型。

    Args:
        project_id: 项目 ID

    Returns:
        JSON 字符串：数据源列表 [{"name": "...", "db_type": "mysql"}, ...]
    """
    from app.models.datasource_config import DatasourceConfig

    logger.info("[list_datasources] project_id=%d", project_id)

    async with async_session() as session:
        result = await session.execute(
            select(DatasourceConfig.name, DatasourceConfig.db_type).where(
                DatasourceConfig.project_id == project_id,
                DatasourceConfig.deleted_at.is_(None),
            ).order_by(DatasourceConfig.name.asc())
        )
        rows = result.all()

    items = [{"name": r.name, "db_type": r.db_type} for r in rows]
    return json.dumps(items, ensure_ascii=False)


@mcp.tool()
async def query_mysql(project_id: int, datasource_name: str, query: str) -> str:
    """对指定的 MySQL 数据源执行只读 SQL 查询。

    仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN/WITH 开头的查询，
    自动设置 READ ONLY 事务，最多返回 1000 行，超时 30 秒。

    Args:
        project_id: 项目 ID
        datasource_name: 数据源名称（如 "生产MySQL"）
        query: 只读 SQL 语句

    Returns:
        JSON 字符串：{"columns": [...], "rows": [[...], ...], "row_count": N}
        或错误：{"error": "..."}
    """
    import aiomysql

    t_start = time.time()

    # 校验 SQL
    ok, err_msg = _validate_sql(query)
    if not ok:
        logger.warning("[query_mysql] SQL 校验失败: %s", err_msg)
        return json.dumps({"error": err_msg}, ensure_ascii=False)

    # 获取数据源凭证
    ds = await _get_datasource(project_id, datasource_name)
    if ds is None:
        return json.dumps({"error": f"数据源 '{datasource_name}' 不存在"}, ensure_ascii=False)
    if ds["db_type"] != "mysql":
        return json.dumps({"error": f"数据源 '{datasource_name}' 类型为 {ds['db_type']}，不是 MySQL"}, ensure_ascii=False)

    logger.info("[query_mysql] project_id=%d, ds=%s, query=%s",
                project_id, datasource_name, _truncate(query, 200))

    try:
        conn = await asyncio.wait_for(
            aiomysql.connect(
                host=ds["host"],
                port=ds["port"],
                user=ds["username"],
                password=ds["password"],
                db=ds["database_name"] or "",
                connect_timeout=5,
                autocommit=True,
            ),
            timeout=10,
        )
    except Exception as e:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_mysql] 连接失败: %s", e)
        return json.dumps({"error": f"连接失败: {type(e).__name__}: {e}"}, ensure_ascii=False)

    try:
        async with conn.cursor() as cursor:
            # 设置只读事务
            await cursor.execute("SET SESSION TRANSACTION READ ONLY")
            # 设置查询超时
            await cursor.execute(f"SET SESSION max_execution_time={QUERY_TIMEOUT * 1000}")

            # 执行查询
            await asyncio.wait_for(
                cursor.execute(query),
                timeout=QUERY_TIMEOUT + 5,
            )

            # 获取结果
            columns = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = await asyncio.wait_for(
                cursor.fetchmany(MAX_ROWS),
                timeout=5,
            )

            # 转换 rows（可能是 tuple 或 dict）
            rows_list = [list(r) for r in rows]

            elapsed = int((time.time() - t_start) * 1000)
            logger.info("[query_mysql] 查询成功: columns=%d, rows=%d, elapsed=%dms",
                        len(columns), len(rows_list), elapsed)

            return json.dumps({
                "columns": columns,
                "rows": rows_list,
                "row_count": len(rows_list),
            }, ensure_ascii=False, default=str)

    except asyncio.TimeoutError:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_mysql] 查询超时: %dms", elapsed)
        return json.dumps({"error": f"查询超时（{QUERY_TIMEOUT}秒）"}, ensure_ascii=False)
    except Exception as e:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_mysql] 查询失败: %s", e)
        return json.dumps({"error": f"查询失败: {type(e).__name__}: {e}"}, ensure_ascii=False)
    finally:
        conn.close()


@mcp.tool()
async def query_redis(project_id: int, datasource_name: str, command: str, args: list[str] | None = None) -> str:
    """对指定的 Redis 数据源执行只读命令。

    仅允许 GET/HGET/LRANGE/SMEMBERS 等只读命令，KEYS/SCAN 最多返回 100 条。

    Args:
        project_id: 项目 ID
        datasource_name: 数据源名称
        command: Redis 命令（大写，如 GET、HGETALL、LRANGE）
        args: 命令参数列表，例如 ["key1"] 或 ["mylist", "0", "-1"]

    Returns:
        JSON 字符串：{"result": ...} 或 {"error": "..."}
    """
    import redis.asyncio as redis_lib

    t_start = time.time()
    cmd_upper = command.upper().strip()

    if cmd_upper not in ALLOWED_REDIS_COMMANDS:
        return json.dumps({
            "error": f"Redis 命令 '{cmd_upper}' 不在白名单中，仅允许: {', '.join(sorted(ALLOWED_REDIS_COMMANDS))}"
        }, ensure_ascii=False)

    ds = await _get_datasource(project_id, datasource_name)
    if ds is None:
        return json.dumps({"error": f"数据源 '{datasource_name}' 不存在"}, ensure_ascii=False)
    if ds["db_type"] != "redis":
        return json.dumps({"error": f"数据源 '{datasource_name}' 类型为 {ds['db_type']}，不是 Redis"}, ensure_ascii=False)

    args = args or []
    logger.info("[query_redis] project_id=%d, ds=%s, cmd=%s, args=%s",
                project_id, datasource_name, cmd_upper, args)

    try:
        r = await asyncio.wait_for(
            redis_lib.from_url(
                f"redis://:{url_quote(ds['password'], safe='')}@{ds['host']}:{ds['port']}",
                socket_connect_timeout=5,
            ),
            timeout=10,
        )
    except Exception as e:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_redis] 连接失败: %s", e)
        return json.dumps({"error": f"连接失败: {type(e).__name__}: {e}"}, ensure_ascii=False)

    try:
        # 对 KEYS 做限制
        if cmd_upper == "KEYS":
            return json.dumps({
                "error": f"KEYS 命令在生产环境禁用，请使用 SCAN（最多返回 {REDIS_MAX_KEYS} 条）"
            }, ensure_ascii=False)

        # 对 SCAN 限制返回数量
        if cmd_upper == "SCAN" and len(args) >= 1:
            # SCAN cursor [MATCH pattern] [COUNT count]
            # 检查 COUNT 参数
            for i, a in enumerate(args):
                if a.upper() == "COUNT" and i + 1 < len(args):
                    try:
                        count_val = int(args[i + 1])
                        if count_val > REDIS_MAX_KEYS:
                            args[i + 1] = str(REDIS_MAX_KEYS)
                    except ValueError:
                        pass

        # 执行命令
        fn = getattr(r, cmd_upper.lower(), None)
        if fn is None:
            return json.dumps({"error": f"Redis 客户端不支持命令 '{cmd_upper}'"}, ensure_ascii=False)

        result = await asyncio.wait_for(
            fn(*args),
            timeout=QUERY_TIMEOUT,
        )

        # 处理 SCAN 结果
        if cmd_upper == "SCAN":
            cursor, keys = result
            if len(keys) > REDIS_MAX_KEYS:
                keys = keys[:REDIS_MAX_KEYS]
            result = {"cursor": cursor, "keys": keys, "truncated": len(keys) > REDIS_MAX_KEYS}

        elapsed = int((time.time() - t_start) * 1000)
        logger.info("[query_redis] 成功: cmd=%s, elapsed=%dms", cmd_upper, elapsed)

        return json.dumps({"result": _serialize_redis(result)}, ensure_ascii=False, default=str)

    except asyncio.TimeoutError:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_redis] 超时: %dms", elapsed)
        return json.dumps({"error": f"Redis 命令超时（{QUERY_TIMEOUT}秒）"}, ensure_ascii=False)
    except Exception as e:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_redis] 失败: %s", e)
        return json.dumps({"error": f"Redis 命令失败: {type(e).__name__}: {e}"}, ensure_ascii=False)
    finally:
        await r.aclose()


@mcp.tool()
async def query_tdengine(project_id: int, datasource_name: str, query: str) -> str:
    """对指定的 TDengine 数据源执行只读 SQL 查询。

    仅允许 SELECT/SHOW/DESCRIBE/EXPLAIN 查询，最多返回 1000 行，超时 30 秒。

    Args:
        project_id: 项目 ID
        datasource_name: 数据源名称
        query: 只读 SQL 语句

    Returns:
        JSON 字符串：{"columns": [...], "rows": [[...], ...], "row_count": N}
    """
    t_start = time.time()

    ok, err_msg = _validate_sql(query)
    if not ok:
        logger.warning("[query_tdengine] SQL 校验失败: %s", err_msg)
        return json.dumps({"error": err_msg}, ensure_ascii=False)

    ds = await _get_datasource(project_id, datasource_name)
    if ds is None:
        return json.dumps({"error": f"数据源 '{datasource_name}' 不存在"}, ensure_ascii=False)
    if ds["db_type"] != "tdengine":
        return json.dumps({"error": f"数据源 '{datasource_name}' 类型为 {ds['db_type']}，不是 TDengine"}, ensure_ascii=False)

    logger.info("[query_tdengine] project_id=%d, ds=%s, query=%s",
                project_id, datasource_name, _truncate(query, 200))

    try:
        import taosws

        dsn = f"taosws://{url_quote(ds['username'], safe='')}:{url_quote(ds['password'], safe='')}@{ds['host']}:{ds['port']}"
        if ds["database_name"]:
            dsn += f"/{ds['database_name']}"

        conn = await asyncio.wait_for(
            taosws.connect(dsn),
            timeout=10,
        )
    except Exception as e:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_tdengine] 连接失败: %s", e)
        return json.dumps({"error": f"连接失败: {type(e).__name__}: {e}"}, ensure_ascii=False)

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(conn.query, query),
            timeout=QUERY_TIMEOUT + 5,
        )

        fields = result.fields
        columns = [f.name for f in fields] if fields else []

        all_rows = await asyncio.wait_for(
            asyncio.to_thread(result.fetch_all),
            timeout=5,
        )
        rows = all_rows[:MAX_ROWS] if all_rows else []
        rows_list = [list(r) if hasattr(r, '__iter__') and not isinstance(r, str) else [r] for r in rows]

        elapsed = int((time.time() - t_start) * 1000)
        logger.info("[query_tdengine] 查询成功: columns=%d, rows=%d, elapsed=%dms",
                    len(columns), len(rows_list), elapsed)

        return json.dumps({
            "columns": columns,
            "rows": rows_list,
            "row_count": len(rows_list),
        }, ensure_ascii=False, default=str)

    except asyncio.TimeoutError:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_tdengine] 超时: %dms", elapsed)
        return json.dumps({"error": f"查询超时（{QUERY_TIMEOUT}秒）"}, ensure_ascii=False)
    except Exception as e:
        elapsed = int((time.time() - t_start) * 1000)
        logger.error("[query_tdengine] 失败: %s", e)
        return json.dumps({"error": f"查询失败: {type(e).__name__}: {e}"}, ensure_ascii=False)
    finally:
        conn.close()


def _serialize_redis(value):
    """将 Redis 返回值转为 JSON 可序列化格式。"""
    if value is None:
        return None
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            return value.hex()
    if isinstance(value, (int, float, str, bool)):
        return value
    if isinstance(value, list):
        return [_serialize_redis(v) for v in value]
    if isinstance(value, dict):
        return {k.decode() if isinstance(k, bytes) else k: _serialize_redis(v)
                for k, v in value.items()}
    if isinstance(value, set):
        return [_serialize_redis(v) for v in value]
    return str(value)


# ═══════════════════════════════════════════════════════
# 入口
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    logger.info("MCP Server 启动中...")
    mcp.run(transport="streamable-http")

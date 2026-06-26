"""数据源 CRUD 服务 + 连接测试。"""

import asyncio
import logging
from urllib.parse import quote as url_quote

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.datasource_config import DatasourceConfig
from app.core.datasource_crypto import encrypt_password, decrypt_password

logger = logging.getLogger(__name__)

MAX_ROWS = 1000
QUERY_TIMEOUT = 30


# ── 时间格式化 ────────────────────────────────────────

def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")


# ── CRUD ──────────────────────────────────────────────

async def create_datasource(
    db: AsyncSession,
    project_id: int,
    name: str,
    db_type: str,
    host: str,
    port: int,
    password: str,
    database_name: str | None = None,
    username: str | None = None,
    extra_config: dict | None = None,
) -> DatasourceConfig:
    """创建数据源，密码自动加密存储。"""
    ds = DatasourceConfig(
        project_id=project_id,
        name=name,
        db_type=db_type,
        host=host,
        port=port,
        database_name=database_name,
        username=username,
        encrypted_password=encrypt_password(password),
        extra_config=extra_config,
    )
    db.add(ds)
    await db.flush()
    await db.refresh(ds)
    return ds


async def list_datasources(
    db: AsyncSession,
    project_id: int,
) -> list[dict]:
    """列出项目下所有数据源（不含密码）。"""
    result = await db.execute(
        select(DatasourceConfig).where(
            DatasourceConfig.project_id == project_id,
            DatasourceConfig.deleted_at.is_(None),
        ).order_by(DatasourceConfig.created_at.asc())
    )
    configs = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "db_type": c.db_type,
            "host": c.host,
            "port": c.port,
            "database_name": c.database_name,
            "username": c.username,
            "created_at": _fmt(c.created_at),
        }
        for c in configs
    ]


async def get_datasource(
    db: AsyncSession,
    datasource_id: int,
    project_id: int,
) -> dict | None:
    """获取数据源详情（密码返回掩码）。"""
    result = await db.execute(
        select(DatasourceConfig).where(
            DatasourceConfig.id == datasource_id,
            DatasourceConfig.project_id == project_id,
            DatasourceConfig.deleted_at.is_(None),
        )
    )
    c = result.scalar()
    if c is None:
        return None

    return {
        "id": c.id,
        "name": c.name,
        "db_type": c.db_type,
        "host": c.host,
        "port": c.port,
        "database_name": c.database_name,
        "username": c.username,
        "password": "******",
        "extra_config": c.extra_config,
        "created_at": _fmt(c.created_at),
        "updated_at": _fmt(c.updated_at),
    }


async def update_datasource(
    db: AsyncSession,
    datasource_id: int,
    project_id: int,
    name: str | None = None,
    host: str | None = None,
    port: int | None = None,
    database_name: str | None = None,
    username: str | None = None,
    password: str = "",
    extra_config: dict | None = None,
) -> DatasourceConfig | None:
    """更新数据源。password 为空字符串时保留原密码。"""
    result = await db.execute(
        select(DatasourceConfig).where(
            DatasourceConfig.id == datasource_id,
            DatasourceConfig.project_id == project_id,
            DatasourceConfig.deleted_at.is_(None),
        )
    )
    ds = result.scalar()
    if ds is None:
        return None

    if name is not None:
        ds.name = name
    if host is not None:
        ds.host = host
    if port is not None:
        ds.port = port
    if database_name is not None:
        ds.database_name = database_name
    if username is not None:
        ds.username = username
    if password != "":
        ds.encrypted_password = encrypt_password(password)
    if extra_config is not None:
        ds.extra_config = extra_config

    ds.updated_at = func.now()
    await db.flush()
    await db.refresh(ds)
    return ds


async def delete_datasource(
    db: AsyncSession,
    datasource_id: int,
    project_id: int,
) -> bool:
    """软删除数据源。返回 True 表示成功，False 表示不存在。"""
    result = await db.execute(
        select(DatasourceConfig).where(
            DatasourceConfig.id == datasource_id,
            DatasourceConfig.project_id == project_id,
            DatasourceConfig.deleted_at.is_(None),
        )
    )
    ds = result.scalar()
    if ds is None:
        return False
    ds.deleted_at = func.now()
    await db.flush()
    return True


# ── 连接测试 ──────────────────────────────────────────

async def test_connection(
    db: AsyncSession,
    datasource_id: int,
    project_id: int,
) -> dict:
    """测试数据源连接，返回 {success: bool, message: str, latency_ms: int}。"""
    result = await db.execute(
        select(DatasourceConfig).where(
            DatasourceConfig.id == datasource_id,
            DatasourceConfig.project_id == project_id,
            DatasourceConfig.deleted_at.is_(None),
        )
    )
    ds = result.scalar()
    if ds is None:
        return {"success": False, "message": "数据源不存在", "latency_ms": 0}

    try:
        password = decrypt_password(ds.encrypted_password)
    except Exception as e:
        return {"success": False, "message": f"密码解密失败: {e}", "latency_ms": 0}

    start = asyncio.get_event_loop().time()

    try:
        if ds.db_type == "mysql":
            return await _test_mysql(ds.host, ds.port, ds.username, password,
                                     ds.database_name, start)
        elif ds.db_type == "redis":
            return await _test_redis(ds.host, ds.port, password, start)
        elif ds.db_type == "tdengine":
            return await _test_tdengine(ds.host, ds.port, ds.username, password,
                                        ds.database_name, start)
        else:
            return {"success": False, "message": f"不支持的数据库类型: {ds.db_type}", "latency_ms": 0}
    except ImportError as e:
        return {"success": False, "message": f"缺少驱动: {e}", "latency_ms": 0}
    except asyncio.TimeoutError:
        return {"success": False, "message": "连接超时（10秒）", "latency_ms": 0}
    except Exception as e:
        return {"success": False, "message": f"{type(e).__name__}: {e}", "latency_ms": 0}


async def _test_mysql(host: str, port: int, user: str, password: str,
                      database: str | None, start: float) -> dict:
    import aiomysql
    try:
        conn = await asyncio.wait_for(
            aiomysql.connect(
                host=host, port=port, user=user, password=password,
                db=database or "",
                connect_timeout=5,
            ),
            timeout=10,
        )
        latency = int((asyncio.get_event_loop().time() - start) * 1000)
        conn.close()
        return {"success": True, "message": "连接成功", "latency_ms": latency}
    except Exception as e:
        latency = int((asyncio.get_event_loop().time() - start) * 1000)
        return {"success": False, "message": f"{type(e).__name__}: {e}", "latency_ms": latency}


async def _test_redis(host: str, port: int, password: str, start: float) -> dict:
    import redis.asyncio as redis_lib
    try:
        r = await asyncio.wait_for(
            redis_lib.from_url(
                f"redis://:{url_quote(password, safe='')}@{host}:{port}",
                socket_connect_timeout=5,
            ),
            timeout=10,
        )
        await r.ping()
        latency = int((asyncio.get_event_loop().time() - start) * 1000)
        await r.aclose()
        return {"success": True, "message": "连接成功", "latency_ms": latency}
    except Exception as e:
        latency = int((asyncio.get_event_loop().time() - start) * 1000)
        return {"success": False, "message": f"{type(e).__name__}: {e}", "latency_ms": latency}


async def _test_tdengine(host: str, port: int, user: str, password: str,
                         database: str | None, start: float) -> dict:
    import taosws
    try:
        dsn = f"taosws://{url_quote(user, safe='')}:{url_quote(password, safe='')}@{host}:{port}"
        if database:
            dsn += f"/{database}"
        conn = await asyncio.wait_for(
            taosws.connect(dsn),
            timeout=10,
        )
        result = conn.query("SELECT 1")
        result.fetch_all()
        latency = int((asyncio.get_event_loop().time() - start) * 1000)
        conn.close()
        return {"success": True, "message": "连接成功", "latency_ms": latency}
    except Exception as e:
        latency = int((asyncio.get_event_loop().time() - start) * 1000)
        return {"success": False, "message": f"{type(e).__name__}: {e}", "latency_ms": latency}

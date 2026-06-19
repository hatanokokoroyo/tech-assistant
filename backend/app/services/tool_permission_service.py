"""Tool 权限解析服务 — 全局默认 → 项目覆盖 → 对话覆盖（内存态）"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.tool_permission_config import ToolPermissionConfig

# 全局默认策略（硬编码）
GLOBAL_DEFAULTS: dict[str, str] = {
    "read_file": "auto_approve",
    "search_content": "auto_approve",
    "list_directory": "auto_approve",
    "write_file": "ask_user",
    "run_command": "ask_user",
    "delete_file": "ask_user",
}

ALL_TOOLS = list(GLOBAL_DEFAULTS.keys())


async def get_effective_permissions(db: AsyncSession, project_id: int) -> dict[str, str]:
    """解析项目有效权限：全局默认 + 项目覆盖。"""
    effective = dict(GLOBAL_DEFAULTS)

    result = await db.execute(
        select(ToolPermissionConfig).where(
            ToolPermissionConfig.project_id == project_id,
            ToolPermissionConfig.deleted_at.is_(None),
        )
    )
    for cfg in result.scalars().all():
        effective[cfg.tool_name] = cfg.permission

    return effective


async def get_project_permissions(db: AsyncSession, project_id: int) -> list[dict]:
    """获取项目已显式配置的权限列表（仅覆盖项）。"""
    result = await db.execute(
        select(ToolPermissionConfig).where(
            ToolPermissionConfig.project_id == project_id,
            ToolPermissionConfig.deleted_at.is_(None),
        )
    )
    configs = result.scalars().all()

    return [
        {
            "id": c.id,
            "tool_name": c.tool_name,
            "permission": c.permission,
            "created_at": _fmt(c.created_at),
            "updated_at": _fmt(c.updated_at),
        }
        for c in configs
    ]


async def upsert_project_permissions(
    db: AsyncSession,
    project_id: int,
    permissions: list[dict],
) -> list[dict]:
    """批量更新项目权限配置。

    permissions: [{"tool_name": "write_file", "permission": "deny"}, ...]
    不传的 tool_name 保持 DB 现状。
    """
    # 1. 查询现有配置
    result = await db.execute(
        select(ToolPermissionConfig).where(
            ToolPermissionConfig.project_id == project_id,
            ToolPermissionConfig.deleted_at.is_(None),
        )
    )
    existing: dict[str, ToolPermissionConfig] = {
        c.tool_name: c for c in result.scalars().all()
    }

    # 2. Upsert
    for item in permissions:
        tool_name = item["tool_name"]
        perm = item["permission"]

        if tool_name in existing:
            cfg = existing[tool_name]
            cfg.permission = perm
            cfg.updated_at = func.now()
        else:
            cfg = ToolPermissionConfig(
                project_id=project_id,
                tool_name=tool_name,
                permission=perm,
            )
            db.add(cfg)

    await db.flush()

    # 3. 返回更新后的所有配置
    return await get_project_permissions(db, project_id)


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

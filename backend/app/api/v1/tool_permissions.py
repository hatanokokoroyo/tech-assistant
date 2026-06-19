"""Tool 权限配置 API 端点"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.tool_permission import (
    ToolPermissionUpsertRequest,
    EffectivePermissionsResponse,
)
from app.services import tool_permission_service
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["Tool权限配置"])


async def _verify_project_owner(db: AsyncSession, project_id: int, user_id: int):
    """校验项目归属：不存在抛 404，不属于当前用户抛 403。"""
    project = await project_service.get_project(db, project_id, user_id)
    if project is None:
        # 可能是项目不存在，或者属于其他用户
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在",
        )
    return project


@router.get("/{project_id}/tool-permissions")
async def get_tool_permissions(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取项目的有效 Tool 权限配置（全局默认 + 项目覆盖的合并结果）。"""
    await _verify_project_owner(db, project_id, user.id)
    effective = await tool_permission_service.get_effective_permissions(db, project_id)
    overrides = await tool_permission_service.get_project_permissions(db, project_id)

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "permissions": effective,
            "overrides": overrides,
        },
    }


@router.put("/{project_id}/tool-permissions")
async def update_tool_permissions(
    project_id: int,
    body: ToolPermissionUpsertRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """批量更新项目 Tool 权限配置。"""
    await _verify_project_owner(db, project_id, user.id)
    permissions = [p.model_dump() for p in body.permissions]
    overrides = await tool_permission_service.upsert_project_permissions(
        db, project_id, permissions,
    )
    await db.commit()

    effective = await tool_permission_service.get_effective_permissions(db, project_id)

    return {
        "code": 0,
        "message": "ok",
        "data": {
            "permissions": effective,
            "overrides": overrides,
        },
    }

"""数据源管理 REST API。

管理端点挂载在 /api/v1/projects/{project_id}/datasources 下。
这些 API 不注册到 Agent 的 Tool 列表中。
"""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.datasource import DatasourceCreate, DatasourceUpdate
from app.services import datasource_service as ds_svc
from app.services import project_service as proj_svc

logger = logging.getLogger(__name__)

router = APIRouter(tags=["数据源管理"])


def _ok(data=None, message: str = "ok") -> dict:
    return {"code": 0, "message": message, "data": data}


def _err(code: int, message: str) -> dict:
    return {"code": code, "message": message, "data": None}


@router.post("/projects/{project_id}/datasources")
async def create_datasource(
    project_id: int,
    body: DatasourceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """创建数据源。"""
    proj = await proj_svc.get_project(db, project_id, user.id)
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    ds = await ds_svc.create_datasource(
        db, project_id,
        name=body.name,
        db_type=body.db_type,
        host=body.host,
        port=body.port,
        password=body.password,
        database_name=body.database_name,
        username=body.username,
        extra_config=body.extra_config,
    )
    await db.commit()
    return _ok({
        "id": ds.id,
        "name": ds.name,
        "db_type": ds.db_type,
        "created_at": ds_svc._fmt(ds.created_at),
    }, "数据源创建成功")


@router.get("/projects/{project_id}/datasources")
async def list_datasources(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """列出项目下所有数据源。"""
    proj = await proj_svc.get_project(db, project_id, user.id)
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    items = await ds_svc.list_datasources(db, project_id)
    return _ok({"items": items, "total": len(items)})


@router.get("/projects/{project_id}/datasources/{ds_id}")
async def get_datasource(
    project_id: int,
    ds_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """获取数据源详情。"""
    proj = await proj_svc.get_project(db, project_id, user.id)
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    detail = await ds_svc.get_datasource(db, ds_id, project_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    return _ok(detail)


@router.put("/projects/{project_id}/datasources/{ds_id}")
async def update_datasource(
    project_id: int,
    ds_id: int,
    body: DatasourceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """更新数据源。password 为空字符串时保留原密码。"""
    proj = await proj_svc.get_project(db, project_id, user.id)
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    ds = await ds_svc.update_datasource(
        db, ds_id, project_id,
        name=body.name,
        host=body.host,
        port=body.port,
        database_name=body.database_name,
        username=body.username,
        password=body.password,
        extra_config=body.extra_config,
    )
    if ds is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    await db.commit()
    return _ok(message="数据源更新成功")


@router.delete("/projects/{project_id}/datasources/{ds_id}")
async def delete_datasource(
    project_id: int,
    ds_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """软删除数据源。"""
    proj = await proj_svc.get_project(db, project_id, user.id)
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    ok = await ds_svc.delete_datasource(db, ds_id, project_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="数据源不存在")
    await db.commit()
    return _ok(message="数据源已删除")


@router.post("/projects/{project_id}/datasources/{ds_id}/test")
async def test_datasource(
    project_id: int,
    ds_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """测试数据源连接。"""
    proj = await proj_svc.get_project(db, project_id, user.id)
    if proj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")

    result = await ds_svc.test_connection(db, ds_id, project_id)
    return _ok(result)

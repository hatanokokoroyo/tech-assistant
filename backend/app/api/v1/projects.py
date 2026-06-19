from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.code_repo import CodeRepo
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListItem, RepoBrief
from app.services import project_service

router = APIRouter(prefix="/projects", tags=["定制项目"])


@router.get("")
async def list_projects(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    items = await project_service.list_projects(db, user.id)
    return {"code": 0, "message": "ok", "data": {"items": items, "total": len(items)}}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_project(
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.create_project(db, user.id, body.name, body.description)
    return {"code": 0, "message": "ok", "data": _to_response_simple(project)}


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id, user.id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return {"code": 0, "message": "ok", "data": _to_response(project)}


@router.put("/{project_id}")
async def update_project(
    project_id: int,
    body: ProjectUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id, user.id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    await project_service.update_project(db, project, body.name, body.description)
    return {"code": 0, "message": "ok", "data": _to_response(project)}


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    project = await project_service.get_project(db, project_id, user.id)
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    await project_service.delete_project(db, project_id, user.id)
    return {"code": 0, "message": "ok", "data": None}


def _to_response(p: project_service.CustomProject) -> dict:
    repos = []
    for r in p.code_repos:
        if r.deleted_at is None:
            repos.append(RepoBrief(id=r.id, name=r.name, current_branch=r.current_branch))
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "description": p.description,
        "created_at": _fmt(p.created_at),
        "repos": [r.model_dump() for r in repos],
    }


def _to_response_simple(p) -> dict:
    return {
        "id": p.id,
        "user_id": p.user_id,
        "name": p.name,
        "description": p.description,
        "created_at": _fmt(p.created_at),
        "repos": [],
    }


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

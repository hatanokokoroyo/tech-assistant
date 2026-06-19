import os
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.custom_project import CustomProject
from app.models.code_repo import CodeRepo
from app.utils.path_utils import project_root


async def list_projects(db: AsyncSession, user_id: int) -> list[dict]:
    result = await db.execute(
        select(CustomProject).where(
            CustomProject.user_id == user_id,
            CustomProject.deleted_at.is_(None),
        )
    )
    projects = result.scalars().all()

    items = []
    for p in projects:
        count_result = await db.execute(
            select(func.count(CodeRepo.id)).where(
                CodeRepo.custom_project_id == p.id,
                CodeRepo.deleted_at.is_(None),
            )
        )
        repo_count = count_result.scalar() or 0
        items.append({
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "repo_count": repo_count,
            "created_at": _fmt(p.created_at),
        })
    return items


async def create_project(db: AsyncSession, user_id: int, name: str, description: str | None) -> CustomProject:
    project = CustomProject(user_id=user_id, name=name, description=description)
    db.add(project)
    await db.commit()
    await db.refresh(project)

    # 创建目录结构
    proj_dir = project_root(user_id, project.id)
    os.makedirs(proj_dir / "doc" / "log", exist_ok=True)
    os.makedirs(proj_dir / "doc" / "reference-doc", exist_ok=True)
    (proj_dir / "instructions.md").write_text(f"# {name}\n\n## 项目简介\n\n", encoding="utf-8")

    return project


async def get_project(db: AsyncSession, project_id: int, user_id: int) -> CustomProject | None:
    result = await db.execute(
        select(CustomProject).where(
            CustomProject.id == project_id,
            CustomProject.user_id == user_id,
            CustomProject.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def update_project(db: AsyncSession, project: CustomProject, name: str | None, description: str | None):
    if name is not None:
        project.name = name
    if description is not None:
        project.description = description
    await db.commit()
    await db.refresh(project)


async def delete_project(db: AsyncSession, project_id: int, user_id: int):
    project = await get_project(db, project_id, user_id)
    if project is None:
        return
    # 逻辑删除 DB 记录
    project.deleted_at = func.now()
    # 物理删除目录
    proj_dir = project_root(user_id, project_id)
    if proj_dir.exists():
        import shutil
        shutil.rmtree(proj_dir)
    # 级联逻辑删除子记录
    from app.models.code_repo import CodeRepo
    from app.models.conversation import Conversation
    from app.models.event_log import EventLog
    now = func.now()
    for model in [CodeRepo, Conversation, EventLog]:
        result = await db.execute(
            select(model).where(model.custom_project_id == project_id)
        )
        for obj in result.scalars().all():
            obj.deleted_at = now
    await db.commit()


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

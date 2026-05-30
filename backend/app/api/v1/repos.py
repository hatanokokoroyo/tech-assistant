from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.custom_project import CustomProject
from app.models.code_repo import CodeRepo
from app.schemas.repo import RepoCreate, RepoResponse, BranchResponse, CheckoutRequest
from app.services import repo_service

router = APIRouter(tags=["代码仓库"])


async def _get_project(project_id: int, user_id: int, db: AsyncSession) -> CustomProject:
    result = await db.execute(
        select(CustomProject).where(
            CustomProject.id == project_id,
            CustomProject.user_id == user_id,
            CustomProject.deleted_at.is_(None),
        )
    )
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="项目不存在")
    return project


@router.get("/projects/{project_id}/repos")
async def list_repos(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user.id, db)
    result = await db.execute(
        select(CodeRepo).where(
            CodeRepo.custom_project_id == project_id,
            CodeRepo.deleted_at.is_(None),
        )
    )
    repos = result.scalars().all()
    items = [RepoResponse(
        id=r.id, name=r.name, url=r.url,
        current_branch=r.current_branch,
        created_at=_fmt(r.created_at),
    ) for r in repos]
    return {"code": 0, "message": "ok", "data": {"items": items, "total": len(items)}}


@router.post("/projects/{project_id}/repos", status_code=status.HTTP_201_CREATED)
async def add_repo(
    project_id: int,
    body: RepoCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user.id, db)
    try:
        repo_service.git_clone(user.id, project_id, body.url, body.name)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"克隆失败: {str(e)}")

    repo = CodeRepo(
        custom_project_id=project_id,
        name=body.name,
        url=body.url,
        local_path=str(project_id) + "/" + body.name,
        current_branch="main",
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return {"code": 0, "message": "ok", "data": RepoResponse(
        id=repo.id, name=repo.name, url=repo.url,
        current_branch=repo.current_branch,
        created_at=_fmt(repo.created_at),
    )}


@router.delete("/projects/{project_id}/repos/{repo_id}")
async def delete_repo(
    project_id: int,
    repo_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user.id, db)
    result = await db.execute(
        select(CodeRepo).where(
            CodeRepo.id == repo_id,
            CodeRepo.custom_project_id == project_id,
            CodeRepo.deleted_at.is_(None),
        )
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="仓库不存在")

    repo.deleted_at = func_now()
    # 物理删除目录
    import shutil
    from app.utils.path_utils import sandbox_root
    repo_dir = sandbox_root(user.id) / str(project_id) / repo.name
    if repo_dir.exists():
        shutil.rmtree(repo_dir)
    await db.commit()
    return {"code": 0, "message": "ok", "data": None}


@router.get("/projects/{project_id}/repos/{repo_id}/branches")
async def get_branches(
    project_id: int,
    repo_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user.id, db)
    result = await db.execute(
        select(CodeRepo).where(
            CodeRepo.id == repo_id,
            CodeRepo.custom_project_id == project_id,
            CodeRepo.deleted_at.is_(None),
        )
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="仓库不存在")

    try:
        branches = repo_service.git_branches(user.id, project_id, repo.name)
        return {"code": 0, "message": "ok", "data": BranchResponse(**branches)}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"获取分支失败: {str(e)}")


@router.post("/projects/{project_id}/repos/{repo_id}/checkout")
async def checkout_branch(
    project_id: int,
    repo_id: int,
    body: CheckoutRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_project(project_id, user.id, db)
    result = await db.execute(
        select(CodeRepo).where(
            CodeRepo.id == repo_id,
            CodeRepo.custom_project_id == project_id,
            CodeRepo.deleted_at.is_(None),
        )
    )
    repo = result.scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="仓库不存在")

    try:
        repo_service.git_checkout(user.id, project_id, repo.name, body.branch)
        repo.current_branch = body.branch
        await db.commit()
        return {"code": 0, "message": "ok", "data": {"current_branch": body.branch}}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"切换分支失败: {str(e)}")


from sqlalchemy import func as sa_func

def func_now():
    return sa_func.now()


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

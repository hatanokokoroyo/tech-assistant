from fastapi import APIRouter, Depends, HTTPException, status
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.file import FileUpdateRequest
from app.services import file_service

router = APIRouter(tags=["文档操作"])


@router.get("/projects/{project_id}/files")
async def list_files(
    project_id: int,
    user: User = Depends(get_current_user),
):
    try:
        tree = file_service.get_file_tree(user.id, project_id)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return {"code": 0, "message": "ok", "data": {"tree": tree}}


@router.get("/projects/{project_id}/files/{file_path:path}")
async def get_file(
    project_id: int,
    file_path: str,
    user: User = Depends(get_current_user),
):
    try:
        result = file_service.read_file(user.id, project_id, file_path)
        return {"code": 0, "message": "ok", "data": result}
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="文件不存在")
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.put("/projects/{project_id}/files/{file_path:path}")
async def update_file(
    project_id: int,
    file_path: str,
    body: FileUpdateRequest,
    user: User = Depends(get_current_user),
):
    try:
        file_service.write_file(user.id, project_id, file_path, body.content)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return {"code": 0, "message": "ok", "data": {"path": file_path}}

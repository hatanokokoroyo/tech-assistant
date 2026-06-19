from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import event_service

router = APIRouter(tags=["事件日志"])


@router.post("/projects/{project_id}/events")
async def create_event(
    project_id: int,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    summary = body.get("summary", "").strip()
    if not summary:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="摘要不能为空")

    event = await event_service.create_event(
        db,
        custom_project_id=project_id,
        user_id=user.id,
        summary=summary,
        supplement=body.get("supplement"),
        conversation_id=body.get("conversation_id"),
    )
    return {"code": 0, "message": "ok", "data": {
        "id": event.id,
        "file_path": event.file_path,
        "created_at": _fmt(event.created_at),
    }}


@router.get("/projects/{project_id}/events")
async def list_events(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await event_service.list_events(db, project_id)
    return {"code": 0, "message": "ok", "data": {"items": items, "total": len(items)}}


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

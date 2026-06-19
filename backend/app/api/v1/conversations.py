from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.services import conversation_service as svc

router = APIRouter(tags=["AI对话"])


@router.get("/projects/{project_id}/conversations")
async def list_conversations(
    project_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items = await svc.list_conversations(db, user.id, project_id)
    return {"code": 0, "message": "ok", "data": {"items": items, "total": len(items)}}


@router.post("/projects/{project_id}/conversations", status_code=status.HTTP_201_CREATED)
async def create_conversation(
    project_id: int,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await svc.create_conversation(db, user.id, project_id, body.get("title"))
    return {"code": 0, "message": "ok", "data": {
        "id": conv.id,
        "title": conv.title,
        "created_at": _fmt(conv.created_at),
    }}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await svc.get_conversation(db, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")
    messages = await svc.get_messages(db, conversation_id)
    return {"code": 0, "message": "ok", "data": {
        "id": conv.id,
        "title": conv.title,
        "messages": messages,
        "total_prompt_tokens": conv.total_prompt_tokens,
        "total_completion_tokens": conv.total_completion_tokens,
        "total_tokens": conv.total_tokens,
        "total_cost": conv.total_cost,
        "total_api_rounds": conv.total_api_rounds,
        "total_cache_hit_tokens": conv.total_cache_hit_tokens,
        "created_at": _fmt(conv.created_at),
        "updated_at": _fmt(conv.updated_at),
    }}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await svc.get_conversation(db, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")
    await svc.delete_conversation(db, conversation_id)
    return {"code": 0, "message": "ok", "data": None}


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

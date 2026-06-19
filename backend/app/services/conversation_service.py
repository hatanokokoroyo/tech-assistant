from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from app.models.conversation import Conversation
from app.models.message import Message


async def list_conversations(db: AsyncSession, user_id: int, project_id: int) -> list[dict]:
    result = await db.execute(
        select(Conversation).where(
            Conversation.user_id == user_id,
            Conversation.custom_project_id == project_id,
            Conversation.deleted_at.is_(None),
        ).order_by(Conversation.updated_at.desc())
    )
    conversations = result.scalars().all()
    items = []
    for c in conversations:
        count_result = await db.execute(
            select(func.count(Message.id)).where(
                Message.conversation_id == c.id,
                Message.deleted_at.is_(None),
            )
        )
        msg_count = count_result.scalar() or 0
        items.append({
            "id": c.id,
            "title": c.title or "新对话",
            "message_count": msg_count,
            "total_prompt_tokens": c.total_prompt_tokens,
            "total_completion_tokens": c.total_completion_tokens,
            "total_tokens": c.total_tokens,
            "total_cost": c.total_cost,
            "total_api_rounds": c.total_api_rounds,
            "total_cache_hit_tokens": c.total_cache_hit_tokens,
            "created_at": _fmt(c.created_at),
            "updated_at": _fmt(c.updated_at),
        })
    return items


async def create_conversation(db: AsyncSession, user_id: int, project_id: int, title: str | None) -> Conversation:
    conv = Conversation(
        user_id=user_id,
        custom_project_id=project_id,
        title=title or "新对话",
    )
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return conv


async def get_conversation(db: AsyncSession, conv_id: int) -> Conversation | None:
    result = await db.execute(
        select(Conversation).where(
            Conversation.id == conv_id,
            Conversation.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_messages(db: AsyncSession, conv_id: int) -> list[dict]:
    result = await db.execute(
        select(Message).where(
            Message.conversation_id == conv_id,
            Message.deleted_at.is_(None),
        ).order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "tool_calls": m.tool_calls,
            "tool_call_id": m.tool_call_id,
            "tool_name": m.tool_name,
            "prompt_tokens": m.prompt_tokens,
            "completion_tokens": m.completion_tokens,
            "total_tokens": m.total_tokens,
            "cost": m.cost,
            "created_at": _fmt(m.created_at),
        }
        for m in messages
    ]


async def save_user_message(db: AsyncSession, conv_id: int, content: str) -> Message:
    msg = Message(conversation_id=conv_id, role="user", content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def save_assistant_message(db: AsyncSession, conv_id: int, content: str | None, tool_calls: list | None = None,
                                 prompt_tokens: int | None = None, completion_tokens: int | None = None,
                                 total_tokens: int | None = None, cost: float | None = None) -> Message:
    msg = Message(
        conversation_id=conv_id, role="assistant", content=content, tool_calls=tool_calls,
        prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
        total_tokens=total_tokens, cost=cost,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def save_tool_message(db: AsyncSession, conv_id: int, tool_call_id: str, tool_name: str, content: str) -> Message:
    msg = Message(
        conversation_id=conv_id,
        role="tool",
        content=content,
        tool_call_id=tool_call_id,
        tool_name=tool_name,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg


async def touch_conversation(db: AsyncSession, conv_id: int):
    await db.execute(
        update(Conversation).where(Conversation.id == conv_id).values(updated_at=func.now())
    )
    await db.commit()


async def update_conversation_usage(
    db: AsyncSession, conv_id: int,
    total_prompt_tokens: int, total_completion_tokens: int,
    total_tokens: int, total_cost: float,
    total_api_rounds: int = 0,
    total_cache_hit_tokens: int = 0,
):
    """更新对话的累计 token 和费用统计。"""
    await db.execute(
        update(Conversation).where(Conversation.id == conv_id).values(
            total_prompt_tokens=total_prompt_tokens,
            total_completion_tokens=total_completion_tokens,
            total_tokens=total_tokens,
            total_cost=total_cost,
            total_api_rounds=total_api_rounds,
            total_cache_hit_tokens=total_cache_hit_tokens,
            updated_at=func.now(),
        )
    )
    await db.commit()


async def delete_conversation(db: AsyncSession, conv_id: int):
    conv = await get_conversation(db, conv_id)
    if conv:
        conv.deleted_at = func.now()
        # 级联逻辑删除消息
        result = await db.execute(select(Message).where(Message.conversation_id == conv_id))
        for msg in result.scalars().all():
            msg.deleted_at = func.now()
        await db.commit()


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")

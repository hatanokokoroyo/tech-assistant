import os
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.event_log import EventLog
from app.utils.path_utils import sandbox_root


async def create_event(
    db: AsyncSession,
    custom_project_id: int,
    user_id: int,
    summary: str,
    supplement: str | None = None,
    conversation_id: int | None = None,
) -> EventLog:
    # 生成 Markdown 文件
    proj_dir = sandbox_root(user_id) / str(custom_project_id)
    log_dir = proj_dir / "doc" / "log"
    log_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{ts}_event.md"
    filepath = log_dir / filename

    content = f"# 事件处理记录\n\n"
    content += f"**时间**：{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    content += f"## 摘要\n\n{summary}\n"
    if supplement:
        content += f"\n## 补充说明\n\n{supplement}\n"

    filepath.write_text(content, encoding="utf-8")

    event = EventLog(
        custom_project_id=custom_project_id,
        user_id=user_id,
        conversation_id=conversation_id,
        summary=summary,
        supplement=supplement,
        file_path=str(filepath.relative_to(sandbox_root(user_id))),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event


async def list_events(db: AsyncSession, custom_project_id: int) -> list[dict]:
    from sqlalchemy import select
    result = await db.execute(
        select(EventLog).where(
            EventLog.custom_project_id == custom_project_id,
            EventLog.deleted_at.is_(None),
        ).order_by(EventLog.created_at.desc())
    )
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "summary": e.summary,
            "supplement": e.supplement,
            "file_path": e.file_path,
            "conversation_id": e.conversation_id,
            "created_at": _fmt(e.created_at),
        }
        for e in events
    ]


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

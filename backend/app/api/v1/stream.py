"""SSE 流式对话端点。

POST /api/conversations/{id}/stream
  → 流式返回 SSE 事件（message_start / token / message_end）
  → 同时将消息持久化到 PostgreSQL
"""

import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.ai import AiClient
from app.services import conversation_service as svc

logger = logging.getLogger(__name__)

router = APIRouter(tags=["AI流式对话"])


@router.post("/conversations/{conversation_id}/stream")
async def stream_chat(
    conversation_id: int,
    body: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await svc.get_conversation(db, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")

    user_content = body.get("content", "").strip()
    if not user_content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="消息内容不能为空")

    # 保存用户消息
    await svc.save_user_message(db, conversation_id, user_content)
    await svc.touch_conversation(db, conversation_id)
    await db.commit()

    # 获取历史消息
    history = await svc.get_messages(db, conversation_id)
    # 去掉刚保存的用户消息（会在 _build_messages 中单独追加）
    history = history[:-1]

    client = AiClient(user_id=user.id, custom_project_id=conv.custom_project_id)

    async def event_generator():
        yield _sse("message_start", {"conversation_id": conversation_id})

        # 收集 assistant 消息的各部分
        assistant_content_parts: list[str] = []
        assistant_tool_calls: list[dict] = []
        tool_results: list[dict] = []  # {tool_call_id, name, content}

        try:
            async for chunk in client.stream(user_content, history):
                if chunk["type"] == "token":
                    assistant_content_parts.append(chunk["content"])
                    yield _sse("token", {"type": "text", "content": chunk["content"]})

                elif chunk["type"] == "reasoning":
                    yield _sse("token", {"type": "reasoning", "content": chunk["content"]})

                elif chunk["type"] == "tool_call":
                    tc = chunk["tool_call"]
                    assistant_tool_calls = [tc] if not assistant_tool_calls or assistant_tool_calls[-1]["id"] != tc["id"] else assistant_tool_calls
                    # 更新或添加
                    found = False
                    for i, existing in enumerate(assistant_tool_calls):
                        if existing["id"] == tc["id"]:
                            assistant_tool_calls[i] = tc
                            found = True
                            break
                    if not found:
                        assistant_tool_calls.append(tc)

                    yield _sse("token", {
                        "type": "tool_call_progress",
                        "tool_call_id": tc["id"],
                        "tool_name": tc["function"]["name"],
                    })

                elif chunk["type"] == "tool_result":
                    tool_results.append({
                        "tool_call_id": chunk["tool_call_id"],
                        "name": chunk["name"],
                        "content": chunk["content"],
                    })
                    yield _sse("token", {
                        "type": "tool_result",
                        "tool_call_id": chunk["tool_call_id"],
                        "tool_name": chunk["name"],
                        "content": chunk["content"],
                    })

                elif chunk["type"] == "done":
                    pass

        except Exception as e:
            logger.exception("SSE 流式对话异常: %s", e)
            yield _sse("token", {"type": "text", "content": f"\n\n⚠️ 对话异常中断：{e}"})
            yield _sse("message_end", {"done": True})
            return

        # 持久化 assistant 消息
        if assistant_tool_calls:
            await svc.save_assistant_message(
                db, conversation_id,
                "".join(assistant_content_parts) or None,
                assistant_tool_calls,
            )
            # 补充缺失的 tool 响应（保证消息链完整性）
            saved_tool_ids = {tr["tool_call_id"] for tr in tool_results}
            for tc in assistant_tool_calls:
                tc_id = tc.get("id", "")
                if tc_id and tc_id not in saved_tool_ids:
                    logger.warning("tool_call %s 缺少响应，补充错误结果", tc_id)
                    tool_results.append({
                        "tool_call_id": tc_id,
                        "name": tc["function"]["name"],
                        "content": f"Error: 工具 {tc['function']['name']} 执行未完成",
                    })
            # 持久化 tool 消息
            for tr in tool_results:
                await svc.save_tool_message(
                    db, conversation_id,
                    tr["tool_call_id"], tr["name"], tr["content"],
                )
        else:
            await svc.save_assistant_message(
                db, conversation_id,
                "".join(assistant_content_parts),
            )

        await svc.touch_conversation(db, conversation_id)
        await db.commit()

        yield _sse("message_end", {"done": True})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"

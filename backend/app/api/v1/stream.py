"""SSE 流式对话端点。

POST /api/conversations/{id}/stream
  → 流式返回 SSE 事件（message_start / token / message_end）
  → 同时将消息持久化到 PostgreSQL

POST /api/conversations/{id}/tool-approval
  → 提交工具调用审批决定
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
from app.ai import approval as approval_mgr
from app.schemas.tool_permission import ToolApprovalRequest
from app.services import conversation_service as svc
from app.services import tool_permission_service as perm_svc

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
    history = history[:-1]  # 去掉刚保存的用户消息

    # 解析项目有效权限
    effective_permissions = await perm_svc.get_effective_permissions(db, conv.custom_project_id)

    client = AiClient(
        user_id=user.id,
        custom_project_id=conv.custom_project_id,
        conversation_id=conversation_id,
        effective_permissions=effective_permissions,
    )

    async def event_generator():
        yield _sse("message_start", {"conversation_id": conversation_id})

        assistant_content_parts: list[str] = []
        assistant_tool_calls: list[dict] = []
        tool_results: list[dict] = []

        try:
            async for chunk in client.stream(user_content, history):
                if chunk["type"] == "token":
                    assistant_content_parts.append(chunk["content"])
                    yield _sse("token", {"type": "text", "content": chunk["content"]})

                elif chunk["type"] == "reasoning":
                    yield _sse("token", {"type": "reasoning", "content": chunk["content"]})

                elif chunk["type"] == "tool_call":
                    tc = chunk["tool_call"]
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

                elif chunk["type"] == "tool_approval_required":
                    # 审批请求事件 — 前端弹出审批弹窗
                    yield _sse("tool_approval_required", {
                        "tool_call_id": chunk["tool_call_id"],
                        "tool_name": chunk["name"],
                        "arguments": chunk["arguments"],
                    })

                elif chunk["type"] == "tool_denied":
                    # 工具被拒绝 — 记录并通知前端
                    denied = {
                        "tool_call_id": chunk["tool_call_id"],
                        "name": chunk["name"],
                        "content": f"权限不足: 工具 {chunk['name']} 已被 {chunk.get('reason', '用户拒绝')}。",
                    }
                    tool_results.append(denied)
                    yield _sse("tool_denied", {
                        "tool_call_id": chunk["tool_call_id"],
                        "tool_name": chunk["name"],
                        "reason": chunk.get("reason", "unknown"),
                    })

                elif chunk["type"] == "done":
                    pass

        except asyncio.CancelledError:
            # SSE 连接被客户端断开（正常情况），保存部分消息后结束
            logger.info("[SSE] 连接断开: conv=%d, user=%d", conversation_id, user.id)
            try:
                await _persist_partial(
                    db, conversation_id,
                    assistant_content_parts, assistant_tool_calls, tool_results,
                )
            except Exception:
                logger.exception("保存部分消息失败")
            return
        except Exception as e:
            logger.exception("SSE 流式对话异常: %s", e)
            yield _sse("token", {"type": "text", "content": f"\n\n⚠️ 对话异常中断：{e}"})
            try:
                await _persist_partial(
                    db, conversation_id,
                    assistant_content_parts, assistant_tool_calls, tool_results,
                )
            except Exception:
                logger.exception("保存部分消息失败")
                yield _sse("token", {"type": "text", "content": "\n\n⚠️ 部分消息保存失败，对话记录可能不完整"})
            yield _sse("message_end", {"done": True})
            return
        finally:
            # 清理审批通道
            approval_mgr.cleanup(conversation_id)

        await _persist_partial(
            db, conversation_id,
            assistant_content_parts, assistant_tool_calls, tool_results,
        )

        yield _sse("message_end", {"done": True})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/conversations/{conversation_id}/tool-approval")
async def submit_tool_approval(
    conversation_id: int,
    body: ToolApprovalRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """提交工具调用审批决定。

    在 SSE 流进行中，用户看到审批弹窗后，通过此端点提交决定。
    """
    conv = await svc.get_conversation(db, conversation_id)
    if conv is None or conv.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")

    success = approval_mgr.approve(
        conversation_id=conversation_id,
        tool_call_id=body.tool_call_id,
        decision=body.decision,
        scope=body.scope or "once",
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="审批槽位不存在或已超时",
        )

    return {
        "code": 0,
        "message": "ok",
        "data": {"approved": body.decision == "approved"},
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


async def _persist_partial(
    db: AsyncSession,
    conversation_id: int,
    content_parts: list[str],
    tool_calls: list[dict],
    tool_results: list[dict],
):
    """保存已收到的部分消息，保证消息链完整性。"""
    content = "".join(content_parts) or None

    if tool_calls:
        await svc.save_assistant_message(db, conversation_id, content, tool_calls)
        all_results = list(tool_results)
        saved_ids = {tr["tool_call_id"] for tr in all_results}
        for tc in tool_calls:
            tc_id = tc.get("id", "")
            if tc_id and tc_id not in saved_ids:
                all_results.append({
                    "tool_call_id": tc_id,
                    "name": tc["function"]["name"],
                    "content": f"Error: 工具 {tc['function']['name']} 执行未完成（对话异常中断）",
                })
        for tr in all_results:
            await svc.save_tool_message(
                db, conversation_id,
                tr["tool_call_id"], tr["name"], tr["content"],
            )
    elif content:
        await svc.save_assistant_message(db, conversation_id, content)

    await svc.touch_conversation(db, conversation_id)
    await db.commit()

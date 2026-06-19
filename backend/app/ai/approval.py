"""审批通道管理 — 工具调用暂停/恢复机制。

AiClient.stream() 在遇到 ask_user 权限的工具时，创建 ApprovalSlot 并等待；
stream.py 的审批端点设置 decision 并唤醒 AiClient。
"""

import asyncio
import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# conversation_id → {tool_call_id: ApprovalSlot}
# NOTE: 同一 conversation 不应并发建立 SSE 流（当前 UI 禁止流中发送消息），
# 故此处无需 stream-level 隔离。若未来支持并发流，应改为 (conversation_id, stream_id) 作为 key。
_approval_channels: dict[int, dict[str, "ApprovalSlot"]] = {}

APPROVAL_TIMEOUT = 120  # 秒


@dataclass
class ApprovalSlot:
    """单个审批槽位."""
    tool_call_id: str
    tool_name: str
    arguments: dict
    event: asyncio.Event = field(default_factory=asyncio.Event)
    decision: str | None = None  # "approved" | "denied" | None (pending)
    scope: str = "once"  # "once" | "conversation"
    created_at: float = field(default_factory=time.monotonic)


def register(conversation_id: int, slot: "ApprovalSlot") -> None:
    """注册审批槽位，由 AiClient 调用来创建等待点。"""
    _approval_channels.setdefault(conversation_id, {})[slot.tool_call_id] = slot
    logger.info(
        "[approval] 注册审批: conv=%d, tool=%s, tc_id=%s",
        conversation_id, slot.tool_name, slot.tool_call_id,
    )


def approve(conversation_id: int, tool_call_id: str, decision: str, scope: str = "once") -> bool:
    """审批端点调用：设置 decision 并唤醒等待的 AiClient。返回是否成功。"""
    conv_channels = _approval_channels.get(conversation_id, {})
    slot = conv_channels.get(tool_call_id)

    if slot is None:
        logger.warning(
            "[approval] 审批失败：槽位不存在 conv=%d tc_id=%s",
            conversation_id, tool_call_id,
        )
        return False

    if slot.decision is not None:
        logger.warning("[approval] 重复审批: conv=%d tc_id=%s, 已有决策=%s",
                       conversation_id, tool_call_id, slot.decision)
        return False

    slot.decision = decision
    slot.scope = scope
    slot.event.set()
    logger.info(
        "[approval] ✅ 审批完成: conv=%d, tool=%s, tc_id=%s, decision=%s, scope=%s",
        conversation_id, slot.tool_name, tool_call_id, decision, scope,
    )
    return True


async def wait_for_approval(
    conversation_id: int,
    tool_call_id: str,
    timeout: float = APPROVAL_TIMEOUT,
) -> tuple[str, str]:
    """等待审批结果。返回 (decision, scope)。超时返回 ("denied", "once")。"""
    conv_channels = _approval_channels.get(conversation_id, {})
    slot = conv_channels.get(tool_call_id)

    if slot is None:
        logger.error("[approval] wait_for_approval 找不到槽位 conv=%d tc_id=%s",
                     conversation_id, tool_call_id)
        return ("denied", "once")

    try:
        await asyncio.wait_for(slot.event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(
            "[approval] ⏰ 审批超时 (%.0fs): conv=%d, tool=%s, tc_id=%s",
            timeout, conversation_id, slot.tool_name, tool_call_id,
        )
        slot.decision = "denied"
        slot.scope = "once"

    return (slot.decision or "denied", slot.scope or "once")


def cleanup(conversation_id: int) -> None:
    """SSE 流结束时清理该对话的所有审批槽位。"""
    removed = _approval_channels.pop(conversation_id, None)
    if removed:
        # 确保所有等待中的 Future 被唤醒
        for slot in removed.values():
            if slot.decision is None:
                slot.decision = "denied"
                slot.event.set()
        logger.info("[approval] 清理审批通道: conv=%d, slots=%d", conversation_id, len(removed))

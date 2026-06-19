"""DeepSeek API 客户端封装。

Usage:
    client = AiClient(user_id=1, custom_project_id=5)
    async for chunk in client.stream("用户问题", messages_history):
        yield chunk
"""

import json
import logging
from openai import AsyncOpenAI
from app.core.config import settings
from app.ai.schemas import TOOLS
from app.ai import tools as ai_tools
from app.ai import approval as approval_mgr

logger = logging.getLogger(__name__)


class AiClient:
    def __init__(
        self,
        user_id: int,
        custom_project_id: int,
        conversation_id: int,
        effective_permissions: dict[str, str] | None = None,
    ):
        self.user_id = user_id
        self.custom_project_id = custom_project_id
        self.conversation_id = conversation_id
        self.effective_permissions = effective_permissions or {}
        # 对话级内存态覆盖（前端审批时设 scope=conversation）
        self._conversation_overrides: dict[str, str] = {}
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        # 累计用量跟踪（跨多轮 agentic loop）
        self._total_prompt_tokens = 0
        self._total_completion_tokens = 0
        self._total_cache_hit_tokens = 0
        self._total_tokens = 0
        self._total_cost = 0.0
        self._api_rounds = 0

    # agentic loop 最大轮次，防止无限循环
    MAX_TOOL_ROUNDS: int = 100

    async def stream(self, user_message: str, history: list[dict]):
        """
        Agentic Loop：发送消息 → 流式收集 → 执行工具 → 再次发送，循环直到模型不再请求工具。

        chunk 类型：
          {"type": "token", "content": "..."}          — 文本片段
          {"type": "reasoning", "content": "..."}       — 思维链
          {"type": "tool_call", "tool_call": {...}}     — 工具调用（累积中）
          {"type": "tool_result", "tool_call_id": "...", "name": "...", "content": "..."}
          {"type": "tool_approval_required", "tool_call_id": "...", "name": "...", "arguments": {...}}
          {"type": "tool_denied", "tool_call_id": "...", "name": "...", "reason": "..."}
          {"type": "done"}                               — 流结束

        返回最终消息列表（含 assistant 消息 + tool 消息），调用方写入 DB。
        """
        messages = self._build_messages(user_message, history)

        for tool_round in range(self.MAX_TOOL_ROUNDS):
            is_first_round = tool_round == 0
            logger.info(
                "[stream] ▶ 第 %d 轮 API 请求: model=%s, messages=%d, %s",
                tool_round + 1, settings.deepseek_flash_model, len(messages),
                f"user_msg={_truncate(user_message, 120)}" if is_first_round else "continuing after tools",
            )
            logger.debug("[stream] 请求消息列表:\n%s", _format_messages(messages))

            stream = await self.client.chat.completions.create(
                model=settings.deepseek_flash_model,
                messages=messages,
                tools=TOOLS,
                stream=True,
                timeout=120,
            )

            # 收集 assistant 消息
            assistant_content = ""
            assistant_tool_calls: list[dict] = []
            chunk_count = 0
            round_usage = None

            async for event in stream:
                # 捕获本轮用量（最后一个 chunk 携带 usage）
                if event.usage is not None:
                    round_usage = event.usage

                delta = event.choices[0].delta if event.choices else None
                if delta is None:
                    continue

                chunk_count += 1

                # 文本内容
                if delta.content:
                    assistant_content += delta.content
                    yield {"type": "token", "content": delta.content}

                # 思维链 (reasoning_content 字段，DeepSeek 专有)
                if getattr(delta, "reasoning_content", None):
                    yield {"type": "reasoning", "content": delta.reasoning_content}

                # 工具调用
                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        if tc.index >= len(assistant_tool_calls):
                            assistant_tool_calls.append({
                                "id": tc.id or "",
                                "type": "function",
                                "function": {"name": tc.function.name or "", "arguments": ""},
                            })
                        current = assistant_tool_calls[tc.index]
                        if tc.id:
                            current["id"] = tc.id
                        if tc.function and tc.function.name:
                            current["function"]["name"] = tc.function.name
                        if tc.function and tc.function.arguments:
                            current["function"]["arguments"] += tc.function.arguments
                        yield {"type": "tool_call", "tool_call": current}

            # 流结束，记录结果摘要
            logger.info(
                "[stream] ◀ 第 %d 轮响应完成: chunks=%d, content_len=%d, tool_calls=%d",
                tool_round + 1, chunk_count, len(assistant_content), len(assistant_tool_calls),
            )

            # ── 捕获本轮 usage 信息 ──
            self._api_rounds += 1
            prompt_tokens = round_usage.prompt_tokens if round_usage else 0
            completion_tokens = round_usage.completion_tokens if round_usage else 0
            total_tokens = round_usage.total_tokens if round_usage else 0
            cache_hit_tokens = getattr(round_usage, "prompt_cache_hit_tokens", None) if round_usage else None
            cache_miss_tokens = getattr(round_usage, "prompt_cache_miss_tokens", None) if round_usage else None
            round_cost = self._calculate_cost(prompt_tokens, completion_tokens, cache_hit_tokens)

            self._total_prompt_tokens += prompt_tokens
            self._total_completion_tokens += completion_tokens
            self._total_tokens += total_tokens
            if cache_hit_tokens:
                self._total_cache_hit_tokens += cache_hit_tokens
            self._total_cost += round_cost

            if round_usage:
                logger.info(
                    "[stream] 📊 第 %d 轮用量: prompt=%d, completion=%d, total=%d, "
                    "cache_hit=%s, cache_miss=%s, cost=%.6f ｜ 累计: total=%d, cost=%.6f",
                    tool_round + 1, prompt_tokens, completion_tokens, total_tokens,
                    cache_hit_tokens, cache_miss_tokens, round_cost,
                    self._total_tokens, self._total_cost,
                )
                yield {
                    "type": "round_usage",
                    "model": settings.deepseek_flash_model,
                    "context_length": self._get_context_length(),
                    "round_prompt_tokens": prompt_tokens,
                    "round_completion_tokens": completion_tokens,
                    "round_total_tokens": total_tokens,
                    "round_cache_hit_tokens": cache_hit_tokens,
                    "round_cache_miss_tokens": cache_miss_tokens,
                    "round_cost": round_cost,
                    "total_prompt_tokens": self._total_prompt_tokens,
                    "total_completion_tokens": self._total_completion_tokens,
                    "total_tokens": self._total_tokens,
                    "total_cache_hit_tokens": self._total_cache_hit_tokens,
                    "total_cost": self._total_cost,
                    "api_rounds": self._api_rounds,
                }
            if assistant_content:
                logger.debug(
                    "[stream] assistant 文本内容: %s", _truncate(assistant_content, 200),
                )
            if assistant_tool_calls:
                for tc in assistant_tool_calls:
                    logger.info(
                        "[stream] assistant tool_call: id=%s, name=%s, args=%s",
                        tc["id"], tc["function"]["name"],
                        _truncate(tc["function"]["arguments"], 200),
                    )

            # 如果模型没有发起工具调用，循环结束
            if not assistant_tool_calls:
                break

            # 执行工具调用，将结果追加到消息列表，进入下一轮
            messages.append({
                "role": "assistant",
                "content": assistant_content or None,
                "tool_calls": assistant_tool_calls,
            })

            async for result_chunk in self._execute_tool_calls(assistant_tool_calls):
                if result_chunk["type"] == "tool_result":
                    yield result_chunk
                    messages.append({
                        "role": "tool",
                        "tool_call_id": result_chunk["tool_call_id"],
                        "content": result_chunk["content"],
                    })
                elif result_chunk["type"] == "tool_denied":
                    yield result_chunk
                    messages.append({
                        "role": "tool",
                        "tool_call_id": result_chunk["tool_call_id"],
                        "content": f"权限不足: 工具 {result_chunk['name']} 已被 {result_chunk.get('reason', '用户拒绝')}。",
                    })
                else:
                    yield result_chunk

            logger.debug("[stream] 第 %d 轮工具执行完毕，进入下一轮", tool_round + 1)
        else:
            # for 循环自然结束（未 break）= 达到最大轮次
            logger.warning(
                "[stream] 达到最大工具调用轮次 (%d)，强制结束", self.MAX_TOOL_ROUNDS,
            )

        yield {"type": "done", "usage": {
            "model": settings.deepseek_flash_model,
            "context_length": self._get_context_length(),
            "total_prompt_tokens": self._total_prompt_tokens,
            "total_completion_tokens": self._total_completion_tokens,
            "total_tokens": self._total_tokens,
            "total_cache_hit_tokens": self._total_cache_hit_tokens,
            "total_cost": self._total_cost,
            "api_rounds": self._api_rounds,
        }}

    def _build_messages(self, user_message: str, history: list[dict]) -> list[dict]:
        """构建发送给 DeepSeek 的消息列表。

        使用状态机方式遍历历史消息，确保消息顺序符合 API 要求：
        assistant(tool_calls) → tool(响应) → assistant/tool(响应) → ...

        当检测到消息链断裂（assistant 的 tool_calls 缺少对应 tool 响应）时，
        丢弃不完整的 assistant 消息，确保传给 API 的消息链始终完整。
        """
        system_prompt = (
            "你是一个技术助手，协助研发人员分析和解决技术问题。"
            f"你当前工作在一个定制项目中（ID={self.custom_project_id}），"
            f"可以访问该项目下的代码仓库和文档。"
            "你有工具可以读取文件、搜索代码、执行命令。"
            "请逐步推理，先理解问题，再使用工具收集信息，最后给出分析结论。"
            "回复使用中文。"
        )
        messages = [{"role": "system", "content": system_prompt}]

        # 包含历史消息（最近 20 轮）
        history_msgs = history[-40:]
        logger.debug(
            "[_build_messages] 开始构建消息列表: user_id=%s, project_id=%s, "
            "历史消息总数=%d, 截取后=%d",
            self.user_id, self.custom_project_id, len(history), len(history_msgs),
        )

        # 状态机：待响应的 tool_call_id 集合
        pending_tool_ids: set[str] = set()
        # 缓冲区：尚未确认完整的 assistant 消息（含 tool_calls 时延迟追加）
        buffered_assistant: dict | None = None
        # 记录缓冲 assistant 在 messages 中的位置（用于截断）
        buffered_assistant_idx: int = -1

        for msg in history_msgs:
            role = msg.get("role", "")

            if role == "assistant" and msg.get("tool_calls"):
                # 检查：如果还有未响应的 tool_calls，说明消息链断裂
                if pending_tool_ids:
                    logger.warning(
                        "消息链断裂：存在未响应的 tool_calls: %s，截断后续消息",
                        pending_tool_ids,
                    )
                    break

                # 提取 tool_call_ids
                tc_ids = {tc.get("id", "") for tc in msg["tool_calls"] if tc.get("id")}
                if not tc_ids:
                    logger.warning("assistant 消息的 tool_calls 缺少 id，跳过")
                    continue

                pending_tool_ids = tc_ids
                # 缓冲 assistant 消息，等 tool 响应到齐后再追加
                buffered_assistant = {
                    "role": "assistant",
                    "tool_calls": msg["tool_calls"],
                    "content": msg.get("content") or None,
                }
                buffered_assistant_idx = len(messages)
                logger.debug(
                    "[_build_messages] 历史 assistant(tool_calls): ids=%s, content=%s",
                    tc_ids,
                    _truncate(msg.get("content") or "", 80),
                )

            elif role == "tool":
                tc_id = msg.get("tool_call_id", "")
                if not tc_id:
                    logger.warning("tool 消息缺少 tool_call_id，跳过")
                    continue

                # 如果有缓冲的 assistant 消息，先追加
                if buffered_assistant is not None:
                    messages.append(buffered_assistant)
                    buffered_assistant = None

                # 移除已响应的 tool_call_id
                pending_tool_ids.discard(tc_id)
                messages.append({
                    "role": "tool",
                    "content": msg.get("content") or "",
                    "tool_call_id": tc_id,
                })
                logger.debug(
                    "[_build_messages] 历史 tool: id=%s, name=%s, content=%s",
                    tc_id, msg.get("tool_name", ""),
                    _truncate(msg.get("content") or "", 80),
                )

            elif role in ("user", "system"):
                # 检查：如果还有未响应的 tool_calls，说明消息链断裂
                if pending_tool_ids:
                    logger.warning(
                        "消息链断裂：存在未响应的 tool_calls: %s，截断后续消息",
                        pending_tool_ids,
                    )
                    break

                # 丢弃缓冲的 assistant（理论上不会走到这里）
                buffered_assistant = None
                messages.append({
                    "role": role,
                    "content": msg.get("content") or "",
                })
                logger.debug(
                    "[_build_messages] 历史 %s: content=%s",
                    role, _truncate(msg.get("content") or "", 80),
                )

            else:
                logger.warning("未知消息角色: %s，跳过", role)
                continue

        # 循环结束后：如果仍有未响应的 tool_calls，截断不完整的 assistant
        if pending_tool_ids and buffered_assistant_idx >= 0:
            logger.warning(
                "历史消息末尾存在未响应的 tool_calls: %s，截断不完整 assistant 消息",
                pending_tool_ids,
            )
            messages = messages[:buffered_assistant_idx]

        messages.append({"role": "user", "content": user_message})
        logger.info(
            "[_build_messages] 构建完成: 共 %d 条消息 (含 system), "
            "roles=%s, pending_tool_ids=%s",
            len(messages),
            [m["role"] + ("(tc)" if m.get("tool_calls") else "") for m in messages],
            pending_tool_ids or None,
        )
        logger.debug("[_build_messages] 完整消息列表:\n%s", _format_messages(messages))
        return messages

    def _execute_tool(self, name: str, args: dict) -> str:
        """执行单个工具调用，返回结果字符串。"""
        try:
            if name == "run_command":
                return ai_tools.run_command(
                    self.user_id, self.custom_project_id,
                    args.get("command", ""),
                    args.get("work_dir"),
                    args.get("timeout_seconds", 30),
                )
            elif name == "read_file":
                return ai_tools.read_file(
                    self.user_id, self.custom_project_id,
                    args.get("file_path", ""),
                    args.get("head"), args.get("tail"),
                )
            elif name == "write_file":
                return ai_tools.write_file(
                    self.user_id, self.custom_project_id,
                    args.get("file_path", ""), args.get("content", ""),
                )
            elif name == "search_content":
                return ai_tools.search_content(
                    self.user_id, self.custom_project_id,
                    args.get("pattern", ""),
                    args.get("path"), args.get("glob"),
                    args.get("case_sensitive", False),
                    args.get("context", 2),
                )
            elif name == "list_directory":
                return ai_tools.list_directory(
                    self.user_id, self.custom_project_id,
                    args.get("path", ""),
                )
            elif name == "delete_file":
                return ai_tools.delete_file(
                    self.user_id, self.custom_project_id,
                    args.get("file_path", ""),
                )
            else:
                return f"Error: 未知工具 {name}"
        except PermissionError as e:
            return f"Error: 路径越界 — {e}"
        except Exception as e:
            return f"Error: {type(e).__name__} — {e}"

    def _resolve_permission(self, tool_name: str) -> str:
        """解析工具的最终权限：对话覆盖 > 项目配置 > 全局默认。"""
        if tool_name in self._conversation_overrides:
            return self._conversation_overrides[tool_name]
        return self.effective_permissions.get(tool_name, "ask_user")

    def _calculate_cost(self, prompt_tokens: int, completion_tokens: int,
                        cache_hit_tokens: int | None = None) -> float:
        """根据模型和 token 用量计算费用（元）。

        区分 cached / 常规 input tokens，使用 settings 中配置的单价。
        """
        # 当前使用的模型
        model = settings.deepseek_flash_model
        if model == settings.deepseek_pro_model:
            input_price = settings.deepseek_pro_input_price
            output_price = settings.deepseek_pro_output_price
            cached_input_price = settings.deepseek_pro_cached_input_price
        else:
            input_price = settings.deepseek_flash_input_price
            output_price = settings.deepseek_flash_output_price
            cached_input_price = settings.deepseek_flash_cached_input_price

        # 计算 input 费用：优先扣除缓存 tokens
        if cache_hit_tokens and cache_hit_tokens > 0:
            regular_input = max(0, prompt_tokens - cache_hit_tokens)
            cost = (
                regular_input / 1000 * input_price
                + cache_hit_tokens / 1000 * cached_input_price
                + completion_tokens / 1000 * output_price
            )
        else:
            cost = prompt_tokens / 1000 * input_price + completion_tokens / 1000 * output_price

        return round(cost, 8)

    def _get_context_length(self) -> int:
        """返回当前模型的最大上下文长度。"""
        if settings.deepseek_flash_model == settings.deepseek_pro_model:
            return settings.deepseek_pro_context_length
        return settings.deepseek_flash_context_length

    async def _execute_tool_calls(self, tool_calls: list[dict]):
        """执行工具调用列表，带权限检查。

        对于 auto_approve 的工具：直接执行，yield tool_result。
        对于 ask_user 的工具：yield tool_approval_required，等待用户审批。
        对于 deny 的工具：yield tool_denied，不执行。

        批量审批：收集所有 ask_user 的工具，统一发出审批请求后等待。
        """
        # 分类工具调用
        auto_tasks: list[dict] = []
        pending_approvals: list[dict] = []
        denied_tasks: list[dict] = []

        for tc in tool_calls:
            func_name = tc["function"]["name"]
            perm = self._resolve_permission(func_name)

            if perm == "deny":
                denied_tasks.append(tc)
            elif perm == "ask_user":
                pending_approvals.append(tc)
            else:  # auto_approve
                auto_tasks.append(tc)

        # 1. 先 yield 被拒绝的工具
        for tc in denied_tasks:
            func_name = tc["function"]["name"]
            logger.info("[stream] 🚫 禁止执行: name=%s", func_name)
            yield {
                "type": "tool_denied",
                "tool_call_id": tc["id"],
                "name": func_name,
                "reason": "policy_deny",
            }

        # 2. 自动执行：无需等待
        for tc in auto_tasks:
            func_name = tc["function"]["name"]
            try:
                args = json.loads(tc["function"]["arguments"])
            except json.JSONDecodeError:
                args = {}

            logger.info("[stream] ⚙ 自动执行: name=%s", func_name)
            result = self._run_tool(func_name, args)
            yield {
                "type": "tool_result",
                "tool_call_id": tc["id"],
                "name": func_name,
                "content": result,
            }

        # 3. 需要审批的工具：发出审批请求并等待
        if pending_approvals:
            batch_slots = []
            for tc in pending_approvals:
                func_name = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    args = {}

                slot = approval_mgr.ApprovalSlot(
                    tool_call_id=tc["id"],
                    tool_name=func_name,
                    arguments=args,
                )
                approval_mgr.register(self.conversation_id, slot)
                batch_slots.append(slot)

                yield {
                    "type": "tool_approval_required",
                    "tool_call_id": tc["id"],
                    "name": func_name,
                    "arguments": args,
                }

            # 等待所有审批结果
            for slot in batch_slots:
                decision, scope = await approval_mgr.wait_for_approval(
                    self.conversation_id, slot.tool_call_id,
                )

                if scope == "conversation" and decision == "approved":
                    # 对话级覆盖：后续同类型工具自动通过
                    self._conversation_overrides[slot.tool_name] = "auto_approve"
                    logger.info(
                        "[stream] 📝 对话级覆盖: tool=%s → auto_approve",
                        slot.tool_name,
                    )

                if decision == "approved":
                    logger.info(
                        "[stream] ✅ 审批通过: name=%s", slot.tool_name,
                    )
                    result = self._run_tool(slot.tool_name, slot.arguments)
                    yield {
                        "type": "tool_result",
                        "tool_call_id": slot.tool_call_id,
                        "name": slot.tool_name,
                        "content": result,
                    }
                else:
                    logger.info(
                        "[stream] ❌ 审批拒绝: name=%s", slot.tool_name,
                    )
                    yield {
                        "type": "tool_denied",
                        "tool_call_id": slot.tool_call_id,
                        "name": slot.tool_name,
                        "reason": "user_denied",
                    }

    def _run_tool(self, name: str, args: dict) -> str:
        """执行单个工具并返回结果字符串（无权限检查）。"""
        logger.info(
            "[stream] ⚙ 执行工具: name=%s, args=%s",
            name, _truncate(json.dumps(args, ensure_ascii=False), 200),
        )
        try:
            result = self._execute_tool(name, args)
        except Exception as e:
            logger.error("工具执行异常: %s", e)
            result = f"Error: 工具执行异常 — {type(e).__name__}: {e}"

        logger.info("[stream] ✓ 工具结果: name=%s, result=%s", name, _truncate(result, 200))
        return result


def _truncate(text: str, max_len: int = 200) -> str:
    """截断文本用于日志显示，超长部分用省略号。"""
    if len(text) <= max_len:
        return text
    return text[:max_len] + f"...({len(text)} chars)"


def _format_messages(messages: list[dict]) -> str:
    """格式化消息列表用于 DEBUG 日志，每条消息显示角色和关键字段。"""
    lines = []
    for i, msg in enumerate(messages):
        role = msg.get("role", "?")
        parts = [f"[{i}] {role}"]

        if msg.get("tool_calls"):
            tc_summary = [
                f"{tc.get('function', {}).get('name', '?')}({tc.get('id', '?')[:16]})"
                for tc in msg["tool_calls"]
            ]
            parts.append(f"tool_calls=[{', '.join(tc_summary)}]")

        if msg.get("tool_call_id"):
            parts.append(f"tool_call_id={msg['tool_call_id'][:16]}")

        content = msg.get("content")
        if content:
            parts.append(f"content={_truncate(content, 100)}")
        elif content is None and role == "assistant":
            parts.append("content=None")

        lines.append(" ".join(parts))
    return "\n".join(lines)

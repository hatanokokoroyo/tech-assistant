"""DeepSeek API 客户端封装。

Usage:
    client = AiClient(user_id=1, custom_project_id=5)
    async for chunk in client.stream("用户问题", messages_history):
        yield chunk
"""

import json
from openai import AsyncOpenAI
from app.core.config import settings
from app.ai.schemas import TOOLS
from app.ai import tools as ai_tools


class AiClient:
    def __init__(self, user_id: int, custom_project_id: int):
        self.user_id = user_id
        self.custom_project_id = custom_project_id
        self.client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )

    async def stream(self, user_message: str, history: list[dict]):
        """
        发送消息并流式返回 chunk dicts。
        chunk 类型：
          {"type": "token", "content": "..."}          — 文本片段
          {"type": "reasoning", "content": "..."}       — 思维链
          {"type": "tool_call", "tool_call": {...}}     — 工具调用（累积中）
          {"type": "tool_result", "tool_call_id": "...", "name": "...", "content": "..."}
          {"type": "done"}                               — 流结束

        返回最终消息列表（含 assistant 消息 + tool 消息），调用方写入 DB。
        """
        messages = self._build_messages(user_message, history)

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
        current_tool_call: dict | None = None

        async for event in stream:
            delta = event.choices[0].delta if event.choices else None
            if delta is None:
                continue

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

        # 如果 AI 发起了工具调用，执行并继续
        if assistant_tool_calls:
            # 保存 assistant 消息
            messages.append({
                "role": "assistant",
                "content": assistant_content or None,
                "tool_calls": assistant_tool_calls,
            })

            # 执行每个工具调用
            for tc in assistant_tool_calls:
                func_name = tc["function"]["name"]
                try:
                    args = json.loads(tc["function"]["arguments"])
                except json.JSONDecodeError:
                    args = {}

                result = self._execute_tool(func_name, args)
                yield {"type": "tool_result", "tool_call_id": tc["id"], "name": func_name, "content": result}
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })

            # 递归调用以获取最终回复
            async for chunk in self._stream_after_tools(messages):
                yield chunk

        yield {"type": "done"}

    async def _stream_after_tools(self, messages: list[dict]):
        stream = await self.client.chat.completions.create(
            model=settings.deepseek_flash_model,
            messages=messages,
            tools=TOOLS,
            stream=True,
            timeout=120,
        )
        content = ""
        async for event in stream:
            delta = event.choices[0].delta if event.choices else None
            if delta is None:
                continue
            if delta.content:
                content += delta.content
                yield {"type": "token", "content": delta.content}
            if getattr(delta, "reasoning_content", None):
                yield {"type": "reasoning", "content": delta.reasoning_content}

    def _build_messages(self, user_message: str, history: list[dict]) -> list[dict]:
        """构建发送给 DeepSeek 的消息列表。"""
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
        for msg in history[-40:]:
            entry = {"role": msg["role"], "content": msg["content"]}
            if msg["role"] == "assistant" and msg.get("tool_calls"):
                entry["tool_calls"] = msg["tool_calls"]
                entry["content"] = msg.get("content") or None
            if msg["role"] == "tool":
                entry["tool_call_id"] = msg.get("tool_call_id", "")
            messages.append(entry)

        messages.append({"role": "user", "content": user_message})
        return messages

    def _execute_tool(self, name: str, args: dict) -> str:
        """执行单个工具调用，返回结果字符串。"""
        try:
            if name == "run_command":
                return ai_tools.run_command(
                    self.user_id,
                    args.get("command", ""),
                    args.get("work_dir"),
                    args.get("timeout_seconds", 30),
                )
            elif name == "read_file":
                return ai_tools.read_file(
                    self.user_id, args.get("file_path", ""),
                    args.get("head"), args.get("tail"),
                )
            elif name == "write_file":
                return ai_tools.write_file(
                    self.user_id,
                    args.get("file_path", ""), args.get("content", ""),
                )
            elif name == "search_content":
                return ai_tools.search_content(
                    self.user_id, args.get("pattern", ""),
                    args.get("path"), args.get("glob"),
                    args.get("case_sensitive", False),
                    args.get("context", 2),
                )
            elif name == "list_directory":
                return ai_tools.list_directory(self.user_id, args.get("path", ""))
            elif name == "delete_file":
                return ai_tools.delete_file(self.user_id, args.get("file_path", ""))
            else:
                return f"Error: 未知工具 {name}"
        except PermissionError as e:
            return f"Error: 路径越界 — {e}"
        except Exception as e:
            return f"Error: {type(e).__name__} — {e}"

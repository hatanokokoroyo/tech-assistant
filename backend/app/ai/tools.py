"""Tool Calls 执行器 — 在沙箱 /data/tech-assistant/<user_id>/<project_id>/ 内运行。

所有路径操作都经过 path_utils 校验，限定在对话所属项目目录内，防止 AI 逃逸。写入/删除操作限制在 instructions.md 和 doc/ 目录内。
"""

import subprocess
from pathlib import Path
from app.utils.path_utils import safe_resolve, allowed_document_path, project_root


def _resolve(user_id: int, project_id: int, file_path: str) -> Path:
    """将 AI 传入的路径解析为项目沙箱内安全路径。"""
    return safe_resolve(user_id, file_path.lstrip("/"), project_id=project_id)


def run_command(
    user_id: int,
    project_id: int,
    command: str,
    work_dir: str | None = None,
    timeout_seconds: int | None = 30,
) -> str:
    # 命令白名单检查（禁止危险操作）
    dangerous = ["rm -rf /", "sudo", "su ", "mkfs", "dd if=", ":(){ :|:& };:"]
    cmd_lower = command.lower()
    for d in dangerous:
        if d in cmd_lower:
            return f"Error: 危险命令被拦截：{d}"

    cwd = str(project_root(user_id, project_id))
    if work_dir:
        cwd = str(_resolve(user_id, project_id, work_dir))

    timeout = min(timeout_seconds or 30, 120)
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            cwd=cwd, timeout=timeout,
        )
        output = result.stdout
        if result.stderr:
            output += "\n[stderr]\n" + result.stderr
        if result.returncode != 0:
            output += f"\n[exit={result.returncode}]"
        return output or "(no output)"
    except subprocess.TimeoutExpired:
        return f"Error: 命令超时（{timeout}秒）"
    except Exception as e:
        return f"Error: {str(e)}"


def read_file(
    user_id: int,
    project_id: int,
    file_path: str,
    head: int | None = None,
    tail: int | None = None,
) -> str:
    target = _resolve(user_id, project_id, file_path)
    if not target.exists():
        return f"Error: 文件不存在：{file_path}"
    if not target.is_file():
        return f"Error: 不是文件：{file_path}"

    lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
    if head:
        lines = lines[:head]
    elif tail:
        lines = lines[-tail:]

    if len(lines) > 500:
        lines = lines[:500]
        lines.append("... (truncated, showing first 500 lines)")

    return "\n".join(lines)


def write_file(
    user_id: int,
    project_id: int,
    file_path: str,
    content: str,
) -> str:
    target = allowed_document_path(user_id, project_id, file_path.lstrip("/"))
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return f"OK: 已写入 {file_path} ({len(content)} 字节)"


def search_content(
    user_id: int,
    project_id: int,
    pattern: str,
    path: str | None = None,
    glob: str | None = None,
    case_sensitive: bool = False,
    context: int = 2,
) -> str:
    if path:
        base = _resolve(user_id, project_id, path)
    else:
        base = project_root(user_id, project_id)

    flags = "" if case_sensitive else "-i"
    grep_cmd = ["grep", "-rn", flags]
    if context:
        grep_cmd.extend([f"-C{context}"])
    if glob:
        grep_cmd.extend(["--include", glob])
    grep_cmd.extend([pattern, str(base)])

    try:
        result = subprocess.run(grep_cmd, capture_output=True, text=True, timeout=30)
        output = result.stdout
        if not output:
            return "(no matches)"
        lines = output.strip().split("\n")
        if len(lines) > 100:
            lines = lines[:100]
            lines.append("... (truncated, showing first 100 matches)")
        return "\n".join(lines)
    except Exception as e:
        return f"Error: {str(e)}"


def list_directory(user_id: int, project_id: int, path: str) -> str:
    target = _resolve(user_id, project_id, path)
    if not target.exists():
        return f"Error: 目录不存在：{path}"
    if not target.is_dir():
        return f"Error: 不是目录：{path}"

    lines = []
    try:
        for entry in sorted(target.iterdir(), key=lambda x: (x.is_file(), x.name)):
            tag = "/" if entry.is_dir() else ""
            lines.append(f"{entry.name}{tag}")
    except PermissionError:
        return "Error: 无权限访问"

    if not lines:
        return "(empty)"
    return "\n".join(lines)


def delete_file(user_id: int, project_id: int, file_path: str) -> str:
    target = allowed_document_path(user_id, project_id, file_path.lstrip("/"))
    if not target.exists():
        return f"Error: 文件不存在：{file_path}"
    if target.is_dir():
        return f"Error: 是目录，不可删除：{file_path}"
    target.unlink()
    return f"OK: 已删除 {file_path}"

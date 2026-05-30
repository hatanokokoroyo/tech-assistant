from pathlib import Path
from app.core.config import settings


def sandbox_root(user_id: int) -> Path:
    return Path(settings.sandbox_root) / str(user_id)


def safe_resolve(user_id: int, relative_path: str) -> Path:
    """将相对路径解析为沙箱内的安全绝对路径。
    若路径逃逸出用户工作区，抛出 PermissionError。
    """
    sandbox = sandbox_root(user_id).resolve()
    target = (sandbox / relative_path).resolve()
    if not str(target).startswith(str(sandbox)):
        raise PermissionError(f"路径越界: {relative_path}")
    return target


def allowed_document_path(user_id: int, relative_path: str) -> Path:
    """仅允许操作 docs 区域的路径：
    - instructions.md
    - doc/**/*.md
    """
    target = safe_resolve(user_id, relative_path)
    sandbox = sandbox_root(user_id).resolve()
    rel = target.relative_to(sandbox)

    parts = rel.parts
    if len(parts) == 1 and parts[0] == "instructions.md":
        return target
    if len(parts) >= 2 and parts[0] == "doc":
        return target
    raise PermissionError(f"不允许操作的路径: {relative_path}")

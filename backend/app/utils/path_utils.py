from pathlib import Path
from app.core.config import settings


def sandbox_root(user_id: int) -> Path:
    """用户级沙箱根路径（用于 SSH 密钥等用户级资源）。"""
    return Path(settings.sandbox_root) / str(user_id)


def project_root(user_id: int, project_id: int) -> Path:
    """项目级沙箱根路径（用于 AI 工具操作和代码仓库）。"""
    return sandbox_root(user_id) / str(project_id)


def safe_resolve(user_id: int, relative_path: str, project_id: int | None = None) -> Path:
    """将相对路径解析为沙箱内的安全绝对路径。

    - 若提供 project_id，路径限定在 /sandbox/{user_id}/{project_id}/ 下
    - 否则限定在 /sandbox/{user_id}/ 下
    - 若路径逃逸出允许范围，抛出 PermissionError。
    """
    if project_id is not None:
        sandbox = project_root(user_id, project_id).resolve()
        target = (Path(settings.sandbox_root) / str(user_id) / str(project_id) / relative_path).resolve()
    else:
        sandbox = sandbox_root(user_id).resolve()
        target = (sandbox / relative_path).resolve()

    if not str(target).startswith(str(sandbox)):
        raise PermissionError(f"路径越界: {relative_path}")
    return target


def allowed_document_path(user_id: int, project_id: int, relative_path: str) -> Path:
    """仅允许操作 docs 区域的路径：
    - instructions.md
    - doc/**/*.md
    """
    target = safe_resolve(user_id, relative_path, project_id=project_id)
    sandbox = project_root(user_id, project_id).resolve()

    try:
        rel = target.relative_to(sandbox)
    except ValueError:
        raise PermissionError(f"不允许操作的路径: {relative_path}")

    parts = rel.parts
    if len(parts) == 1 and parts[0] == "instructions.md":
        return target
    if len(parts) >= 2 and parts[0] == "doc":
        return target
    raise PermissionError(f"不允许操作的路径: {relative_path}")

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


def allowed_document_path(user_id: int, project_id: int, relative_path: str) -> Path:
    """仅允许操作 docs 区域的路径：
    - instructions.md
    - doc/**/*.md
    """
    # 构建沙箱内完整路径: /data/tech-assistant/{user_id}/{project_id}/{relative_path}
    target = safe_resolve(user_id, f"{project_id}/{relative_path}")
    sandbox = sandbox_root(user_id).resolve()
    # 校验时使用项目内的相对路径（不含 project_id 前缀）
    proj_dir = (sandbox / str(project_id)).resolve()
    try:
        rel = target.relative_to(proj_dir)
    except ValueError:
        raise PermissionError(f"不允许操作的路径: {relative_path}")

    parts = rel.parts
    if len(parts) == 1 and parts[0] == "instructions.md":
        return target
    if len(parts) >= 2 and parts[0] == "doc":
        return target
    raise PermissionError(f"不允许操作的路径: {relative_path}")

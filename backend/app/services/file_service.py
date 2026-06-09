import os
from datetime import datetime
from pathlib import Path
from app.utils.path_utils import sandbox_root, allowed_document_path


def get_file_tree(user_id: int, project_id: int) -> list[dict]:
    proj_dir = sandbox_root(user_id) / str(project_id)

    def _build_tree(dir_path: Path, rel: str) -> list[dict]:
        nodes = []
        try:
            for entry in sorted(dir_path.iterdir(), key=lambda x: (x.is_file(), x.name)):
                if entry.name.startswith(".") or entry.name in ("doc", "instructions.md"):
                    if entry.name == "instructions.md":
                        nodes.append({"name": entry.name, "type": "file", "path": entry.name})
                    elif entry.name == "doc":
                        doc_children = _build_tree(entry, "doc")
                        nodes.append({"name": "doc", "type": "directory", "path": "doc", "children": doc_children})
                    continue
        except PermissionError:
            pass
        return nodes

    result = []
    instructions = proj_dir / "instructions.md"
    if instructions.exists():
        result.append({"name": "instructions.md", "type": "file", "path": "instructions.md"})

    doc_dir = proj_dir / "doc"
    if doc_dir.exists():
        doc_children = _build_doc_tree(doc_dir, "doc")
        result.append({"name": "doc", "type": "directory", "path": "doc", "children": doc_children})

    return result


def _build_doc_tree(dir_path: Path, rel: str) -> list[dict]:
    nodes = []
    try:
        for entry in sorted(dir_path.iterdir(), key=lambda x: (x.is_file(), x.name)):
            if entry.name.startswith("."):
                continue
            entry_rel = f"{rel}/{entry.name}"
            if entry.is_dir():
                children = _build_doc_tree(entry, entry_rel)
                nodes.append({"name": entry.name, "type": "directory", "path": entry_rel, "children": children})
            else:
                nodes.append({"name": entry.name, "type": "file", "path": entry_rel})
    except PermissionError:
        pass
    return nodes


def read_file(user_id: int, project_id: int, file_path: str) -> dict:
    target = allowed_document_path(user_id, project_id, file_path)
    if not target.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    content = target.read_text(encoding="utf-8")
    mtime = target.stat().st_mtime
    updated_at = datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M:%S")
    return {"path": file_path, "content": content, "updated_at": updated_at}


def write_file(user_id: int, project_id: int, file_path: str, content: str):
    target = allowed_document_path(user_id, project_id, file_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")

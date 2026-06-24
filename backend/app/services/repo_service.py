import subprocess
import os
from pathlib import Path
from app.utils.path_utils import sandbox_root, project_root


def _ssh_env(user_id: int) -> dict[str, str]:
    """构建包含用户 SSH Key 的环境变量。"""
    key_path = sandbox_root(user_id) / ".ssh" / "id_rsa"
    env = os.environ.copy()
    if key_path.exists():
        env["GIT_SSH_COMMAND"] = f"ssh -i {key_path} -o StrictHostKeyChecking=no"
    return env


def git_clone(user_id: int, project_id: int, repo_url: str, target_dir: str) -> Path:
    proj_dir = project_root(user_id, project_id)
    target = proj_dir / "code_projects" / target_dir
    target.parent.mkdir(parents=True, exist_ok=True)
    env = _ssh_env(user_id)
    subprocess.run(
        ["git", "clone", repo_url, str(target)],
        check=True,
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )
    return target


def git_branches(user_id: int, project_id: int, repo_name: str) -> dict:
    repo_dir = project_root(user_id, project_id) / "code_projects" / repo_name
    if not repo_dir.exists():
        raise FileNotFoundError(f"仓库目录不存在: {repo_dir}")

    def _run(args: list[str]) -> str:
        return subprocess.run(
            ["git", "-C", str(repo_dir)] + args,
            capture_output=True, text=True, timeout=30,
        ).stdout.strip()

    current = _run(["rev-parse", "--abbrev-ref", "HEAD"])

    local_branches = [b.strip().lstrip("* ") for b in _run(["branch"]).splitlines() if b.strip()]

    remote_raw = _run(["branch", "-r"])
    remote_branches = [b.strip() for b in remote_raw.splitlines() if b.strip() and "HEAD" not in b]

    return {
        "local_branches": local_branches,
        "remote_branches": remote_branches,
        "current_branch": current,
    }


def git_checkout(user_id: int, project_id: int, repo_name: str, branch: str):
    repo_dir = project_root(user_id, project_id) / "code_projects" / repo_name
    if not repo_dir.exists():
        raise FileNotFoundError(f"仓库目录不存在: {repo_dir}")

    subprocess.run(
        ["git", "-C", str(repo_dir), "checkout", branch],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )


def git_fetch(user_id: int, project_id: int, repo_name: str):
    """对指定仓库执行 git fetch --all --prune，更新远程分支信息。"""
    repo_dir = project_root(user_id, project_id) / "code_projects" / repo_name
    if not repo_dir.exists():
        raise FileNotFoundError(f"仓库目录不存在: {repo_dir}")

    env = _ssh_env(user_id)
    subprocess.run(
        ["git", "-C", str(repo_dir), "fetch", "--all", "--prune"],
        check=True,
        capture_output=True,
        text=True,
        env=env,
        timeout=120,
    )

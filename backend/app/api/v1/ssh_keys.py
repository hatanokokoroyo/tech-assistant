from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.ssh_key import SshKey
from app.schemas.ssh_key import SshKeyResponse
from app.utils.path_utils import sandbox_root
import subprocess
import os

router = APIRouter(prefix="/ssh-keys", tags=["SSH密钥"])


@router.get("")
async def get_ssh_key(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SshKey).where(
            SshKey.user_id == user.id,
            SshKey.deleted_at.is_(None),
        ).order_by(SshKey.created_at.desc())
    )
    key = result.scalars().first()
    if key is None:
        return {"code": 0, "message": "ok", "data": None}
    return {"code": 0, "message": "ok", "data": SshKeyResponse(
        id=key.id,
        fingerprint=key.fingerprint,
        created_at=_fmt(key.created_at),
    )}


@router.post("")
async def upload_ssh_key(
    file: UploadFile = File(None),
    private_key_content: str | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if file:
        content = (await file.read()).decode("utf-8")
    elif private_key_content:
        content = private_key_content
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请上传私钥文件或粘贴私钥内容")

    # 保存到沙箱
    ssh_dir = sandbox_root(user.id) / ".ssh"
    ssh_dir.mkdir(parents=True, exist_ok=True)
    key_path = ssh_dir / "id_rsa"
    key_path.write_text(content, encoding="utf-8")
    key_path.chmod(0o600)

    # 获取指纹
    fingerprint = _get_fingerprint(str(key_path))

    # 标记旧密钥为已删除
    old_result = await db.execute(
        select(SshKey).where(SshKey.user_id == user.id, SshKey.deleted_at.is_(None))
    )
    for old_key in old_result.scalars().all():
        old_key.deleted_at = _func_now()

    ssh_key = SshKey(
        user_id=user.id,
        fingerprint=fingerprint,
        file_path=str(key_path),
    )
    db.add(ssh_key)
    await db.commit()
    await db.refresh(ssh_key)
    return {"code": 0, "message": "ok", "data": SshKeyResponse(
        id=ssh_key.id,
        fingerprint=fingerprint,
        created_at=_fmt(ssh_key.created_at),
    )}


@router.delete("/{key_id}")
async def delete_ssh_key(
    key_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SshKey).where(SshKey.id == key_id, SshKey.user_id == user.id)
    )
    key = result.scalar_one_or_none()
    if key is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="密钥不存在")

    key.deleted_at = _func_now()
    # 物理删除文件
    if key.file_path and os.path.exists(key.file_path):
        os.remove(key.file_path)
    await db.commit()
    return {"code": 0, "message": "ok", "data": None}


def _get_fingerprint(key_path: str) -> str:
    try:
        result = subprocess.run(
            ["ssh-keygen", "-lf", key_path],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return ""


def _func_now():
    from sqlalchemy import func
    return func.now()


def _fmt(dt) -> str:
    if dt is None:
        return ""
    return dt.strftime("%Y-%m-%d %H:%M:%S")

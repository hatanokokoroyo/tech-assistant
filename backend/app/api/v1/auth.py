from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
    UpdateMeRequest,
)

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/register")
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="用户名已存在")

    user = User(
        username=body.username,
        alias_name=body.alias_name,
        password_hash=hash_password(body.password),
        role="user",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return {"code": 0, "message": "ok", "data": user_to_response(user)}


@router.post("/login")
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if user is None or user.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")

    token = create_access_token(user.id)
    return {"code": 0, "message": "ok", "data": LoginResponse(
        token=token,
        user=user_to_response(user),
    )}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {"code": 0, "message": "ok", "data": user_to_response(user)}


@router.put("/me")
async def update_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.alias_name is not None:
        user.alias_name = body.alias_name
    await db.commit()
    await db.refresh(user)
    return {"code": 0, "message": "ok", "data": user_to_response(user)}


def user_to_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        alias_name=user.alias_name,
        role=user.role,
        created_at=user.created_at.strftime("%Y-%m-%d %H:%M:%S") if user.created_at else "",
    )

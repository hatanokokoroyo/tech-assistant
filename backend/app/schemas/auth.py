from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=100, description="登录账号")
    password: str = Field(..., min_length=6, max_length=100, description="密码")
    alias_name: str | None = Field(None, max_length=100, description="真实姓名（可选）")


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=2, max_length=100, description="登录账号")
    password: str = Field(..., min_length=6, max_length=100, description="密码")


class UserResponse(BaseModel):
    id: int
    username: str
    alias_name: str | None
    role: str
    created_at: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    token: str
    user: UserResponse


class UpdateMeRequest(BaseModel):
    alias_name: str | None = Field(None, max_length=100, description="真实姓名")

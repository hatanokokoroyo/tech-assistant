"""数据源 Pydantic 请求/响应模型。"""

from pydantic import BaseModel, Field

ALLOWED_DB_TYPES = ["mysql", "redis", "tdengine"]


class DatasourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    db_type: str = Field(..., pattern="^(mysql|redis|tdengine)$")
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(..., ge=1, le=65535)
    database_name: str | None = Field(None, max_length=100)
    username: str | None = Field(None, max_length=100)
    password: str = Field(..., min_length=1)
    extra_config: dict | None = None


class DatasourceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    host: str | None = Field(None, min_length=1, max_length=255)
    port: int | None = Field(None, ge=1, le=65535)
    database_name: str | None = Field(None, max_length=100)
    username: str | None = Field(None, max_length=100)
    password: str = ""  # 空字符串表示保留原密码
    extra_config: dict | None = None


class DatasourceListItem(BaseModel):
    id: int
    name: str
    db_type: str
    host: str
    port: int
    created_at: str


class DatasourceDetail(BaseModel):
    id: int
    name: str
    db_type: str
    host: str
    port: int
    database_name: str | None
    username: str | None
    password: str = "******"  # 永远不返回明文密码
    extra_config: dict | None
    created_at: str
    updated_at: str

from pydantic import BaseModel, Field


class FileNode(BaseModel):
    name: str
    type: str  # 'file' | 'directory'
    path: str
    children: list["FileNode"] | None = None


class FileContentResponse(BaseModel):
    path: str
    content: str
    updated_at: str | None = None


class FileUpdateRequest(BaseModel):
    content: str = Field(...)

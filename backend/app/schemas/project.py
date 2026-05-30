from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    description: str | None = None


class RepoBrief(BaseModel):
    id: int
    name: str
    current_branch: str


class ProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None
    created_at: str
    repos: list[RepoBrief] = []

    model_config = {"from_attributes": True}


class ProjectListItem(BaseModel):
    id: int
    name: str
    description: str | None
    repo_count: int
    created_at: str

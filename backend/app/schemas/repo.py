from pydantic import BaseModel, Field


class RepoCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    url: str = Field(..., min_length=1, max_length=500)


class RepoResponse(BaseModel):
    id: int
    name: str
    url: str
    current_branch: str
    created_at: str

    model_config = {"from_attributes": True}


class BranchResponse(BaseModel):
    local_branches: list[str]
    remote_branches: list[str]
    current_branch: str


class CheckoutRequest(BaseModel):
    branch: str = Field(..., min_length=1, max_length=200)

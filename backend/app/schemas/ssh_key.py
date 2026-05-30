from pydantic import BaseModel


class SshKeyResponse(BaseModel):
    id: int
    fingerprint: str | None
    created_at: str

    model_config = {"from_attributes": True}

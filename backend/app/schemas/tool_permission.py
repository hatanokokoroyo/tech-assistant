from pydantic import BaseModel, Field


ALLOWED_TOOLS = [
    "run_command",
    "read_file",
    "write_file",
    "search_content",
    "list_directory",
    "delete_file",
]

ALLOWED_PERMISSIONS = ["auto_approve", "ask_user", "deny"]


class ToolPermissionItem(BaseModel):
    tool_name: str = Field(
        ...,
        pattern="^(run_command|read_file|write_file|search_content|list_directory|delete_file)$",
    )
    permission: str = Field(
        ...,
        pattern="^(auto_approve|ask_user|deny)$",
    )


class ToolPermissionUpsertRequest(BaseModel):
    permissions: list[ToolPermissionItem] = Field(..., min_length=1, max_length=len(ALLOWED_TOOLS))


class ToolPermissionResponse(BaseModel):
    id: int
    tool_name: str
    permission: str
    created_at: str
    updated_at: str


class EffectivePermissionsResponse(BaseModel):
    """有效权限：全局默认 + 项目覆盖的合并结果"""
    permissions: dict[str, str]  # {tool_name: permission}
    overrides: list[ToolPermissionResponse]  # 项目已显式配置的项


class ToolApprovalRequest(BaseModel):
    tool_call_id: str = Field(..., min_length=1)
    decision: str = Field(..., pattern="^(approved|denied)$")
    # 用户可选的扩展作用域
    scope: str | None = Field(None, pattern="^(conversation|once)$")
    # scope=once 默认，仅本次生效
    # scope=conversation 表示该对话后续同类型 Tool 自动通过

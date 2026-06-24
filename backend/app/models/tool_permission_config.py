from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func, CheckConstraint
from app.db.base import Base


class ToolPermissionConfig(Base):
    __tablename__ = "tool_permission_configs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    project_id = Column(BigInteger, ForeignKey("custom_projects.id"), nullable=False)
    tool_name = Column(
        String(50),
        nullable=False,
    )
    permission = Column(
        String(20),
        nullable=False,
    )

    __table_args__ = (
        CheckConstraint(
            "permission IN ('auto_approve', 'ask_user', 'deny')",
            name="ck_tool_permission_configs_permission",
        ),
        CheckConstraint(
            "tool_name IN ('run_command', 'read_file', 'write_file', "
            "'search_content', 'list_directory', 'delete_file', "
            "'list_datasources', 'query_mysql', 'query_redis', 'query_tdengine')",
            name="ck_tool_permission_configs_tool_name",
        ),
    )

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime)

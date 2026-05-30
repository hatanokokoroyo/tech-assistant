from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class CodeRepo(Base):
    __tablename__ = "code_repos"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    custom_project_id = Column(BigInteger, ForeignKey("custom_projects.id"), nullable=False)
    name = Column(String(200), nullable=False)
    url = Column(String(500), nullable=False)
    local_path = Column(String(500), nullable=False)
    current_branch = Column(String(200), nullable=False, default="main")
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    custom_project = relationship("CustomProject", back_populates="code_repos")

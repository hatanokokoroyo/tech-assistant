from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class CustomProject(Base):
    __tablename__ = "custom_projects"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    user = relationship("User", back_populates="custom_projects")
    code_repos = relationship("CodeRepo", back_populates="custom_project")
    conversations = relationship("Conversation", back_populates="custom_project")
    event_logs = relationship("EventLog", back_populates="custom_project")

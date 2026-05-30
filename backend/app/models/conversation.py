from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    custom_project_id = Column(BigInteger, ForeignKey("custom_projects.id"), nullable=False)
    title = Column(String(200))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    user = relationship("User", back_populates="conversations")
    custom_project = relationship("CustomProject", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation")

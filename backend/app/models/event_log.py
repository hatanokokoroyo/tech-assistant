from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class EventLog(Base):
    __tablename__ = "event_logs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    custom_project_id = Column(BigInteger, ForeignKey("custom_projects.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(BigInteger, ForeignKey("conversations.id"))
    summary = Column(Text, nullable=False)
    supplement = Column(Text)
    file_path = Column(String(500))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    custom_project = relationship("CustomProject", back_populates="event_logs")

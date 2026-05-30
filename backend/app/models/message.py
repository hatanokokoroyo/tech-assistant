from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    conversation_id = Column(BigInteger, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text)
    tool_calls = Column(JSONB)
    tool_call_id = Column(String(100))
    tool_name = Column(String(100))
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    conversation = relationship("Conversation", back_populates="messages")

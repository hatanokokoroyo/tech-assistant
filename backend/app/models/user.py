from sqlalchemy import Column, BigInteger, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    alias_name = Column(String(100))
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    custom_projects = relationship("CustomProject", back_populates="user")
    ssh_keys = relationship("SshKey", back_populates="user")
    conversations = relationship("Conversation", back_populates="user")

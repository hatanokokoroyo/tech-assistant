from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class SshKey(Base):
    __tablename__ = "ssh_keys"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False)
    fingerprint = Column(String(256))
    file_path = Column(String(500), nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)

    user = relationship("User", back_populates="ssh_keys")

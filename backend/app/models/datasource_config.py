from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from app.db.base import Base


class DatasourceConfig(Base):
    __tablename__ = "datasource_configs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    project_id = Column(BigInteger, ForeignKey("custom_projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    db_type = Column(String(20), nullable=False)  # mysql / redis / tdengine
    host = Column(String(255), nullable=False)
    port = Column(BigInteger, nullable=False)
    database_name = Column(String(100))            # Redis 可空
    username = Column(String(100))
    encrypted_password = Column(String, nullable=False)
    extra_config = Column(JSONB)                   # SSL/TLS/超时等附加配置

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime)

import logging
import os
from datetime import datetime
from contextlib import asynccontextmanager
from logging import FileHandler, StreamHandler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.api.v1.router import router as api_router
from app.db.session import engine
from app.db.base import Base


# ── 日志配置 ──────────────────────────────────────────
LOG_DIR = "/data/logs"
os.makedirs(LOG_DIR, exist_ok=True)


class DateFileHandler(logging.Handler):
    """按天切换日志文件：backend-YYYYMMDD.log"""

    def __init__(self, log_dir: str, prefix: str = "backend"):
        super().__init__()
        self.log_dir = log_dir
        self.prefix = prefix
        self._current_date: str = ""
        self._file_handler: FileHandler | None = None

    def _get_filename(self) -> str:
        date_str = datetime.now().strftime("%Y%m%d")
        return os.path.join(self.log_dir, f"{self.prefix}-{date_str}.log")

    def _ensure_handler(self) -> FileHandler:
        today = datetime.now().strftime("%Y%m%d")
        if self._file_handler is None or today != self._current_date:
            if self._file_handler:
                self._file_handler.close()
            self._current_date = today
            self._file_handler = FileHandler(
                self._get_filename(), mode="a", encoding="utf-8"
            )
            self._file_handler.setFormatter(self.formatter)
        return self._file_handler

    def emit(self, record: logging.LogRecord) -> None:
        try:
            handler = self._ensure_handler()
            handler.emit(record)
        except Exception:
            self.handleError(record)

    def close(self) -> None:
        if self._file_handler:
            self._file_handler.close()
        super().close()


file_handler = DateFileHandler(LOG_DIR)
file_handler.setLevel(logging.INFO)

console_handler = StreamHandler()
console_handler.setLevel(logging.INFO)

log_format = "%(asctime)s %(levelname)s %(name)s: %(message)s"
formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

# 清除 uvicorn 自身的 handler，强制走 root logger（日志文件 + stdout）
for name in ["uvicorn", "uvicorn.access", "uvicorn.error"]:
    logger = logging.getLogger(name)
    logger.handlers.clear()
    logger.propagate = True
    logger.setLevel(logging.INFO)

# FastAPI / Starlette 的异常也走 root logger
logging.getLogger("starlette").propagate = True
logging.getLogger("fastapi").propagate = True
logging.getLogger("httpx").propagate = True


# ── 应用生命周期 ──────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # 迁移：为现有表添加 token/cost 字段（幂等，每条 ALTER 独立执行）
        migration_sqls = [
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS prompt_tokens INTEGER;",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS completion_tokens INTEGER;",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS total_tokens INTEGER;",
            "ALTER TABLE messages ADD COLUMN IF NOT EXISTS cost DOUBLE PRECISION;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_prompt_tokens INTEGER NOT NULL DEFAULT 0;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_completion_tokens INTEGER NOT NULL DEFAULT 0;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_tokens INTEGER NOT NULL DEFAULT 0;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_cost DOUBLE PRECISION NOT NULL DEFAULT 0.0;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_api_rounds INTEGER NOT NULL DEFAULT 0;",
            "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS total_cache_hit_tokens INTEGER NOT NULL DEFAULT 0;",
            # 更新 tool_permission_configs 的 CHECK 约束，新增 4 个数据库工具
            "DO $$ BEGIN "
            "  ALTER TABLE tool_permission_configs DROP CONSTRAINT IF EXISTS ck_tool_permission_configs_tool_name; "
            "EXCEPTION WHEN undefined_object THEN NULL; END $$;",
            "ALTER TABLE tool_permission_configs ADD CONSTRAINT ck_tool_permission_configs_tool_name "
            "CHECK (tool_name IN ('run_command', 'read_file', 'write_file', "
            "'search_content', 'list_directory', 'delete_file', "
            "'list_datasources', 'query_mysql', 'query_redis', 'query_tdengine'));",
        ]
        for sql in migration_sqls:
            await conn.execute(text(sql))
    yield
    await engine.dispose()


app = FastAPI(title="Tech Assistant", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

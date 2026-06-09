import logging
import os
from datetime import datetime
from contextlib import asynccontextmanager
from logging import FileHandler, StreamHandler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

logging.getLogger("uvicorn").setLevel(logging.INFO)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)
logging.getLogger("uvicorn.error").setLevel(logging.INFO)


# ── 应用生命周期 ──────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
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

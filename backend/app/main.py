import logging
import os
from contextlib import asynccontextmanager
from logging.handlers import TimedRotatingFileHandler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.router import router as api_router
from app.db.session import engine
from app.db.base import Base


# ── 日志配置 ──────────────────────────────────────────
LOG_DIR = "/data/logs"
LOG_FILE = os.path.join(LOG_DIR, "backend.log")

os.makedirs(LOG_DIR, exist_ok=True)


def _namer(default_name: str) -> str:
    """将 backend.log.20260609 改为 backend-20260609.log"""
    # default_name 形如 /data/logs/backend.log.20260609
    base, date_part = default_name.rsplit(".", 1)
    return f"{base}-{date_part}.log"


file_handler = TimedRotatingFileHandler(
    LOG_FILE,
    when="midnight",
    interval=1,
    backupCount=30,
    encoding="utf-8",
)
file_handler.suffix = "%Y%m%d"
file_handler.namer = _namer
file_handler.setLevel(logging.INFO)

console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)

log_format = "%(asctime)s %(levelname)s %(name)s: %(message)s"
formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")
file_handler.setFormatter(formatter)
console_handler.setFormatter(formatter)

root_logger = logging.getLogger()
root_logger.setLevel(logging.INFO)
root_logger.addHandler(file_handler)
root_logger.addHandler(console_handler)

# uvicorn 的 access/error logger 也走 root logger
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

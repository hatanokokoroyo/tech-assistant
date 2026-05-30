from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.projects import router as project_router
from app.api.v1.repos import router as repo_router
from app.api.v1.ssh_keys import router as ssh_keys_router
from app.api.v1.files import router as files_router
from app.api.v1.conversations import router as conversations_router
from app.api.v1.stream import router as stream_router
from app.api.v1.events import router as events_router

router = APIRouter(prefix="/api")
router.include_router(auth_router)
router.include_router(project_router)
router.include_router(repo_router)
router.include_router(ssh_keys_router)
router.include_router(files_router)
router.include_router(conversations_router)
router.include_router(stream_router)
router.include_router(events_router)

"""
Agnes Video Generator v2.0 — FastAPI Service Layer
"""

import dotenv
dotenv.load_dotenv()

import os
import json
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from core.config import get_api_key, set_api_key, delete_api_key, get_api_key_source, get_working_dir, AVAILABLE_VOICES

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Suppress noisy WebSocket heartbeat / protocol logs from uvicorn and websockets
logging.getLogger("uvicorn.protocols.websockets").setLevel(logging.WARNING)
logging.getLogger("websockets").setLevel(logging.WARNING)


# ═══════════════════════════════════════════════════
# Lifespan
# ═══════════════════════════════════════════════════


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from sqlalchemy import text
        from db.database import engine
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("[Startup] Database connected successfully.")
    except Exception as e:
        logger.error(f"[Startup] Database connection failed: {e}")

    os.makedirs(get_working_dir(), exist_ok=True)
    upload_dir = os.path.join(get_working_dir(), "uploads")
    os.makedirs(upload_dir, exist_ok=True)

    working_dir = get_working_dir()
    if os.path.exists(working_dir):
        for name in os.listdir(working_dir):
            task_file = os.path.join(working_dir, name, "task_state.json")
            if os.path.exists(task_file):
                try:
                    with open(task_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if data.get("status") == "running":
                        data["status"] = "pending"
                        with open(task_file, "w", encoding="utf-8") as f:
                            json.dump(data, f, ensure_ascii=False, indent=2)
                        logger.info(f"[Startup] Reset stale running task {name} -> pending")
                except Exception:
                    pass

    yield


app = FastAPI(title="Agnes Video Generator", lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware

# Read custom origins from env var (comma-separated list), fallback to default list
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
origins = [
    "http://localhost:4321",
    "http://127.0.0.1:4321",
    "http://localhost:8765",
    "http://127.0.0.1:8765"
]
if allowed_origins_env:
    extra_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
    origins.extend(extra_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from core.middleware import register_standardized_responses
register_standardized_responses(app)

# Import and include routers modularly
from modules.auth.router import router as auth_router
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

from modules.tasks.router import router as tasks_router, video_router, ws_router
app.include_router(tasks_router, tags=["tasks"])
app.include_router(video_router, tags=["video"])
app.include_router(ws_router, tags=["ws"])

from modules.users.router import router as users_router
app.include_router(users_router, prefix="/api/v1/users", tags=["users"])


# ═══════════════════════════════════════════════════
# Static files + Root
# ═══════════════════════════════════════════════════


static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.get("/")
async def root():
    index_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Agnes Video Generator API"}


# ═══════════════════════════════════════════════════
# API Key Config
# ═══════════════════════════════════════════════════


@app.get("/api/v1/config")
async def get_config():
    key = get_api_key()
    source = get_api_key_source()
    data = {
        "api_key": key[:8] + "..." if key else "",
        "source": source,
        "can_clear": False,
    }
    return data


@app.post("/api/v1/config")
async def save_config(api_key: str = Form(...)):
    raise HTTPException(
        status_code=400,
        detail="API Key can only be configured via environment variables (.env)",
    )


@app.delete("/api/v1/config")
async def clear_config():
    raise HTTPException(
        status_code=400,
        detail="API Key can only be configured via environment variables (.env)",
    )


@app.get("/api/v1/voices")
async def get_voices():
    """Return the list of available TTS voice roles."""
    return {"voices": AVAILABLE_VOICES}


# ═══════════════════════════════════════════════════
# Start
# ═══════════════════════════════════════════════════


if __name__ == "__main__":
    import uvicorn

    config = uvicorn.Config("server:app", host="0.0.0.0", port=8765, log_level="info", reload=True)
    server = uvicorn.Server(config)

    original_handle_exit = server.handle_exit

    def _handle_exit(sig, frame):
        from modules.tasks.router import shutdown_event
        if shutdown_event.is_set():
            logger.warning("Force exiting...")
            os._exit(1)
        logger.info("Shutting down gracefully (Ctrl+C again to force)...")
        shutdown_event.set()
        if callable(original_handle_exit):
            original_handle_exit(sig, frame)

    server.handle_exit = _handle_exit

    server.run()

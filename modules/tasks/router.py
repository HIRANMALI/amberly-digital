import os
import re
import uuid
import json
import logging
import asyncio
from datetime import datetime
from typing import Any, Dict, Optional, Union

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db, AsyncSessionLocal
from dependencies import get_current_user, require_admin
from modules.users.models import User, UserRole
from . import crud, schemas

from core.config import get_api_key, get_working_dir, AVAILABLE_VOICES
from core.pipelines import (
    BasePipeline,
    PipelineShutdown,
    SimpleVideoPipeline,
    CreativeVideoPipeline,
    ManuscriptVideoPipeline,
)
from core.task_manager import TaskManager
from models.task import (
    AudioConfig,
    BaseTaskState,
    CreativeVideoTask,
    ManuscriptVideoTask,
    SimpleVideoTask,
    StepStatus,
    SubtitleStyle,
    TaskType,
    VideoMode,
)

logger = logging.getLogger(__name__)

# State
active_connections: Dict[str, WebSocket] = {}
active_pipelines: Dict[str, BasePipeline] = {}
shutdown_event = asyncio.Event()
background_upload_tasks = set()

UPLOAD_DIR = os.path.join(get_working_dir(), "uploads")

# Routers
router = APIRouter(prefix="/api/v1/tasks")
video_router = APIRouter(prefix="/api/v1/video")
ws_router = APIRouter(prefix="/api/v1/ws")

# Helper functions
def _parse_bg_color(raw: str) -> tuple | None:
    """Parse bg_color string to moviepy 2.x compatible RGBA tuple."""
    if isinstance(raw, tuple):
        return raw
    if isinstance(raw, str):
        if raw.startswith("(") and raw.endswith(")"):
            return tuple(int(x.strip()) for x in raw[1:-1].split(","))
        if "@" in raw:
            parts = raw.split("@", 1)
            color_name = parts[0].strip().lower()
            alpha_pct = float(parts[1])
            rgb = {"black": (0, 0, 0), "white": (255, 255, 255),
                   "red": (255, 0, 0), "blue": (0, 0, 255),
                   "yellow": (255, 255, 0)}.get(color_name, (0, 0, 0))
            return (*rgb, int(alpha_pct * 255))
        if raw.lower() in ("none", "transparent", ""):
            return None
    return (0, 0, 0, 128)


def _build_position(subtitle_position: str) -> tuple:
    """Convert 'bottom'/'top' to moviepy compatible position tuple."""
    if subtitle_position == "top":
        return ("center", "top")
    return ("center", "bottom")


def _find_dir_name(task_id: str) -> str:
    """Find the directory name for a task_id. Falls back to task_id for legacy tasks."""
    tm = TaskManager("_")
    for t in tm.list_tasks():
        if t["task_id"] == task_id:
            return t.get("dir_name", task_id)
    return task_id


def _parse_duration(user_requirement: str) -> int:
    # Check Chinese patterns first, then English patterns
    match = re.search(r'(?:每个场景|每段|每节|每|each scene|each paragraph|each)(?:约|about)?\s*(\d+)\s*(?:秒|s|seconds)', user_requirement, re.IGNORECASE)
    if match:
        return int(match.group(1))
    match = re.search(r'(\d+)\s*(?:秒|s|seconds)\s*(?:每|/|per)', user_requirement, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return 5


def _make_progress_callback(task_id: str, ws: Optional[WebSocket] = None):
    """Create progress callback function. Prioritize passed ws, otherwise search active_connections."""
    async def progress_callback(step: str, status: str, message: str, progress: float, data: dict):
        try:
            target_ws = ws or active_connections.get(task_id)
            if target_ws:
                await target_ws.send_json({
                    "type": "progress",
                    "task_id": task_id,
                    "step": step,
                    "status": status,
                    "message": message,
                    "progress": progress,
                    "data": data,
                })
        except Exception:
            pass
    return progress_callback


def _create_pipeline_for_type(
    task_type: TaskType,
    api_key: str,
    task_id: str,
    dir_name: str,
) -> BasePipeline:
    """Create pipeline instance based on task type."""
    if task_type == TaskType.SIMPLE:
        return SimpleVideoPipeline(
            api_key=api_key,
            task_id=task_id,
            dir_name=dir_name,
            shutdown_event=shutdown_event,
        )
    elif task_type == TaskType.MANUSCRIPT:
        return ManuscriptVideoPipeline(
            api_key=api_key,
            task_id=task_id,
            dir_name=dir_name,
            shutdown_event=shutdown_event,
        )
    else:
        # CREATIVE
        return CreativeVideoPipeline(
            api_key=api_key,
            task_id=task_id,
            dir_name=dir_name,
            shutdown_event=shutdown_event,
        )


async def _run_pipeline(pipeline: BasePipeline, state: BaseTaskState):
    """Generic pipeline execution wrapper."""
    from db.database import AsyncSessionLocal
    from modules.tasks.crud import get_task_by_internal_id, update_task
    from modules.tasks.schemas import TaskUpdate

    # Update db status to running
    try:
        async with AsyncSessionLocal() as db:
            db_task = await get_task_by_internal_id(db, pipeline.task_id)
            if db_task:
                await update_task(db, db_task, TaskUpdate(status="running"))
    except Exception as e:
        logger.warning(f"[Pipeline] Failed to set task status to running in DB: {e}")

    try:
        logger.info(f"[Pipeline] Starting run for task {pipeline.task_id}, type={state.task_type}")

        # Upload input images to Cloudinary in the background
        import cloudinary
        import cloudinary.uploader
        if cloudinary.config().cloud_name:
            async def _upload_input(filepath: str, upload_name: str, state_field: str):
                if filepath and os.path.exists(filepath):
                    try:
                        logger.info(f"[Cloudinary] Uploading {upload_name}...")
                        response = await asyncio.to_thread(
                            cloudinary.uploader.upload, 
                            filepath,
                            folder=f"agnes_video_tool/{pipeline.task_id}",
                            public_id=upload_name,
                            overwrite=True,
                            invalidate=True
                        )
                        url = response.get("secure_url")
                        if url:
                            pipeline.task_manager.update_state(**{state_field: url})
                            logger.info(f"[Cloudinary] {upload_name} uploaded: {url}")
                    except Exception as e:
                        logger.error(f"[Cloudinary] Failed to upload {upload_name}: {e}")

            if getattr(state, "reference_image", None):
                task = asyncio.create_task(_upload_input(state.reference_image, "reference_image", "reference_cloudinary_url"))
                background_upload_tasks.add(task)
                task.add_done_callback(background_upload_tasks.discard)
            if getattr(state, "end_frame_image", None):
                task = asyncio.create_task(_upload_input(state.end_frame_image, "end_frame_image", "end_frame_cloudinary_url"))
                background_upload_tasks.add(task)
                task.add_done_callback(background_upload_tasks.discard)
            
            # Support for CreativeVideoTask's end_frame_images list
            if getattr(state, "end_frame_images", None):
                for idx, ef in enumerate(state.end_frame_images):
                    task = asyncio.create_task(_upload_input(ef, f"end_frame_{idx}", f"end_frame_{idx}_cloudinary_url"))
                    background_upload_tasks.add(task)
                    task.add_done_callback(background_upload_tasks.discard)

        final_video_path = await pipeline.run(state)
        logger.info(f"[Pipeline] Completed run for task {pipeline.task_id}")

        # Upload final video to Cloudinary
        if final_video_path and os.path.exists(final_video_path):
            if cloudinary.config().cloud_name:
                logger.info(f"[Cloudinary] Uploading final video for task {pipeline.task_id} to Cloudinary...")
                try:
                    response = await asyncio.to_thread(
                        cloudinary.uploader.upload,
                        final_video_path,
                        resource_type="video",
                        folder=f"agnes_video_tool/{pipeline.task_id}",
                        public_id="final_video",
                        overwrite=True,
                        invalidate=True
                    )
                    url = response.get("secure_url")
                    if url:
                        logger.info(f"[Cloudinary] Final video uploaded successfully: {url}")
                        pipeline.task_manager.update_state(cloudinary_url=url)
                except Exception as e:
                    logger.error(f"[Cloudinary] Failed to upload final video: {e}")

        # Update db status to completed
        try:
            async with AsyncSessionLocal() as db:
                db_task = await get_task_by_internal_id(db, pipeline.task_id)
                if db_task:
                    video_url = getattr(pipeline.task_manager.get_state(), "cloudinary_url", "")
                    await update_task(db, db_task, TaskUpdate(status="completed", video_url=video_url or None))
        except Exception as e:
            logger.warning(f"[Pipeline] Failed to set task status to completed in DB: {e}")

    except PipelineShutdown:
        logger.info(f"[Pipeline] Task {pipeline.task_id} stopped by user")
        try:
            async with AsyncSessionLocal() as db:
                db_task = await get_task_by_internal_id(db, pipeline.task_id)
                if db_task:
                    await update_task(db, db_task, TaskUpdate(status="pending"))
        except Exception as e:
            logger.warning(f"[Pipeline] Failed to set task status to pending in DB: {e}")
    except Exception as e:
        logger.error(f"[Pipeline] Task {pipeline.task_id} failed: {e}", exc_info=True)
        try:
            async with AsyncSessionLocal() as db:
                db_task = await get_task_by_internal_id(db, pipeline.task_id)
                if db_task:
                    await update_task(db, db_task, TaskUpdate(status="failed", error_message=str(e)))
        except Exception as db_err:
            logger.warning(f"[Pipeline] Failed to set task status to failed in DB: {db_err}")
    finally:
        if pipeline.task_id in active_pipelines:
            del active_pipelines[pipeline.task_id]


# ═══════════════════════════════════════════════════
# WebSocket Endpoint
# ═══════════════════════════════════════════════════

@ws_router.websocket("/{task_id}")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    # ── Auth guard: verify access_token cookie BEFORE accepting ──
    access_token = websocket.cookies.get("access_token")
    if not access_token:
        logger.warning(f"[WS] Rejected unauthenticated connection for task {task_id}")
        await websocket.close(code=4001, reason="Unauthorized: no access token")
        return

    # Verify the JWT and load the user
    try:
        from modules.auth.service import verify_access_token
        from modules.users.crud import get_user_by_id
        import uuid as _uuid

        payload = verify_access_token(access_token)
        user_id_str = payload.get("user_id")
        if not user_id_str:
            raise ValueError("Missing user_id in token")

        async with AsyncSessionLocal() as db:
            user = await get_user_by_id(db, _uuid.UUID(user_id_str))
            if not user or not user.is_active:
                raise ValueError("User not found or inactive")

            # Ownership check: task must belong to this user
            from modules.tasks.crud import get_task_by_internal_id
            db_task = await get_task_by_internal_id(db, task_id)
            if not db_task or db_task.user_id != user.id:
                logger.warning(f"[WS] Rejected: task {task_id} does not belong to user {user.id}")
                await websocket.close(code=4003, reason="Forbidden: task not owned by user")
                return

    except Exception as e:
        logger.warning(f"[WS] Rejected invalid token for task {task_id}: {e}")
        await websocket.close(code=4001, reason="Unauthorized: invalid token")
        return
    # ─────────────────────────────────────────────────

    await websocket.accept()
    logger.info(f"[WS] Client connected for task {task_id} (user={user.id})")
    active_connections[task_id] = websocket

    async def progress_callback(step: str, status: str, message: str, progress: float, data: dict):
        try:
            target_ws = active_connections.get(task_id)
            if target_ws:
                await target_ws.send_json({
                    "type": "progress",
                    "task_id": task_id,
                    "step": step,
                    "status": status,
                    "message": message,
                    "progress": progress,
                    "data": data,
                })
        except Exception:
            pass

    if task_id in active_pipelines:
        logger.info(f"[WS] Binding existing pipeline for task {task_id}")
        active_pipelines[task_id].progress_callback = progress_callback

    try:
        while True:
            msg = await websocket.receive_text()
            if not msg or msg.strip().lower() in ("ping", "pong"):
                continue
    except WebSocketDisconnect:
        logger.info(f"[WS] Client disconnected for task {task_id}")
    except Exception as e:
        logger.warning(f"[WS] Error for task {task_id}: {e}")
    finally:
        if task_id in active_connections:
            del active_connections[task_id]



# ═══════════════════════════════════════════════════
# Task Listing & Detailed View Endpoints
# ═══════════════════════════════════════════════════

@router.get("")
async def list_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from modules.tasks.crud import get_tasks_by_user
    db_tasks = await get_tasks_by_user(db, current_user.id)
    
    tasks = []
    for dt in db_tasks:
        t: Dict[str, Any] = {
            "task_id": dt.task_id,
            "task_type": dt.task_type,
            "status": dt.status,
            "prompt": dt.prompt,
            "video_url": dt.video_url,
        }
        dir_name = _find_dir_name(dt.task_id)
        t["dir_name"] = dir_name
        
        task_tm = TaskManager(dt.task_id, dir_name=dir_name)
        state = task_tm.load()
        if state:
            t["final_video_file"] = state.final_video_file
            t["cloudinary_url"] = getattr(state, "cloudinary_url", "")
            t["reference_cloudinary_url"] = getattr(state, "reference_cloudinary_url", "")
            t["end_frame_cloudinary_url"] = getattr(state, "end_frame_cloudinary_url", "")
            t["creative_name"] = getattr(state, "creative_name", "")
            t["chaining_mode"] = getattr(state, "chaining_mode", "none")
            
            if isinstance(state, CreativeVideoTask):
                t["scene_count"] = state.scene_count
                t["idea"] = state.idea[:100] if state.idea else ""
            elif isinstance(state, ManuscriptVideoTask):
                t["paragraph_count"] = len(state.paragraphs)
                t["manuscript_text"] = state.manuscript_text[:100] if state.manuscript_text else ""
            elif isinstance(state, SimpleVideoTask):
                t["prompt"] = state.prompt[:100] if state.prompt else ""
                t["mode"] = state.mode
        else:
            t["final_video_file"] = ""
            t["cloudinary_url"] = dt.video_url or ""
            t["reference_cloudinary_url"] = dt.first_img_url or ""
            t["end_frame_cloudinary_url"] = dt.second_img_url or ""
            t["creative_name"] = f"Task {dt.task_id}"
            t["chaining_mode"] = "none"
            if dt.task_type == "creative":
                t["scene_count"] = 0
                t["idea"] = dt.prompt[:100] if dt.prompt else ""
            elif dt.task_type == "manuscript":
                t["paragraph_count"] = 0
                t["manuscript_text"] = dt.prompt[:100] if dt.prompt else ""
            elif dt.task_type == "simple":
                t["prompt"] = dt.prompt[:100] if dt.prompt else ""
                t["mode"] = "t2v"
        tasks.append(t)
    return {"tasks": tasks}


@router.get("/{task_id}")
async def get_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from modules.tasks.crud import get_task_by_internal_id
    db_task = await get_task_by_internal_id(db, task_id)
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this task")

    dir_name = _find_dir_name(task_id)
    tm = TaskManager(task_id, dir_name=dir_name)
    state = tm.load()
    if not state:
        raise HTTPException(status_code=404, detail="Task not found")
    data = state.model_dump()
    data["dir_name"] = dir_name
    return data


# ═══════════════════════════════════════════════════
# Task Creation Endpoints
# ═══════════════════════════════════════════════════

@router.post("/simple")
async def create_simple_task(
    prompt: str = Form(...),
    mode: str = Form("t2v"),
    duration: int = Form(5),
    video_width: int = Form(768),
    video_height: int = Form(1152),
    seed: Optional[int] = Form(None),
    negative_prompt: Optional[str] = Form(None),
    reference_image: UploadFile = File(None),
    end_frame_image: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create simple video task (Type 1)."""
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Please configure API Key first")

    task_id = uuid.uuid4().hex[:12]
    dir_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{task_id}"

    # Map mode
    video_mode = VideoMode.T2V
    if mode in ("i2v", "ti2vid"):
        video_mode = VideoMode.I2V if mode == "i2v" else VideoMode.TI2VID
    elif mode == "keyframes":
        video_mode = VideoMode.KEYFRAMES

    state = SimpleVideoTask(
        task_id=task_id,
        creative_name=f"simple_{task_id}",
        prompt=prompt,
        mode=video_mode,
        duration=duration,
        video_width=video_width,
        video_height=video_height,
        seed=seed,
        negative_prompt=negative_prompt,
    )

    # Handle reference image upload
    if reference_image and reference_image.filename:
        upload_path = os.path.join(UPLOAD_DIR, f"{task_id}_ref_{reference_image.filename}")
        with open(upload_path, "wb") as f:
            f.write(await reference_image.read())
        state.reference_image = upload_path

    # Handle end frame image upload (keyframes mode)
    if end_frame_image and end_frame_image.filename:
        upload_path = os.path.join(UPLOAD_DIR, f"{task_id}_end_{end_frame_image.filename}")
        with open(upload_path, "wb") as f:
            f.write(await end_frame_image.read())
        state.end_frame_image = upload_path

    # Save to database
    from modules.tasks.crud import create_task
    await create_task(
        db=db,
        task_id=task_id,
        task_type="simple",
        prompt=prompt,
        duration_seconds=duration,
        first_img_url=state.reference_image,
        second_img_url=state.end_frame_image,
        user_id=current_user.id
    )

    pipeline = _create_pipeline_for_type(TaskType.SIMPLE, api_key, task_id, dir_name)
    active_pipelines[task_id] = pipeline

    if task_id in active_connections:
        pipeline.progress_callback = _make_progress_callback(task_id)

    asyncio.create_task(_run_pipeline(pipeline, state))
    logger.info(f"[Simple] Task created: {task_id}, mode={mode}, duration={duration}s")
    return {"ok": True, "task_id": task_id, "dir_name": dir_name}


@router.post("/creative")
async def create_creative_task(
    idea: str = Form(...),
    creative_name: str = Form(""),
    user_requirement: str = Form("3 scenes, 10 seconds per scene, cinematic"),
    style: str = Form("cinematic realistic style"),
    chaining_mode: str = Form("keyframes"),
    video_width: int = Form(768),
    video_height: int = Form(1152),
    video_duration: int = Form(5),
    reference_image: UploadFile = File(None),
    end_frame_images: list | None = None,
    use_custom_end_frames: bool = Form(False),
    generate_end_frames_from_ref: bool = Form(False),
    # v2.0 audio configuration
    audio_enabled: bool = Form(True),
    audio_voice: str = Form("zh-CN-XiaoxiaoNeural"),
    audio_rate: str = Form("+0%"),
    subtitle_font: str = Form("STHeitiMedium.ttc"),
    subtitle_color: str = Form("white"),
    subtitle_fontsize: int = Form(48),
    subtitle_position: str = Form("bottom"),
    subtitle_stroke_color: str = Form("black"),
    subtitle_stroke_width: int = Form(2),
    subtitle_bg_color: str = Form("black@0.5"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create creative long video task (Type 2)."""
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Please configure API Key first")

    task_id = uuid.uuid4().hex[:12]
    name = creative_name.strip() if creative_name else f"video_{task_id}"
    dir_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{task_id}"

    # Parse duration
    parsed_duration = _parse_duration(user_requirement)

    # Build audio configuration
    subtitle_style = SubtitleStyle(
        font=subtitle_font,
        color=subtitle_color,
        fontsize=subtitle_fontsize,
        position=_build_position(subtitle_position),
        stroke_color=subtitle_stroke_color,
        stroke_width=subtitle_stroke_width,
        bg_color=_parse_bg_color(subtitle_bg_color),
    )
    audio_config = AudioConfig(
        enabled=audio_enabled,
        voice=audio_voice,
        rate=audio_rate,
        subtitle_style=subtitle_style,
    )

    state = CreativeVideoTask(
        task_id=task_id,
        creative_name=name,
        idea=idea,
        user_requirement=user_requirement,
        style=style,
        chaining_mode=chaining_mode,
        video_width=video_width,
        video_height=video_height,
        video_duration=parsed_duration,
        use_custom_end_frames=use_custom_end_frames,
        generate_end_frames_from_ref=generate_end_frames_from_ref,
        audio_config=audio_config,
    )

    logger.info(f"[Pipeline] Parsed video_duration={parsed_duration}s from user_requirement={user_requirement!r}")

    # Handle reference image upload
    if reference_image and reference_image.filename:
        upload_path = os.path.join(UPLOAD_DIR, f"{task_id}_ref_{reference_image.filename}")
        with open(upload_path, "wb") as f:
            f.write(await reference_image.read())
        state.reference_image = upload_path

    # Save to database
    from modules.tasks.crud import create_task
    await create_task(
        db=db,
        task_id=task_id,
        task_type="creative",
        prompt=idea,
        duration_seconds=parsed_duration,
        first_img_url=state.reference_image,
        user_id=current_user.id
    )

    pipeline = _create_pipeline_for_type(TaskType.CREATIVE, api_key, task_id, dir_name)
    active_pipelines[task_id] = pipeline

    if task_id in active_connections:
        pipeline.progress_callback = _make_progress_callback(task_id)

    asyncio.create_task(_run_pipeline(pipeline, state))
    return {"ok": True, "task_id": task_id, "dir_name": dir_name}


@router.post("/manuscript")
async def create_manuscript_task(
    manuscript_text: str = Form(...),
    creative_name: str = Form(""),
    video_width: int = Form(768),
    video_height: int = Form(1152),
    video_duration: int = Form(10),
    # v2.0 audio configuration
    audio_enabled: bool = Form(True),
    audio_voice: str = Form("zh-CN-XiaoxiaoNeural"),
    audio_rate: str = Form("+0%"),
    subtitle_font: str = Form("STHeitiMedium.ttc"),
    subtitle_color: str = Form("white"),
    subtitle_fontsize: int = Form(48),
    subtitle_position: str = Form("bottom"),
    subtitle_stroke_color: str = Form("black"),
    subtitle_stroke_width: int = Form(2),
    subtitle_bg_color: str = Form("black@0.5"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create manuscript long video task (Type 3)."""
    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Please configure API Key first")

    if not manuscript_text.strip():
        raise HTTPException(status_code=400, detail="Manuscript content cannot be empty")

    task_id = uuid.uuid4().hex[:12]
    name = creative_name.strip() if creative_name else f"manuscript_{task_id}"
    dir_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{task_id}"

    # Build audio configuration
    subtitle_style = SubtitleStyle(
        font=subtitle_font,
        color=subtitle_color,
        fontsize=subtitle_fontsize,
        position=_build_position(subtitle_position),
        stroke_color=subtitle_stroke_color,
        stroke_width=subtitle_stroke_width,
        bg_color=_parse_bg_color(subtitle_bg_color),
    )
    audio_config = AudioConfig(
        enabled=audio_enabled,
        voice=audio_voice,
        rate=audio_rate,
        subtitle_style=subtitle_style,
    )

    state = ManuscriptVideoTask(
        task_id=task_id,
        creative_name=name,
        manuscript_text=manuscript_text.strip(),
        video_width=video_width,
        video_height=video_height,
        video_duration=video_duration,
        audio_config=audio_config,
    )

    # Save to database
    from modules.tasks.crud import create_task
    await create_task(
        db=db,
        task_id=task_id,
        task_type="manuscript",
        prompt=manuscript_text,
        duration_seconds=video_duration,
        user_id=current_user.id
    )

    pipeline = _create_pipeline_for_type(TaskType.MANUSCRIPT, api_key, task_id, dir_name)
    active_pipelines[task_id] = pipeline

    if task_id in active_connections:
        pipeline.progress_callback = _make_progress_callback(task_id)

    asyncio.create_task(_run_pipeline(pipeline, state))
    logger.info(f"[Manuscript] Task created: {task_id}, text_len={len(manuscript_text)}")
    return {"ok": True, "task_id": task_id, "dir_name": dir_name}


@router.post("")
async def create_task_legacy(
    idea: str = Form(...),
    creative_name: str = Form(""),
    user_requirement: str = Form("3 scenes, 10 seconds per scene, cinematic"),
    style: str = Form("cinematic realistic style"),
    chaining_mode: str = Form("keyframes"),
    video_width: int = Form(768),
    video_height: int = Form(1152),
    reference_image: UploadFile = File(None),
    end_frame_images: list | None = None,
    use_custom_end_frames: bool = Form(False),
    generate_end_frames_from_ref: bool = Form(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Backward compatibility for legacy endpoint, maps to create_creative_task."""
    return await create_creative_task(
        idea=idea,
        creative_name=creative_name,
        user_requirement=user_requirement,
        style=style,
        chaining_mode=chaining_mode,
        video_width=video_width,
        video_height=video_height,
        reference_image=reference_image,
        end_frame_images=end_frame_images,
        use_custom_end_frames=use_custom_end_frames,
        generate_end_frames_from_ref=generate_end_frames_from_ref,
        # Provide default audio/subtitle values (legacy endpoint does not pass these parameters)
        audio_enabled=True,
        audio_voice="zh-CN-XiaoxiaoNeural",
        audio_rate="+0%",
        subtitle_font="STHeitiMedium.ttc",
        subtitle_color="white",
        subtitle_fontsize=48,
        subtitle_position="bottom",
        subtitle_stroke_color="black",
        subtitle_stroke_width=2,
        subtitle_bg_color="black@0.5",
        current_user=current_user,
        db=db
    )


# ═══════════════════════════════════════════════════
# Task Control Endpoints (Resume, Stop)
# ═══════════════════════════════════════════════════

@router.post("/{task_id}/resume")
async def resume_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from modules.tasks.crud import get_task_by_internal_id
    db_task = await get_task_by_internal_id(db, task_id)
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to resume this task")

    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=400, detail="Please configure API Key first")

    if task_id in active_pipelines:
        existing = active_pipelines[task_id]
        if existing._stop_event.is_set():
            logger.info(f"[Resume] Replacing stopped pipeline for task {task_id}")
            del active_pipelines[task_id]
        else:
            raise HTTPException(status_code=400, detail="Task is already running")

    dir_name = _find_dir_name(task_id)
    tm = TaskManager(task_id, dir_name=dir_name)
    state = tm.load()
    if not state:
        raise HTTPException(status_code=404, detail="Task not found")

    if state.status == StepStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Task is already completed")

    logger.info(f"[Resume] Starting resume for task {task_id}, type={state.task_type}, status={state.status}")

    # v2.0: Select corresponding pipeline based on task_type
    pipeline = _create_pipeline_for_type(state.task_type, api_key, task_id, dir_name)
    active_pipelines[task_id] = pipeline

    if task_id in active_connections:
        logger.info(f"[Resume] Binding existing WebSocket for task {task_id}")
        pipeline.progress_callback = _make_progress_callback(task_id)

    asyncio.create_task(_run_pipeline(pipeline, state))
    return {"ok": True, "task_id": task_id, "dir_name": dir_name}


@router.post("/{task_id}/stop")
async def stop_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from modules.tasks.crud import get_task_by_internal_id
    db_task = await get_task_by_internal_id(db, task_id)
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to stop this task")

    if task_id not in active_pipelines:
        raise HTTPException(status_code=400, detail="Task is not running")

    pipeline = active_pipelines[task_id]
    pipeline.stop()

    dir_name = _find_dir_name(task_id)
    tm = TaskManager(task_id, dir_name=dir_name)
    state = tm.load()
    if state and state.status == StepStatus.RUNNING:
        tm.update_state(status=StepStatus.PENDING)
        logger.info(f"[Stop] Task {task_id} status -> pending")

    logger.info(f"[Stop] Task {task_id} stop requested")
    return {"ok": True, "task_id": task_id}


# ═══════════════════════════════════════════════════
# Video Streaming Endpoint
# ═══════════════════════════════════════════════════

@video_router.get("/{task_id}")
async def serve_video(
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from modules.tasks.crud import get_task_by_internal_id
    db_task = await get_task_by_internal_id(db, task_id)
    if not db_task or db_task.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to view this video")

    dir_name = _find_dir_name(task_id)
    task_dir = os.path.join(get_working_dir(), dir_name)
    video_path = os.path.join(task_dir, "final_video.mp4")
    if not os.path.exists(video_path):
        raise HTTPException(status_code=404, detail="Video not found")
    return FileResponse(video_path, media_type="video/mp4")


# ═══════════════════════════════════════════════════
# Admin Endpoints
# ═══════════════════════════════════════════════════

@router.get("/admin/all", response_model=list[schemas.TaskRead])
async def admin_list_all_tasks(
    limit: int = 50,
    offset: int = 0,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Admin-only endpoint to view all tasks across all users."""
    return await crud.list_all_tasks(db, limit=limit, offset=offset)

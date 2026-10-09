"""
FastAPI Admin Router — Amberly Digital
Provides comprehensive admin telemetry, user management, credit allocations, and task monitoring.
"""

import os
import uuid
import base64
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Any, Dict

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, Header, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, desc

from db.database import get_db
from modules.users.models import User, UserRole
from modules.tasks.models import Task

logger = logging.getLogger(__name__)

router = APIRouter()

# Admin secret keys
ADMIN_SECRETS = {
    os.getenv("ADMIN_SECRET", "amberly_admin_2026"),
    "amberly_admin_2026",
    "Prashant@07"
}
ADMIN_SECRETS = {s for s in ADMIN_SECRETS if s}


async def verify_admin_access(
    request: Request,
    x_admin_key: Optional[str] = Header(None, alias="x-admin-key"),
    db: AsyncSession = Depends(get_db)
) -> bool:
    """
    Verify admin request via x-admin-key, Authorization header (Bearer or Basic),
    or JWT session token for user with admin role.
    """
    # 1. Check custom header x-admin-key
    if x_admin_key and x_admin_key in ADMIN_SECRETS:
        return True

    # 2. Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header:
        if auth_header.startswith("Bearer "):
            token = auth_header[7:].strip()
            if token in ADMIN_SECRETS:
                return True
            # Check if token is a valid JWT with role == admin
            try:
                from modules.auth.service import verify_access_token
                from modules.users.crud import get_user_by_id
                payload = verify_access_token(token)
                user_id = payload.get("user_id")
                if user_id:
                    user = await get_user_by_id(db, uuid.UUID(user_id))
                    if user and user.role == UserRole.ADMIN and user.is_active:
                        return True
            except Exception:
                pass

        elif auth_header.startswith("Basic "):
            try:
                b64_creds = auth_header[6:].strip()
                decoded = base64.b64decode(b64_creds).decode("utf-8")
                username, password = decoded.split(":", 1)
                if username == "admin" and password in ADMIN_SECRETS:
                    return True
            except Exception:
                pass

    # 3. Check access_token cookie
    access_token = request.cookies.get("access_token")
    if access_token:
        try:
            from modules.auth.service import verify_access_token
            from modules.users.crud import get_user_by_id
            payload = verify_access_token(access_token)
            user_id = payload.get("user_id")
            if user_id:
                user = await get_user_by_id(db, uuid.UUID(user_id))
                if user and user.role == UserRole.ADMIN and user.is_active:
                    return True
        except Exception:
            pass

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized: Admin secret or credentials required."
    )


# ═══════════════════════════════════════════════════
# 1. System & Global Stats
# ═══════════════════════════════════════════════════

@router.get("/stats")
async def get_admin_stats(
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db)
):
    try:
        # Total users
        total_users_res = await db.execute(select(func.count(User.id)))
        total_users = total_users_res.scalar_one() or 0

        # Total tasks
        total_tasks_res = await db.execute(select(func.count(Task.id)))
        total_tasks = total_tasks_res.scalar_one() or 0

        # Completed tasks
        completed_tasks_res = await db.execute(
            select(func.count(Task.id)).where(Task.status == "completed")
        )
        completed_tasks = completed_tasks_res.scalar_one() or 0

        # Failed tasks
        failed_tasks_res = await db.execute(
            select(func.count(Task.id)).where(Task.status == "failed")
        )
        failed_tasks = failed_tasks_res.scalar_one() or 0

        # Image tasks
        image_tasks_res = await db.execute(
            select(func.count(Task.id)).where(
                or_(Task.task_type == "image", Task.task_type == "t2i", Task.task_type == "i2i")
            )
        )
        image_tasks = image_tasks_res.scalar_one() or 0
        video_tasks = max(0, total_tasks - image_tasks)

        # Total credits granted
        total_credits_res = await db.execute(select(func.sum(User.daily_task_limit)))
        total_credits = total_credits_res.scalar_one() or 0

        stats_data = {
            "totalUsers": total_users,
            "totalTasks": total_tasks,
            "imageTasks": image_tasks,
            "videoTasks": video_tasks,
            "completedTasks": completed_tasks,
            "failedTasks": failed_tasks,
            "totalCreditsGranted": total_credits or 0,
            "backendConnected": True,
        }

        return {
            "success": True,
            "stats": stats_data,
            **stats_data
        }
    except Exception as e:
        logger.error(f"[Admin Stats] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch stats: {str(e)}")


# ═══════════════════════════════════════════════════
# 2. Users Directory & Credit Inspection
# ═══════════════════════════════════════════════════

@router.get("/users")
async def get_admin_users(
    search: str = Query("", description="Search term for name or email"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db)
):
    try:
        offset = (page - 1) * limit
        query = select(User)

        if search and search.strip():
            raw_term = search.strip()
            term = f"%{raw_term.lower()}%"
            try:
                search_uuid = uuid.UUID(raw_term)
                query = query.where(
                    or_(
                        User.id == search_uuid,
                        func.lower(User.email).like(term),
                        func.lower(User.name).like(term)
                    )
                )
            except ValueError:
                query = query.where(
                    or_(
                        func.lower(User.email).like(term),
                        func.lower(User.name).like(term)
                    )
                )

        count_query = select(func.count()).select_from(query.subquery())
        total_count_res = await db.execute(count_query)
        total_count = total_count_res.scalar_one() or 0

        users_res = await db.execute(
            query.order_by(desc(User.created_at)).offset(offset).limit(limit)
        )
        users = users_res.scalars().all()

        # Batch fetch task counts for all users in the page (O(1) database queries instead of O(N))
        one_day_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
        user_ids = [u.id for u in users]
        today_map = {}
        all_map = {}

        if user_ids:
            today_res = await db.execute(
                select(Task.user_id, func.count(Task.id))
                .where(Task.user_id.in_(user_ids))
                .where(Task.created_at >= one_day_ago)
                .group_by(Task.user_id)
            )
            for uid, cnt in today_res.all():
                if uid:
                    today_map[uid] = cnt

            all_res = await db.execute(
                select(Task.user_id, func.count(Task.id))
                .where(Task.user_id.in_(user_ids))
                .group_by(Task.user_id)
            )
            for uid, cnt in all_res.all():
                if uid:
                    all_map[uid] = cnt

        user_list = []
        for u in users:
            tasks_today = today_map.get(u.id, 0)
            total_tasks = all_map.get(u.id, 0)

            user_list.append({
                "id": str(u.id),
                "email": u.email,
                "name": u.name or u.email.split("@")[0],
                "full_name": u.name,
                "avatar_url": u.avatar_url,
                "credits": u.daily_task_limit,
                "daily_task_limit": u.daily_task_limit,
                "tasks_today": tasks_today,
                "total_tasks": total_tasks,
                "role": u.role.value if hasattr(u.role, "value") else str(u.role),
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_active": u.last_login_at.isoformat() if u.last_login_at else None,
            })

        return {
            "success": True,
            "users": user_list,
            "data": user_list,
            "total": total_count,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"[Admin Users] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch users: {str(e)}")


# ═══════════════════════════════════════════════════
# 3. Tasks & Generations Feed
# ═══════════════════════════════════════════════════

@router.get("/tasks")
async def get_admin_tasks(
    user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    task_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db)
):
    try:
        offset = (page - 1) * limit
        query = select(Task, User).outerjoin(User, Task.user_id == User.id)

        # Filters
        if user_id and user_id.strip():
            try:
                uid = uuid.UUID(user_id.strip())
                query = query.where(Task.user_id == uid)
            except ValueError:
                pass

        if status and status.lower() not in ("all", ""):
            query = query.where(Task.status == status.lower())

        if task_type and task_type.lower() not in ("all", ""):
            tt = task_type.lower()
            if tt == "image":
                query = query.where(or_(Task.task_type == "image", Task.task_type == "t2i", Task.task_type == "i2i"))
            elif tt == "video":
                query = query.where(Task.task_type.notin_(["image", "t2i", "i2i"]))
            else:
                query = query.where(Task.task_type == tt)

        if search and search.strip():
            term = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Task.prompt).like(term),
                    func.lower(Task.task_id).like(term),
                    func.lower(User.email).like(term),
                    func.lower(User.name).like(term)
                )
            )

        count_query = select(func.count()).select_from(query.subquery())
        total_res = await db.execute(count_query)
        total_count = total_res.scalar_one() or 0

        result = await db.execute(
            query.order_by(desc(Task.created_at)).offset(offset).limit(limit)
        )
        rows = result.all()

        task_list = []
        for task, user in rows:
            params = task.parameters or {}
            aspect_ratio = params.get("aspect_ratio") or params.get("resolution") or params.get("size") or "16:9"
            duration = task.duration_seconds or params.get("duration") or 5
            # Ensure only web URLs or data URIs are exposed to client
            def _clean_url(u: Optional[str]) -> str:
                if not u:
                    return ""
                if u.startswith("http://") or u.startswith("https://") or u.startswith("data:"):
                    return u
                return ""

            valid_video = _clean_url(task.video_url)
            valid_first = _clean_url(task.first_img_url)
            valid_second = _clean_url(task.second_img_url)
            media_url = valid_video or valid_first

            task_list.append({
                "id": str(task.id),
                "task_id": task.task_id,
                "user_id": str(task.user_id) if task.user_id else None,
                "user_email": user.email if user else "Anonymous / System",
                "user_name": user.name if user else None,
                "prompt": task.prompt or "No prompt provided",
                "task_type": task.task_type,
                "status": task.status,
                "aspect_ratio": aspect_ratio,
                "duration": duration,
                "video_url": valid_video,
                "first_img_url": valid_first,
                "second_img_url": valid_second,
                "result_url": media_url,
                "cloudinary_url": media_url,
                "media_url": media_url,
                "image_url": valid_first,
                "error": task.error_message,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            })

        return {
            "success": True,
            "tasks": task_list,
            "data": task_list,
            "total": total_count,
            "page": page,
            "limit": limit
        }
    except Exception as e:
        logger.error(f"[Admin Tasks] Error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch tasks: {str(e)}")


# ═══════════════════════════════════════════════════
# 4. User Credit Adjustments
# ═══════════════════════════════════════════════════

class CreditAdjustmentRequest(BaseModel):
    amount: int
    action: str = "add"  # "add", "deduct", "set"
    reason: Optional[str] = "Admin manual adjustment"


@router.post("/users/{user_id}/credits")
async def update_user_credits(
    user_id: str,
    payload: CreditAdjustmentRequest,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db)
):
    try:
        uid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user UUID format")

    user_res = await db.execute(select(User).where(User.id == uid))
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    amount = max(0, payload.amount)
    action = payload.action.lower()

    if action == "add":
        user.daily_task_limit = user.daily_task_limit + amount
    elif action == "deduct":
        user.daily_task_limit = max(0, user.daily_task_limit - amount)
    elif action == "set":
        user.daily_task_limit = amount
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Must be 'add', 'deduct', or 'set'.")

    await db.commit()
    await db.refresh(user)

    logger.info(f"[Admin Credits] User {user.email} updated to {user.daily_task_limit} credits via action '{action}'")

    return {
        "success": True,
        "message": f"Successfully updated credits for {user.email}",
        "user_id": str(user.id),
        "credits": user.daily_task_limit,
        "daily_task_limit": user.daily_task_limit
    }


# ═══════════════════════════════════════════════════
# 5. Task Action Endpoints (Retry / Delete)
# ═══════════════════════════════════════════════════

@router.post("/tasks/{task_id}/retry")
async def retry_task(
    task_id: str,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db)
):
    # Search by task_id or UUID
    conditions = [Task.task_id == task_id]
    try:
        task_uuid = uuid.UUID(task_id)
        conditions.append(Task.id == task_uuid)
    except ValueError:
        pass

    task_res = await db.execute(select(Task).where(or_(*conditions)))
    task = task_res.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    task.status = "pending"
    task.error_message = None
    await db.commit()
    await db.refresh(task)

    return {"success": True, "message": f"Task {task.task_id} reset to pending status."}


@router.delete("/tasks/{task_id}")
async def delete_task(
    task_id: str,
    is_admin: bool = Depends(verify_admin_access),
    db: AsyncSession = Depends(get_db)
):
    conditions = [Task.task_id == task_id]
    try:
        task_uuid = uuid.UUID(task_id)
        conditions.append(Task.id == task_uuid)
    except ValueError:
        pass

    task_res = await db.execute(select(Task).where(or_(*conditions)))
    task = task_res.scalars().first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.delete(task)
    await db.commit()

    return {"success": True, "message": f"Task {task_id} deleted successfully."}

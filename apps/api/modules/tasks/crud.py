import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from .models import Task
from .schemas import TaskUpdate

async def create_task(
    db: AsyncSession, 
    task_id: str, 
    task_type: str, 
    prompt: str | None, 
    duration_seconds: int | None,
    first_img_url: str | None = None,
    second_img_url: str | None = None,
    parameters: dict | None = None,
    user_id: uuid.UUID | None = None
) -> Task:
    task = Task(
        task_id=task_id,
        task_type=task_type,
        prompt=prompt,
        duration_seconds=duration_seconds,
        first_img_url=first_img_url,
        second_img_url=second_img_url,
        parameters=parameters,
        user_id=user_id
    )
    db.add(task)
    await db.commit()
    await db.refresh(task)
    return task

async def get_task_by_internal_id(db: AsyncSession, task_id: str) -> Task | None:
    """Get a task by the Agnes internal task_id."""
    result = await db.execute(select(Task).where(Task.task_id == task_id))
    return result.scalars().first()

async def get_tasks_by_user(db: AsyncSession, user_id: uuid.UUID, limit: int = 50, offset: int = 0) -> list[Task]:
    result = await db.execute(
        select(Task).where(Task.user_id == user_id).order_by(Task.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())

async def update_task(db: AsyncSession, task: Task, updates: TaskUpdate) -> Task:
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(task, key, value)
    
    if updates.status == "completed" and not task.completed_at:
        task.completed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        
    await db.commit()
    await db.refresh(task)
    return task

async def count_tasks_today(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Returns the number of tasks created by the user today (last 24 hours)."""
    one_day_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
    result = await db.execute(
        select(func.count(Task.id))
        .where(Task.user_id == user_id)
        .where(Task.created_at >= one_day_ago)
    )
    return result.scalar_one() or 0

async def list_all_tasks(db: AsyncSession, limit: int = 50, offset: int = 0) -> list[Task]:
    """For admins: list all tasks across all users."""
    result = await db.execute(
        select(Task).order_by(Task.created_at.desc()).limit(limit).offset(offset)
    )
    return list(result.scalars().all())

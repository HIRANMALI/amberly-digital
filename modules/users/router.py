import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db
from dependencies import get_current_user, require_admin
from . import crud, schemas
from .models import User

router = APIRouter()

# --- Public/User Endpoints ---

@router.get("/me", response_model=schemas.UserProfile)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from modules.tasks.crud import count_tasks_this_week  # Avoid circular import
    tasks_count = await count_tasks_this_week(db, current_user.id)
    
    # We create the profile response manually since tasks_this_week is computed
    profile_data = current_user.__dict__
    profile_data["tasks_this_week"] = tasks_count
    return profile_data

@router.patch("/me", response_model=schemas.UserRead)
async def update_my_profile(
    updates: schemas.UserUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.update_user(db, current_user, updates)


# --- Admin Endpoints ---

@router.get("/admin/users", response_model=list[schemas.UserRead])
async def admin_list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    return await crud.list_all_users(db)

@router.get("/admin/users/{user_id}", response_model=schemas.UserRead)
async def admin_get_user(
    user_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@router.patch("/admin/users/{user_id}", response_model=schemas.UserRead)
async def admin_update_user(
    user_id: uuid.UUID,
    updates: schemas.UserAdminUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    user = await crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
    
    await db.commit()
    await db.refresh(user)
    return user

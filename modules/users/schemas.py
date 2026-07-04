import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from .models import UserRole

class UserBase(BaseModel):
    name: str | None = None
    avatar_url: str | None = None

class UserRead(UserBase):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    email: str
    role: UserRole
    daily_task_limit: int
    created_at: datetime
    last_login_at: datetime

class UserProfile(UserRead):
    """Returned by /users/me, includes computed fields."""
    tasks_today: int

class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None

class UserAdminUpdate(BaseModel):
    """For admins to update a user's role or limits."""
    is_active: bool | None = None
    role: UserRole | None = None
    daily_task_limit: int | None = None

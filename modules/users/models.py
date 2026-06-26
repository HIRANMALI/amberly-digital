import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from enum import Enum
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from db.database import Base

if TYPE_CHECKING:
    from modules.tasks.models import Task
    from modules.auth.models import RefreshToken
else:
    # Ensure these are imported at runtime so SQLAlchemy's registry finds them
    import modules.tasks.models
    import modules.auth.models

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserRole(str, Enum):
    USER = "user"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    google_id: Mapped[str] = mapped_column(unique=True, index=True)
    email: Mapped[str] = mapped_column(unique=True, index=True)
    name: Mapped[str | None]
    avatar_url: Mapped[str | None]
    
    is_active: Mapped[bool] = mapped_column(default=True)
    role: Mapped[UserRole] = mapped_column(SQLEnum(UserRole, native_enum=True), default=UserRole.USER)
    weekly_task_limit: Mapped[int] = mapped_column(default=5)
    
    created_at: Mapped[datetime] = mapped_column(default=get_utc_now, server_default=func.now())
    last_login_at: Mapped[datetime] = mapped_column(default=get_utc_now, server_default=func.now())

    # Relationships
    tasks: Mapped[list["Task"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user", cascade="all, delete-orphan")

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from sqlalchemy import JSON, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from db.database import Base

if TYPE_CHECKING:
    from modules.users.models import User

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    task_id: Mapped[str] = mapped_column(unique=True, index=True)   # Agnes internal task_id
    
    task_type: Mapped[str]  # text_to_video / image_to_video / keyframes
    status: Mapped[str] = mapped_column(default="pending")
    
    prompt: Mapped[str | None]
    video_url: Mapped[str | None]
    first_img_url: Mapped[str | None]
    second_img_url: Mapped[str | None]
    
    duration_seconds: Mapped[int | None]
    parameters: Mapped[dict | None] = mapped_column(type_=JSON)
    api_video_id: Mapped[str | None]
    error_message: Mapped[str | None]
    
    created_at: Mapped[datetime] = mapped_column(default=get_utc_now, server_default=func.now())
    completed_at: Mapped[datetime | None]

    # Relationships
    user: Mapped["User | None"] = relationship(back_populates="tasks")

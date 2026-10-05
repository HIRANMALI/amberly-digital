import uuid
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID
    task_id: str
    task_type: str
    status: str
    prompt: str | None
    video_url: str | None
    first_img_url: str | None
    second_img_url: str | None
    duration_seconds: int | None
    parameters: dict | None
    api_video_id: str | None
    error_message: str | None
    created_at: datetime
    completed_at: datetime | None

class TaskUpdate(BaseModel):
    status: str | None = None
    video_url: str | None = None
    api_video_id: str | None = None
    error_message: str | None = None
    completed_at: datetime | None = None

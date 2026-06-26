"""
Agnes Video Generator v2.0 — Data Model Layer

Defines data structures for all task types:
- TaskType Enum, VideoMode Enum
- SubtitleStyle, AudioConfig config classes
- BaseTaskState (shared fields) + 3 task subclasses
- Request/Response models
"""

from __future__ import annotations

import uuid
from enum import Enum
from typing import List, Literal, Optional, Tuple, Union

from pydantic import BaseModel, Field, field_validator


# ═══════════════════════════════════════════════════
# Enums
# ═══════════════════════════════════════════════════


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskType(str, Enum):
    SIMPLE = "simple"
    CREATIVE = "creative"
    MANUSCRIPT = "manuscript"


class VideoMode(str, Enum):
    T2V = "t2v"
    I2V = "i2v"
    TI2VID = "ti2vid"
    KEYFRAMES = "keyframes"


# ═══════════════════════════════════════════════════
# Configuration Classes
# ═══════════════════════════════════════════════════


class SubtitleStyle(BaseModel):
    """Subtitle style configuration"""

    font: str = "STHeitiMedium.ttc"
    color: str = "white"
    position: tuple = ("center", "bottom-80")
    fontsize: int = 48
    stroke_color: str = "black"
    stroke_width: int = 2
    bg_color: tuple = (0, 0, 0, 128)

    @field_validator("bg_color", mode="before")
    @classmethod
    def _coerce_bg_color(cls, v):
        if isinstance(v, tuple):
            return v
        if isinstance(v, str):
            if "@" in v:
                parts = v.split("@", 1)
                rgb = {"black": (0, 0, 0), "white": (255, 255, 255),
                       "red": (255, 0, 0), "blue": (0, 0, 255),
                       "yellow": (255, 255, 0)}.get(parts[0].strip().lower(), (0, 0, 0))
                return (*rgb, int(float(parts[1]) * 255))
            if v.lower() in ("none", "transparent", ""):
                return None
        return (0, 0, 0, 128)


class AudioConfig(BaseModel):
    """Audio configuration (TTS voice + subtitle style)"""

    enabled: bool = True
    voice: str = "zh-CN-XiaoxiaoNeural"
    rate: str = "+0%"
    subtitle_style: SubtitleStyle = Field(default_factory=SubtitleStyle)


# ═══════════════════════════════════════════════════
# Sub-structure Models
# ═══════════════════════════════════════════════════


class ManuscriptParagraph(BaseModel):
    """Manuscript paragraph (specific to Type 3)"""

    index: int
    text: str
    scene_prompt: str = ""
    same_scene_as_prev: bool = False
    video_id: str = ""
    video_file: str = ""
    narration_audio: str = ""
    subtitle_srt: str = ""
    final_clip: str = ""


class SceneTask(BaseModel):
    """Scene task (specific to Type 2, v2.0 added voiceover/audio/subtitle fields)"""

    index: int
    status: StepStatus = StepStatus.PENDING
    end_frame_prompt: str = ""
    end_frame_file: str = ""
    video_id: str = ""
    video_status: StepStatus = StepStatus.PENDING
    video_file: str = ""
    # Added in v2.0
    narration_text: str = ""
    narration_audio: str = ""
    subtitle_srt: str = ""
    final_clip: str = ""


# ═══════════════════════════════════════════════════
# Task State Models
# ═══════════════════════════════════════════════════


class BaseTaskState(BaseModel):
    """Base fields shared by all tasks (abstract parent class)"""

    task_id: str = Field(default_factory=lambda: uuid.uuid4().hex[:12])
    creative_name: str = ""
    task_type: TaskType
    status: StepStatus = StepStatus.PENDING
    video_width: int = 1152
    video_height: int = 768
    final_video_file: str = ""
    cloudinary_url: str = ""
    reference_cloudinary_url: str = ""
    end_frame_cloudinary_url: str = ""


class SimpleVideoTask(BaseTaskState):
    """Simple video task (Type 1)

    User inputs prompt directly, selects mode/duration/resolution, and calls Agnes Video API to generate a single video.
    """

    task_type: Literal[TaskType.SIMPLE] = TaskType.SIMPLE  # type: ignore

    prompt: str = ""
    mode: VideoMode = VideoMode.T2V
    reference_image: str = ""
    end_frame_image: str = ""
    duration: int = 5
    seed: Optional[int] = None
    negative_prompt: Optional[str] = None
    video_id: str = ""


class CreativeVideoTask(BaseTaskState):
    """Creative long video task (Type 2)

    Keeps all existing TaskState fields backward-compatible, adds audio/subtitle config and narration lists in v2.0.
    """

    task_type: Literal[TaskType.CREATIVE] = TaskType.CREATIVE  # type: ignore

    # ── Existing fields (maintain compatibility) ──
    idea: str = ""
    user_requirement: str = ""
    style: str = ""
    chaining_mode: str = "none"
    video_duration: int = 5

    reference_image: str = ""
    end_frame_images: List[str] = Field(default_factory=list)
    use_custom_end_frames: bool = False
    generate_end_frames_from_ref: bool = False

    step_story: StepStatus = StepStatus.PENDING
    story_file: str = ""

    step_character_ref: StepStatus = StepStatus.PENDING
    character_ref_prompt: str = ""
    character_ref_file: str = ""

    step_script: StepStatus = StepStatus.PENDING
    script_file: str = ""
    scene_count: int = 0

    step_end_frame_prompts: StepStatus = StepStatus.PENDING
    end_frame_prompts_file: str = ""

    step_image_analysis: StepStatus = StepStatus.PENDING
    image_analysis_file: str = ""

    step_end_frame_generation: StepStatus = StepStatus.PENDING
    pregenerated_end_frames: dict = Field(default_factory=dict)

    scenes: List[SceneTask] = Field(default_factory=list)

    step_video_generation: StepStatus = StepStatus.PENDING

    # ── Added in v2.0: Audio + Subtitles ──
    step_audio_subtitle: StepStatus = StepStatus.PENDING
    audio_config: AudioConfig = Field(default_factory=AudioConfig)
    narrations: List[str] = Field(default_factory=list)

    step_concatenation: StepStatus = StepStatus.PENDING

    # ── Helper methods (maintain backward compatibility) ──

    def all_scenes_completed(self) -> bool:
        return all(s.status == StepStatus.COMPLETED for s in self.scenes)

    def all_videos_completed(self) -> bool:
        return all(s.video_status == StepStatus.COMPLETED for s in self.scenes)

    def get_pending_scenes(self) -> List[SceneTask]:
        return [s for s in self.scenes if s.status != StepStatus.COMPLETED]

    def get_pending_videos(self) -> List[SceneTask]:
        return [s for s in self.scenes if s.video_status != StepStatus.COMPLETED]


class ManuscriptVideoTask(BaseTaskState):
    """Manuscript long video task (Type 3)

    User pastes long text -> split into paragraphs based on reading time -> generate video prompt for each paragraph -> video generation -> TTS + Subtitles -> concatenation.
    """

    task_type: Literal[TaskType.MANUSCRIPT] = TaskType.MANUSCRIPT  # type: ignore

    manuscript_text: str = ""
    paragraphs: List[ManuscriptParagraph] = Field(default_factory=list)
    audio_config: AudioConfig = Field(default_factory=AudioConfig)
    video_duration: int = 10

    combined_audio: str = ""
    combined_subtitle: str = ""

    step_split: StepStatus = StepStatus.PENDING
    step_scene_prompts: StepStatus = StepStatus.PENDING
    step_video_generation: StepStatus = StepStatus.PENDING
    step_audio_subtitle: StepStatus = StepStatus.PENDING
    step_concatenation: StepStatus = StepStatus.PENDING


# ═══════════════════════════════════════════════════
# Union Types + Deserialization Factory
# ═══════════════════════════════════════════════════

AnyTaskState = Union[SimpleVideoTask, CreativeVideoTask, ManuscriptVideoTask]

# For TaskManager.load(): select the correct model class based on task_type field
_TASK_TYPE_MAP: dict[str, type[BaseTaskState]] = {
    TaskType.SIMPLE: SimpleVideoTask,
    TaskType.CREATIVE: CreativeVideoTask,
    TaskType.MANUSCRIPT: ManuscriptVideoTask,
}


def parse_task_state(data: dict) -> BaseTaskState:
    """Deserialize to the correct task subclass based on task_type field.

    Backward compatibility: if there is no task_type field in data, defaults to CREATIVE type (D6 decision).
    """
    task_type_str = data.get("task_type", TaskType.CREATIVE)
    model_cls = _TASK_TYPE_MAP.get(task_type_str, CreativeVideoTask)
    return model_cls(**data)


# ═══════════════════════════════════════════════════
# Request Models
# ═══════════════════════════════════════════════════


class CreateSimpleTaskRequest(BaseModel):
    """Request body for creating a simple video task"""

    prompt: str
    mode: str = "t2v"
    duration: int = 5
    video_width: int = 768
    video_height: int = 1152
    seed: Optional[int] = None
    negative_prompt: Optional[str] = None


class CreateCreativeTaskRequest(BaseModel):
    """Request body for creating a creative long video task"""

    idea: str
    user_requirement: str = "3 scenes, 10 seconds per scene, cinematic"
    style: str = "cinematic realistic style"
    chaining_mode: str = "keyframes"
    video_width: int = 768
    video_height: int = 1152
    video_duration: int = 5
    audio_config: Optional[AudioConfig] = None


class CreateManuscriptTaskRequest(BaseModel):
    """Request body for creating a manuscript long video task"""

    manuscript_text: str
    video_width: int = 768
    video_height: int = 1152
    video_duration: int = 10
    audio_config: Optional[AudioConfig] = None


# ═══════════════════════════════════════════════════
# Response Models
# ═══════════════════════════════════════════════════


class TaskResponse(BaseModel):
    task_id: str
    status: str
    progress: float = 0.0
    message: str = ""
    final_video_url: str = ""


class WSMessage(BaseModel):
    type: str
    task_id: str = ""
    step: str = ""
    status: str = ""
    message: str = ""
    progress: float = 0.0
    data: dict = Field(default_factory=dict)


# ═══════════════════════════════════════════════════
# Backward compatibility aliases (to be removed after Batch B/C migration completes)
# ═══════════════════════════════════════════════════

# TaskState is equivalent to CreativeVideoTask in legacy code (D6)
TaskState = CreativeVideoTask

# Legacy request model mapped to the new creative video request
CreateTaskRequest = CreateCreativeTaskRequest

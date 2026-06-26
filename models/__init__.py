"""
models — Agnes Video Generator v2.0 Data Model Layer

Exports all task models, enums, config classes, and request/response models.
"""

from models.task import (
    # Enums
    StepStatus,
    TaskType,
    VideoMode,
    # Config Classes
    AudioConfig,
    SubtitleStyle,
    # Substuctures
    ManuscriptParagraph,
    SceneTask,
    # Task State Models
    AnyTaskState,
    BaseTaskState,
    CreativeVideoTask,
    ManuscriptVideoTask,
    SimpleVideoTask,
    # Factory Functions
    parse_task_state,
    # Request Models
    CreateCreativeTaskRequest,
    CreateManuscriptTaskRequest,
    CreateSimpleTaskRequest,
    # Backward Compatibility Aliases (remove after Batch B/C migration completes)
    CreateTaskRequest,
    TaskState,
    # Response Models
    TaskResponse,
    WSMessage,
)

__all__ = [
    # Enums
    "StepStatus",
    "TaskType",
    "VideoMode",
    # Config
    "AudioConfig",
    "SubtitleStyle",
    # Substructures
    "ManuscriptParagraph",
    "SceneTask",
    # Task models
    "AnyTaskState",
    "BaseTaskState",
    "CreativeVideoTask",
    "ManuscriptVideoTask",
    "SimpleVideoTask",
    # Factory
    "parse_task_state",
    # Requests
    "CreateCreativeTaskRequest",
    "CreateManuscriptTaskRequest",
    "CreateSimpleTaskRequest",
    # Backward compatibility
    "CreateTaskRequest",
    "TaskState",
    # Responses
    "TaskResponse",
    "WSMessage",
]

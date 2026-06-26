"""
core/task_manager.py — Agnes Video Generator v2.0 Task State Manager

General support for three task types (Simple / Creative / Manuscript), maintaining backward compatibility.
D6: load() automatically identifies legacy data without task_type field as CreativeVideoTask.
"""

import json
import logging
import os
from typing import Optional

from core.config import get_working_dir
from models.task import (
    AnyTaskState,
    BaseTaskState,
    CreativeVideoTask,
    ManuscriptParagraph,
    SceneTask,
    StepStatus,
    TaskType,
    parse_task_state,
)

logger = logging.getLogger(__name__)


class TaskManager:
    """Task state persistence manager.

    Responsible for creating, loading, updating and enumerating task states
    in the file system (.working_dir/{dir_name}/task_state.json).
    v2.0 supports polymorphic serialization of the three task types.
    """

    def __init__(self, task_id: str, dir_name: Optional[str] = None):
        self.task_id = task_id
        self.dir_name = dir_name or task_id
        self.task_dir = os.path.join(get_working_dir(), self.dir_name)
        self._task_file = os.path.join(self.task_dir, "task_state.json")
        self._state: Optional[BaseTaskState] = None

    def _ensure_dir(self):
        os.makedirs(self.task_dir, exist_ok=True)

    def create(self, state: BaseTaskState) -> BaseTaskState:
        """Create new task and persist it."""
        self._ensure_dir()
        self._state = state
        self._state.task_id = self.task_id
        self._save()
        logger.info(f"[TaskManager] Created task {self.task_id}, type={self._state.task_type}")
        return self._state

    def load(self) -> Optional[BaseTaskState]:
        """Load task state.

        v2.0: Uses parse_task_state() to deserialize to the correct subclass based on task_type field.
        Backward compatibility: legacy data without task_type -> automatically treated as CreativeVideoTask (D6).
        """
        self._ensure_dir()
        if not os.path.exists(self._task_file):
            return None

        try:
            with open(self._task_file, "r") as f:
                data = json.load(f)

            # v2.0: Deserialize via parse_task_state factory function
            # Legacy data has no task_type, parse_task_state defaults to CREATIVE
            self._state = parse_task_state(data)

            # For CreativeVideoTask, ensure scenes field is correctly deserialized
            if isinstance(self._state, CreativeVideoTask):
                # Pydantic v2 handles List[SceneTask] deserialization automatically.
                # Doing a defensive validation check here.
                self._state.scenes = [
                    SceneTask(**s) if isinstance(s, dict) else s
                    for s in (data.get("scenes") or self._state.scenes)
                ]

            logger.debug(
                f"[TaskManager] Loaded task {self.task_id}: "
                f"type={self._state.task_type}, status={self._state.status}"
            )
            return self._state

        except Exception as e:
            logger.warning(f"[TaskManager] Failed to load task: {e}")
            return None

    def _save(self):
        """Persist current state to JSON file."""
        self._ensure_dir()
        if self._state:
            with open(self._task_file, "w") as f:
                json.dump(self._state.model_dump(), f, ensure_ascii=False, indent=2)

    def update_step(self, step_name: str, status: StepStatus):
        """Update a step status and persist it."""
        if self._state:
            setattr(self._state, step_name, status)
            self._save()

    def update_scene(self, scene: SceneTask):
        """Update a scene status and persist it (CreativeVideoTask only)."""
        if self._state and isinstance(self._state, CreativeVideoTask):
            for i, s in enumerate(self._state.scenes):
                if s.index == scene.index:
                    self._state.scenes[i] = scene
                    self._save()
                    return

    def update_state(self, **kwargs):
        """Batch update state fields and persist them."""
        if self._state:
            for key, value in kwargs.items():
                if hasattr(self._state, key):
                    # Convert serialized dict lists back to model instances
                    if key == "scenes" and isinstance(value, list):
                        value = [
                            SceneTask(**s) if isinstance(s, dict) else s
                            for s in value
                        ]
                    elif key == "paragraphs" and isinstance(value, list):
                        value = [
                            ManuscriptParagraph(**p) if isinstance(p, dict) else p
                            for p in value
                        ]
                    setattr(self._state, key, value)
            self._save()

    def get_state(self) -> Optional[BaseTaskState]:
        """Return the currently loaded task state."""
        return self._state

    def exists(self) -> bool:
        """Check if the task state file exists."""
        return os.path.exists(self._task_file)

    def list_tasks(self) -> list:
        """Enumerate all tasks (includes task_type field, v2.0 enhanced)."""
        working_dir = get_working_dir()
        if not os.path.exists(working_dir):
            return []
        tasks = []
        for name in os.listdir(working_dir):
            task_file = os.path.join(working_dir, name, "task_state.json")
            if os.path.exists(task_file):
                try:
                    with open(task_file, "r") as f:
                        data = json.load(f)
                    tasks.append({
                        "task_id": data.get("task_id", name),
                        "dir_name": name,
                        "task_type": data.get("task_type", TaskType.CREATIVE),
                        "creative_name": data.get("creative_name", ""),
                        "status": data.get("status", "pending"),
                        "chaining_mode": data.get("chaining_mode", "none"),
                    })
                except Exception:
                    pass
        tasks.sort(key=lambda t: t.get("task_id", ""), reverse=True)
        return tasks

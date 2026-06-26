"""core.pipelines — Business Pipeline Layer

BasePipeline abstract base class + three pipeline exports.
"""

import asyncio
import logging
from abc import ABC, abstractmethod
from typing import Callable, Optional

from core.task_manager import TaskManager
from models.task import BaseTaskState

logger = logging.getLogger(__name__)


class PipelineShutdown(Exception):
    """Pipeline shutdown exception."""
    pass


class BasePipeline(ABC):
    """Abstract base class for all pipelines.

    Provides shared infrastructure such as progress callbacks, resume capabilities, and shutdown control.
    """

    def __init__(
        self,
        api_key: str,
        task_id: str,
        dir_name: Optional[str] = None,
        progress_callback: Optional[Callable] = None,
        shutdown_event: Optional[asyncio.Event] = None,
    ):
        self.api_key = api_key
        self.task_id = task_id
        self.dir_name = dir_name or task_id
        self.task_manager = TaskManager(task_id, dir_name=self.dir_name)
        self.progress_callback = progress_callback
        self.shutdown_event = shutdown_event
        self._stop_event = asyncio.Event()
        self._state: Optional[BaseTaskState] = None

    async def _emit(
        self,
        step: str,
        status: str,
        message: str,
        progress: float = 0.0,
        data: Optional[dict] = None,
    ):
        """Send progress message to frontend."""
        if self.progress_callback:
            await self.progress_callback(step, status, message, progress, data or {})

    def _is_shutdown(self) -> bool:
        """Check if shutdown/stop signal is received."""
        if self._stop_event.is_set():
            return True
        return self.shutdown_event is not None and self.shutdown_event.is_set()

    def stop(self):
        """Request pipeline to stop at the next checkpoint."""
        self._stop_event.set()

    @property
    def state(self) -> Optional[BaseTaskState]:
        return self._state

    @property
    def working_dir(self) -> str:
        return self.task_manager.task_dir

    @abstractmethod
    async def run(self, state: BaseTaskState) -> str:
        """Run the pipeline, returning the final video path."""
        ...


# Lazy imports to avoid circular dependency
def _get_simple_pipeline():
    from core.pipelines.simple_video import SimpleVideoPipeline
    return SimpleVideoPipeline


def _get_creative_pipeline():
    from core.pipelines.creative_video import CreativeVideoPipeline
    return CreativeVideoPipeline


def _get_manuscript_pipeline():
    from core.pipelines.manuscript_video import ManuscriptVideoPipeline
    return ManuscriptVideoPipeline


# Exports
from core.pipelines.simple_video import SimpleVideoPipeline
from core.pipelines.creative_video import CreativeVideoPipeline
from core.pipelines.manuscript_video import ManuscriptVideoPipeline

__all__ = [
    "BasePipeline",
    "PipelineShutdown",
    "SimpleVideoPipeline",
    "CreativeVideoPipeline",
    "ManuscriptVideoPipeline",
]

"""core.pipelines.simple_video — Simple video generation pipeline (Type 1)

User inputs prompt → Choose mode (t2v/i2v/keyframes) → Call Agnes Video API → Return video.
"""

import asyncio
import json
import logging
import os
from typing import Callable, Optional

from core.api.agnes_video import AgnesVideoAPI
from core.pipelines import BasePipeline, PipelineShutdown
from models.task import BaseTaskState, SimpleVideoTask, StepStatus

logger = logging.getLogger(__name__)


class SimpleVideoPipeline(BasePipeline):
    """Simple video generation pipeline.

    Steps: Parameter validation → Submit video task → Poll & wait → Download & save.
    Supports resume: resume polling via video_id saved in task.json.
    """

    def __init__(
        self,
        api_key: str,
        task_id: str,
        dir_name: Optional[str] = None,
        progress_callback: Optional[Callable] = None,
        shutdown_event: Optional[asyncio.Event] = None,
    ):
        super().__init__(api_key, task_id, dir_name, progress_callback, shutdown_event)
        self.video_api = AgnesVideoAPI(api_key=api_key)
        self.video_api.shutdown_event = shutdown_event

    async def run(self, state: BaseTaskState) -> str:
        """Runs the simple video generation pipeline."""
        assert isinstance(state, SimpleVideoTask)
        self._state = state
        self._state.status = StepStatus.RUNNING
        self.task_manager.create(self._state)

        await self._emit("init", "running", "Starting simple video generation...", 0.0)

        try:
            video_path = await self._submit_and_wait()

            self._state.status = StepStatus.COMPLETED
            self._state.final_video_file = video_path
            self.task_manager.update_state(
                status=StepStatus.COMPLETED,
                final_video_file=video_path,
            )
            await self._emit("done", "completed", "Video generation completed!", 1.0, {"final_video": video_path})
            return video_path

        except PipelineShutdown as e:
            logger.info(f"[Simple] Shutdown: {e}")
            await self._emit("error", "failed", "Task has been interrupted, can be resumed from the task list", 0.0)
            raise
        except Exception as e:
            self._state.status = StepStatus.FAILED
            self.task_manager.update_state(status=StepStatus.FAILED)
            await self._emit("error", "failed", str(e), 0.0)
            raise

    # ------------------------------------------------------------------
    # Curl / task persistence helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _make_curl(video_id: str) -> str:
        return (
            f'curl -s -H "Authorization: Bearer $AGNES_API_KEY" '
            f'"https://apihub.agnes-ai.com/agnesapi?video_id={video_id}"'
        )

    def _save_task(self, video_id: str) -> None:
        task_file = os.path.join(self.working_dir, "task.json")
        with open(task_file, "w") as f:
            json.dump({"video_id": video_id}, f, indent=2)
        curl_file = os.path.join(self.working_dir, "curl.sh")
        with open(curl_file, "w") as f:
            f.write(self._make_curl(video_id) + "\n")

    def _load_task(self) -> Optional[str]:
        task_file = os.path.join(self.working_dir, "task.json")
        if os.path.exists(task_file):
            try:
                with open(task_file, "r") as f:
                    data = json.load(f)
                return data.get("video_id") or data.get("task_id")
            except Exception:
                pass
        return None

    async def _submit_and_wait(self) -> str:
        """Submit video task and wait for completion. Supports resume."""
        video_path = os.path.join(self.working_dir, "final_video.mp4")

        state = self._state
        assert isinstance(state, SimpleVideoTask)

        if os.path.exists(video_path):
            logger.info("[Simple] Video already exists, skipping")
            return video_path

        # Attempt to resume from task.json (resume scenario)
        saved_video_id = self._load_task()
        if saved_video_id:
            logger.info(f"[Simple] Resuming from saved task.json video_id: {saved_video_id}")
            state.video_id = saved_video_id
            self.task_manager.update_state(video_id=saved_video_id)
            await self._emit("video_gen", "running", f"Resuming polling for video task {saved_video_id[:16]}...", 0.3)
            video_output = await self.video_api.wait_for_video(saved_video_id)
            video_output.save(video_path)
            return video_path

        # Also check video_id in state (backward compatible for resume)
        if state.video_id:
            logger.info(f"[Simple] Resuming from state video_id: {state.video_id}")
            self._save_task(state.video_id)
            await self._emit("video_gen", "running", f"Resuming polling for video task {state.video_id[:16]}...", 0.3)
            video_output = await self.video_api.wait_for_video(state.video_id)
            video_output.save(video_path)
            return video_path

        # Build reference image list
        ref_images = []
        if state.reference_image:
            ref_images.append(state.reference_image)
        if state.end_frame_image:
            ref_images.append(state.end_frame_image)

        await self._emit("video_gen", "running", f"Submitting video task (mode={state.mode})...", 0.1)

        video_id = await self.video_api.submit_video(
            prompt=state.prompt,
            reference_image_paths=ref_images,
            duration=state.duration,
            width=state.video_width,
            height=state.video_height,
            seed=state.seed,
            negative_prompt=state.negative_prompt,
        )

        # Persist video_id + curl command
        state.video_id = video_id
        self._save_task(video_id)
        self.task_manager.update_state(video_id=video_id)

        await self._emit("video_gen", "running", f"Waiting for video generation {video_id[:16]}...", 0.3)

        video_output = await self.video_api.wait_for_video(video_id)
        video_output.save(video_path)

        await self._emit("video_gen", "completed", "Video generation completed", 0.9)
        return video_path

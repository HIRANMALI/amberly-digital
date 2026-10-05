"""core.pipelines.manuscript_video -- Manuscript long-form video generation pipeline (Type 3)

User pastes long text manuscript -> Split segments by speech duration -> Generate video prompt for each segment -> Video generation -> TTS + Subtitles -> Concatenation.
"""

import asyncio
import json
import logging
import math
import os
import re
from typing import Callable, List, Optional, Tuple

from core.api.agnes_video import AgnesVideoAPI
from core.audio.tts import EdgeTTSEngine, SilentTTSEngine
from core.audio.subtitle import SubtitleGenerator
from core.compositor.concatenator import VideoConcatenator
from core.screenwriter import Screenwriter
from core.task_manager import TaskManager
from core.pipelines import BasePipeline, PipelineShutdown
from models.task import (
    BaseTaskState,
    ManuscriptVideoTask,
    ManuscriptParagraph,
    StepStatus,
    AudioConfig,
)

logger = logging.getLogger(__name__)

# Chinese sentence-ending punctuation pattern.
_SENTENCE_END_RE = re.compile(r"(?<=[。！？])")

# Estimated Chinese speech rate: ~4 characters per second.
_CHARS_PER_SEC = 4.0

# Greedy-merge duration thresholds (seconds).
_MAX_SEGMENT_DURATION = 12.0
_MIN_SEGMENT_DURATION = 5.0


class ManuscriptVideoPipeline(BasePipeline):
    """Manuscript long-form video generation pipeline.

    Splits the user-submitted long text manuscript into several paragraphs, generates a video segment for each paragraph independently,
    then overlays TTS narration and subtitles, and concatenates into the final long video.

    Pipeline steps:
        1. ``_step_split_text``          -- Split text by speech duration
        2. ``_step_generate_scene_prompts`` -- Generate English video prompt for each segment
        3. ``_step_generate_videos``     -- Call Agnes Video API to generate video
        4. ``_step_audio_subtitle``      -- TTS narration + SRT subtitles
        5. ``_step_concatenate``         -- Concatenate into final video

    Supports:
        - Resume: Checks whether each step is already completed before starting (via step status field and existence of product file)
        - Shutdown: Checks for ``PipelineShutdown`` between steps and before time-consuming operations

    Attributes:
        video_api: Agnes Video API client.
        screenwriter: LLM screenwriter client.
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
        self.screenwriter = Screenwriter(api_key=api_key)
        self._state: Optional[ManuscriptVideoTask] = None  # type: ignore

    # ------------------------------------------------------------------
    # Public entry point
    # ------------------------------------------------------------------

    async def run(self, state: BaseTaskState) -> str:
        """Executes the manuscript long-form video generation pipeline.

        Args:
            state: Manuscript long-form video task state.

        Returns:
            File path of the final concatenated video.

        Raises:
            PipelineShutdown: Thrown when stop signal is received.
        """
        assert isinstance(state, ManuscriptVideoTask)
        self._state = state
        self._state.status = StepStatus.RUNNING
        self.task_manager.create(self._state)

        await self._emit("init", "running", "Starting manuscript long-form video generation...", 0.0)

        try:
            # ── Step 1: Split text ────────────────────────────────────────
            self._check_shutdown()
            paragraphs = await self._run_step_split_text()

            # ── Step 2: Generate scene prompt ─────────────────────────────
            self._check_shutdown()
            await self._run_step_generate_scene_prompts(paragraphs)

            # ── Step 3: Generate video ────────────────────────────────────
            self._check_shutdown()
            await self._run_step_generate_videos(paragraphs)

            # ── Step 4: Narration + Subtitles ─────────────────────────────
            self._check_shutdown()
            await self._run_step_audio_subtitle(paragraphs, state.audio_config)

            # ── Step 5: Concatenation ─────────────────────────────────────
            self._check_shutdown()
            final_video = await self._run_step_concatenate(
                paragraphs, state.audio_config
            )

            # ── Completion ────────────────────────────────────────────────
            self._state.status = StepStatus.COMPLETED
            self._state.final_video_file = final_video
            self.task_manager.update_state(
                status=StepStatus.COMPLETED,
                final_video_file=final_video,
            )
            await self._emit(
                "done", "completed", "Manuscript long-form video generation completed!", 1.0,
                {"final_video": final_video},
            )
            return final_video

        except PipelineShutdown as exc:
            logger.info(f"[Manuscript] Shutdown: {exc}")
            await self._emit(
                "error", "failed", "Task has been interrupted, can be resumed from the task list", 0.0,
            )
            raise
        except Exception as exc:
            self._state.status = StepStatus.FAILED
            self.task_manager.update_state(status=StepStatus.FAILED)
            await self._emit("error", "failed", str(exc), 0.0)
            raise

    # ------------------------------------------------------------------
    # Step runners (wrap step logic + persistence + progress)
    # ------------------------------------------------------------------

    async def _run_step_split_text(self) -> List[ManuscriptParagraph]:
        """Runs Step 1: Text splitting, with resume support."""
        assert self._state is not None
        if self._state.step_split == StepStatus.COMPLETED and self._state.paragraphs:
            logger.info("[Manuscript] Step 1 (split_text): already completed, resuming")
            return self._state.paragraphs

        self.task_manager.update_step("step_split", StepStatus.RUNNING)
        await self._emit("split_text", "running", "Splitting text paragraphs...", 0.02)

        paragraphs = self._step_split_text(self._state.manuscript_text)
        self._state.paragraphs = paragraphs
        self.task_manager.update_state(
            paragraphs=paragraphs,
        )
        self.task_manager.update_step("step_split", StepStatus.COMPLETED)

        await self._emit(
            "split_text", "completed",
            f"Text has been split into {len(paragraphs)} paragraph(s)", 0.05,
        )
        return paragraphs

    async def _run_step_generate_scene_prompts(
        self, paragraphs: List[ManuscriptParagraph],
    ) -> None:
        """Runs Step 2: Scene prompt generation, with resume support."""
        assert self._state is not None
        if self._state.step_scene_prompts == StepStatus.COMPLETED:
            logger.info("[Manuscript] Step 2 (scene_prompts): already completed, resuming")
            return

        self.task_manager.update_step("step_scene_prompts", StepStatus.RUNNING)
        await self._emit("scene_prompts", "running", "Generating scene descriptions...", 0.05)

        await self._step_generate_scene_prompts(paragraphs)

        self.task_manager.update_state(paragraphs=paragraphs)
        self.task_manager.update_step("step_scene_prompts", StepStatus.COMPLETED)
        await self._emit("scene_prompts", "completed", "Scene description generation completed", 0.15)

    async def _run_step_generate_videos(
        self, paragraphs: List[ManuscriptParagraph],
    ) -> None:
        """Runs Step 3: Video generation, with resume support."""
        assert self._state is not None
        if self._state.step_video_generation == StepStatus.COMPLETED:
            logger.info("[Manuscript] Step 3 (video_generation): already completed, resuming")
            return

        self.task_manager.update_step("step_video_generation", StepStatus.RUNNING)
        await self._emit("video_gen", "running", "Generating paragraph videos...", 0.15)

        await self._step_generate_videos(paragraphs)

        self.task_manager.update_state(paragraphs=paragraphs)
        self.task_manager.update_step("step_video_generation", StepStatus.COMPLETED)
        await self._emit("video_gen", "completed", "All paragraph videos have been generated", 0.60)

    async def _run_step_audio_subtitle(
        self,
        paragraphs: List[ManuscriptParagraph],
        audio_config: AudioConfig,
    ) -> None:
        """Runs Step 4: TTS narration + subtitles, with resume support."""
        assert self._state is not None
        if self._state.step_audio_subtitle == StepStatus.COMPLETED:
            logger.info("[Manuscript] Step 4 (audio_subtitle): already completed, resuming")
            return

        self.task_manager.update_step("step_audio_subtitle", StepStatus.RUNNING)
        await self._emit("audio_subtitle", "running", "Generating narration and subtitles...", 0.60)

        await self._step_audio_subtitle(paragraphs, audio_config)

        self.task_manager.update_state(paragraphs=paragraphs)
        self.task_manager.update_step("step_audio_subtitle", StepStatus.COMPLETED)
        await self._emit("audio_subtitle", "completed", "Narration and subtitles have been generated", 0.80)

    async def _run_step_concatenate(
        self,
        paragraphs: List[ManuscriptParagraph],
        audio_config: AudioConfig,
    ) -> str:
        """Runs Step 5: Video concatenation, with resume support."""
        assert self._state is not None
        if self._state.step_concatenation == StepStatus.COMPLETED:
            logger.info("[Manuscript] Step 5 (concatenation): already completed, resuming")
            if self._state.final_video_file:
                return self._state.final_video_file

        self.task_manager.update_step("step_concatenation", StepStatus.RUNNING)
        await self._emit("concatenate", "running", "Concatenating final video...", 0.80)

        final_video = await self._step_concatenate(paragraphs, audio_config)

        self.task_manager.update_state(final_video_file=final_video)
        self.task_manager.update_step("step_concatenation", StepStatus.COMPLETED)
        await self._emit("concatenate", "completed", "Video concatenation completed", 0.95)
        return final_video

    # ------------------------------------------------------------------
    # Step implementations
    # ------------------------------------------------------------------

    def _step_split_text(self, text: str) -> List[ManuscriptParagraph]:
        """Splits long text into paragraph list by reading duration.

        Splitting strategy:
            1. First split into raw blocks by newline character (``\n``).
            2. Split each block further by Chinese sentence-ending punctuation (``。！？``) into candidate sentences.
            3. Perform greedy merging on candidate sentences: accumulated duration <= 12s, minimum >= 5s.
            4. Short sentences (< 5s) are merged into the previous paragraph; long sentences (> 12s) are kept as-is (not split).

        Args:
            text: Original manuscript text input by user.

        Returns:
            List of paragraphs with ``index``, ``text`` and estimated duration.
        """
        assert self._state is not None
        # Resume: if paragraphs already populated, return them directly.
        if self._state.paragraphs:
            logger.info(
                "[Manuscript] split_text: %d paragraphs already exist, resuming",
                len(self._state.paragraphs),
            )
            return self._state.paragraphs

        logger.info("[Manuscript] split_text: splitting %d chars...", len(text))

        # Step 1: split by newline.
        raw_blocks = [b.strip() for b in text.split("\n") if b.strip()]

        # Step 2: further split each block by Chinese sentence-ending punctuation.
        candidate_sentences: List[str] = []
        for block in raw_blocks:
            parts = _SENTENCE_END_RE.split(block)
            for part in parts:
                part = part.strip()
                if part:
                    candidate_sentences.append(part)

        if not candidate_sentences:
            logger.warning("[Manuscript] split_text: no sentences found in text")
            return []

        # Step 3: greedy merge.
        merged: List[str] = []
        current_text = ""
        current_duration = 0.0

        for sentence in candidate_sentences:
            sentence_duration = len(sentence) / _CHARS_PER_SEC

            if not current_text:
                # Starting a new group.
                current_text = sentence
                current_duration = sentence_duration
                continue

            prospective_duration = current_duration + sentence_duration

            if prospective_duration <= _MAX_SEGMENT_DURATION:
                # Merge into current group.
                current_text += sentence
                current_duration = prospective_duration
            else:
                # Flush current group.
                merged.append(current_text)
                current_text = sentence
                current_duration = sentence_duration

        # Flush remaining.
        if current_text:
            merged.append(current_text)

        # Step 4: post-process -- merge short trailing segments into previous.
        final_texts: List[str] = []
        for segment in merged:
            seg_duration = len(segment) / _CHARS_PER_SEC
            if seg_duration < _MIN_SEGMENT_DURATION and final_texts:
                # Merge into previous paragraph.
                final_texts[-1] += segment
            else:
                # Long sentences (> 12s) are accepted as-is (don't split).
                final_texts.append(segment)

        # Build ManuscriptParagraph list.
        paragraphs: List[ManuscriptParagraph] = []
        for idx, para_text in enumerate(final_texts):
            est_duration = len(para_text) / _CHARS_PER_SEC
            para = ManuscriptParagraph(
                index=idx,
                text=para_text,
            )
            paragraphs.append(para)
            logger.info(
                "[Manuscript] Paragraph %d: %d chars, ~%.1fs",
                idx, len(para_text), est_duration,
            )

        logger.info(
            "[Manuscript] split_text: %d paragraphs created", len(paragraphs),
        )
        return paragraphs

    async def _step_generate_scene_prompts(
        self, paragraphs: List[ManuscriptParagraph],
    ) -> None:
        """Generates English video scene description prompt for each paragraph.

        Calls ``Screenwriter.generate_scene_prompt_for_paragraph(text, style)``
        to convert Chinese paragraph text into English prompt suitable for AI video generation.

        Args:
            paragraphs: List of paragraphs (modifies ``scene_prompt`` field in-place).
        """
        total = len(paragraphs)
        for i, para in enumerate(paragraphs):
            self._check_shutdown()

            # Resume: skip paragraphs that already have a scene_prompt.
            if para.scene_prompt:
                logger.info(
                    "[Manuscript] scene_prompt: paragraph %d already has prompt, skipping",
                    para.index,
                )
                continue

            logger.info(
                "[Manuscript] scene_prompt: generating for paragraph %d/%d...",
                i + 1, total,
            )
            await self._emit(
                "scene_prompts", "running",
                f"Generating scene description {i + 1}/{total}",
                0.05 + 0.10 * (i / max(total, 1)),
            )

            prompt = await asyncio.to_thread(
                self.screenwriter.generate_scene_prompt_for_paragraph,
                para.text,
                "",  # style -- ManuscriptVideoTask has no style field; pass empty.
            )
            para.scene_prompt = prompt.strip()

            # Persist after each paragraph for crash recovery.
            self.task_manager.update_state(paragraphs=paragraphs)
            logger.info(
                "[Manuscript] scene_prompt %d: %s...",
                para.index, para.scene_prompt[:80],
            )

    # ------------------------------------------------------------------
    # Curl / task persistence helpers (per-paragraph)
    # ------------------------------------------------------------------

    @staticmethod
    def _make_curl(video_id: str) -> str:
        return (
            f'curl -s -H "Authorization: Bearer $AGNES_API_KEY" '
            f'"https://apihub.agnes-ai.com/agnesapi?video_id={video_id}"'
        )

    def _save_para_task(self, para_dir: str, video_id: str) -> None:
        os.makedirs(para_dir, exist_ok=True)
        task_file = os.path.join(para_dir, "task.json")
        with open(task_file, "w") as f:
            json.dump({"video_id": video_id}, f, indent=2)
        curl_file = os.path.join(para_dir, "curl.sh")
        with open(curl_file, "w") as f:
            f.write(self._make_curl(video_id) + "\n")

    def _load_para_task(self, para_dir: str) -> Optional[str]:
        task_file = os.path.join(para_dir, "task.json")
        if os.path.exists(task_file):
            try:
                with open(task_file, "r") as f:
                    data = json.load(f)
                return data.get("video_id") or data.get("task_id")
            except Exception:
                pass
        return None

    async def _step_generate_videos(
        self, paragraphs: List[ManuscriptParagraph],
    ) -> None:
        """Calls Agnes Video API to generate video for each paragraph (two-stage parallel).

        Phase 1: Batch submit all video requests (parallel generation on the server).
        Phase 2: Poll one by one, wait for completion, and download.

        Each video is saved to ``{working_dir}/para_{index}/video.mp4``,
        and the video_id and curl command are recorded to ``task.json`` / ``curl.sh``.

        Args:
            paragraphs: List of paragraphs (modifies ``video_file``, ``video_id`` fields in-place).
        """
        assert self._state is not None
        _SUBMIT_RETRIES = 3
        _WAIT_RETRIES = 3
        total = len(paragraphs)

        # ── Phase 1: Batch Submit ────────────────────────────────────────────
        pending: list[tuple[int, str, str]] = []  # (para_index, video_id, video_path)

        for i, para in enumerate(paragraphs):
            self._check_shutdown()

            para_dir = os.path.join(self.working_dir, f"para_{para.index}")
            video_path = os.path.join(para_dir, "video.mp4")

            # Existing video file → skip
            if os.path.exists(video_path):
                para.video_file = video_path
                logger.info(
                    "[Manuscript] video: paragraph %d already exists, skipping",
                    para.index,
                )
                continue

            if not para.scene_prompt:
                logger.warning(
                    "[Manuscript] video: paragraph %d has no scene_prompt, skipping",
                    para.index,
                )
                continue

            os.makedirs(para_dir, exist_ok=True)

            # Resume: reuse submitted video_id
            saved_video_id = self._load_para_task(para_dir)
            if saved_video_id:
                para.video_id = saved_video_id
                logger.info(
                    "[Manuscript] video: paragraph %d resuming video_id %s...",
                    para.index, saved_video_id[:16],
                )
                pending.append((para.index, saved_video_id, video_path))
                continue

            # Submit new video
            logger.info(
                "[Manuscript] video: submitting paragraph %d/%d...",
                i + 1, total,
            )
            await self._emit(
                "video_gen", "running",
                f"Submitting video {i + 1}/{total}",
                0.15 + 0.20 * (i / max(total, 1)),
            )

            para_duration = max(math.ceil(len(para.text) / _CHARS_PER_SEC), 3)
            logger.info(
                "[Manuscript] video: paragraph %d estimated duration %.1fs (chars=%d)",
                para.index, para_duration, len(para.text),
            )

            for retry in range(_SUBMIT_RETRIES):
                try:
                    video_id = await self.video_api.submit_video(
                        prompt=para.scene_prompt,
                        duration=para_duration,
                        width=self._state.video_width,
                        height=self._state.video_height,
                    )
                    para.video_id = video_id
                    self._save_para_task(para_dir, video_id)
                    pending.append((para.index, video_id, video_path))
                    break
                except Exception as e:
                    if retry < _SUBMIT_RETRIES - 1:
                        delay = 15 * (retry + 1)
                        logger.warning(
                            "[Manuscript] video: paragraph %d submit failed "
                            "(%s), retry %d/%d in %ds...",
                            para.index, e, retry + 1, _SUBMIT_RETRIES, delay,
                        )
                        await asyncio.sleep(delay)
                    else:
                        raise

        # Persist after submission (resume can recover video_id)
        self.task_manager.update_state(paragraphs=paragraphs)
        logger.info(
            "[Manuscript] video: all %d paragraphs submitted, now waiting...",
            len(pending),
        )

        # ── Phase 2: Poll one by one ────────────────────────────────────────
        for j, (para_idx, video_id, video_path) in enumerate(pending):
            self._check_shutdown()

            para = paragraphs[para_idx]
            await self._emit(
                "video_gen", "running",
                f"Waiting for video {j + 1}/{len(pending)} ({video_id[:16]}...)",
                0.35 + 0.25 * (j / max(len(pending), 1)),
            )

            for retry in range(_WAIT_RETRIES):
                try:
                    video_output = await self.video_api.wait_for_video(video_id)
                    video_output.save(video_path)
                    break
                except Exception as e:
                    if retry < _WAIT_RETRIES - 1:
                        delay = 20 * (retry + 1)
                        logger.warning(
                            "[Manuscript] video: paragraph %d wait failed "
                            "(%s), retry %d/%d in %ds...",
                            para_idx, e, retry + 1, _WAIT_RETRIES, delay,
                        )
                        await asyncio.sleep(delay)
                    else:
                        raise

            para.video_file = video_path
            self.task_manager.update_state(paragraphs=paragraphs)
            logger.info(
                "[Manuscript] video: paragraph %d saved → %s (video_id=%s)",
                para_idx, video_path, video_id[:16],
            )

    async def _step_audio_subtitle(
        self,
        paragraphs: List[ManuscriptParagraph],
        audio_config: AudioConfig,
    ) -> None:
        """Generates **entire continuous TTS audio + entire SRT subtitles**.

        Concatenates all paragraph text into a single manuscript → single edge_tts call →
        one continuous audio + one ``SubMaker`` (containing word-level timestamps) → one SRT.

        Subsequent concatenation step (:meth:`_step_concatenate`) only needs to overlay the final concatenated video
        with this audio + subtitles once, avoiding padding accumulation from segment-by-segment synthesis,
        and ensuring subtitle timeline matches audio perfectly.

        Args:
            paragraphs: List of paragraphs (used to concatenate full text).
            audio_config: Audio and subtitle configuration.
        """
        assert self._state is not None
        full_text = "\n\n".join(p.text for p in paragraphs if p.text)
        if not full_text:
            logger.warning("[Manuscript] audio_subtitle: empty full text, skipping")
            return

        audio_path = os.path.join(self.working_dir, "full_narration.mp3")
        srt_path = os.path.join(self.working_dir, "full_subtitle.srt")

        # Resume: skip if combined files already exist
        if os.path.exists(audio_path) and os.path.exists(srt_path):
            self._state.combined_audio = audio_path
            self._state.combined_subtitle = srt_path
            logger.info("[Manuscript] audio_subtitle: combined files already exist, skipping")
            return

        edge_tts = EdgeTTSEngine()
        silent_tts = SilentTTSEngine()

        await self._emit(
            "audio_subtitle", "running",
            f"Generating narration + subtitles ({len(full_text)} chars)...",
            0.60,
        )

        if audio_config.enabled:
            audio_result, sub_maker = await edge_tts.generate(
                text=full_text,
                output_path=audio_path,
                voice=audio_config.voice,
                rate=audio_config.rate,
            )
        else:
            audio_result, sub_maker = await silent_tts.generate(
                text=full_text,
                output_path=audio_path,
            )

        SubtitleGenerator.cues_to_srt(sub_maker, srt_path)

        self._state.combined_audio = audio_result
        self._state.combined_subtitle = srt_path
        self.task_manager.update_state(
            combined_audio=audio_result,
            combined_subtitle=srt_path,
        )
        logger.info(
            "[Manuscript] audio_subtitle: combined → %s + %s",
            audio_path, srt_path,
        )

    async def _step_concatenate(
        self,
        paragraphs: List[ManuscriptParagraph],
        audio_config: AudioConfig,
    ) -> str:
        """Concatenates all paragraph videos first, then overlays the entire audio + entire subtitles.

        No longer synthesizes segment-by-segment via ``_synthesize_single`` (to avoid padding accumulation),
        but references the MoneyPrinterTurbo approach:
        1. Concatenate all videos by paragraph order into a single complete timeline.
        2. Attach the entire ``combined_audio`` (full TTS).
        3. Overlay the entire ``combined_subtitle`` (full SRT, aligned with audio timeline).

        Args:
            paragraphs: Paragraph list with completed video generation.
            audio_config: Audio and subtitle style configuration.

        Returns:
            File path of the final output video.
        """
        assert self._state is not None
        output_path = os.path.join(self.working_dir, "final_video.mp4")

        if os.path.exists(output_path):
            logger.info("[Manuscript] concatenate: final video already exists, skipping")
            return output_path

        video_paths = [
            p.video_file for p in paragraphs
            if p.video_file and os.path.exists(p.video_file)
        ]
        if not video_paths:
            raise RuntimeError("[Manuscript] concatenate: no valid videos to concatenate")

        logger.info(
            "[Manuscript] concatenate: %d videos + combined audio + subtitles → %s",
            len(video_paths), output_path,
        )
        await self._emit("concatenate", "running", f"Concatenating {len(video_paths)} video segments + audio + subtitles...", 0.80)

        VideoConcatenator.concat_videos_with_audio_overlay(
            video_paths=video_paths,
            audio_path=self._state.combined_audio or "",
            srt_path=self._state.combined_subtitle or None,
            output_path=output_path,
            subtitle_style=audio_config.subtitle_style,
        )

        logger.info("[Manuscript] concatenate: final video → %s", output_path)
        return output_path

    # ------------------------------------------------------------------
    # Utilities
    # ------------------------------------------------------------------

    def _check_shutdown(self) -> None:
        """Checks if pipeline needs to stop.

        Raises:
            PipelineShutdown: If stop signal is received.
        """
        if self._is_shutdown():
            raise PipelineShutdown("Pipeline shutdown requested")

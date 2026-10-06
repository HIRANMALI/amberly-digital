"""core.compositor.concatenator — Video concatenator

Supports pure video concatenation and concatenation with audio overlay and subtitles.
"""

import logging
import os
import shutil
from typing import List, Optional, Tuple

import srt as srt_lib
from moviepy import AudioFileClip, CompositeVideoClip, VideoFileClip, concatenate_videoclips

from models.task import SubtitleStyle

logger = logging.getLogger(__name__)

# ── Video output constants (aligned with MoneyPrinterTurbo to ensure player compatibility) ──
_AUDIO_CODEC = "aac"
_AUDIO_BITRATE = "192k"
_AUDIO_FPS = 44100
_VIDEO_FPS = 30


class VideoConcatenator:
    """Video concatenator: pure concatenation + audio synthesis concatenation."""

    @staticmethod
    def concat_videos(video_paths: List[str], output_path: str) -> str:
        """Pure video concatenation (no audio processing).

        Args:
            video_paths: List of video file paths
            output_path: Output file path

        Returns:
            Output file path
        """
        logger.info(f"[Compositor] Concatenating {len(video_paths)} videos → {output_path}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        if not video_paths:
            raise RuntimeError("No videos to concatenate")

        if len(video_paths) == 1:
            shutil.copy2(video_paths[0], output_path)
            logger.info("[Compositor] Single video, copied directly")
            return output_path

        clips = [VideoFileClip(p) for p in video_paths]
        try:
            final = concatenate_videoclips(clips, method="compose")
            final.write_videofile(
                output_path,
                codec="libx264",
                audio_codec=_AUDIO_CODEC,
                audio_bitrate=_AUDIO_BITRATE,
                audio_fps=_AUDIO_FPS,
                fps=_VIDEO_FPS,
                logger="bar",
            )
        finally:
            for c in clips:
                c.close()

        logger.info(f"[Compositor] Concatenation complete: {output_path}")
        return output_path

    @staticmethod
    def concat_with_audio(
        clip_tuples: List[Tuple[str, str, Optional[str]]],
        output_path: str,
        subtitle_style: Optional[SubtitleStyle] = None,
    ) -> str:
        """Video concatenation with audio synthesis.

        Each segment of video is first synthesized with audio + subtitles, then combined together.

        Args:
            clip_tuples: [(video_path, audio_path, srt_path_or_None), ...]
            output_path: Final output file path
            subtitle_style: Subtitle style configuration

        Returns:
            Output file path
        """
        logger.info(f"[Compositor] concat_with_audio: {len(clip_tuples)} segments → {output_path}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        if not clip_tuples:
            raise RuntimeError("No clips to concatenate")

        synthesized_paths = []

        for i, (video_path, audio_path, srt_path) in enumerate(clip_tuples):
            segment_output = video_path.replace(".mp4", "_synth.mp4")
            if os.path.exists(segment_output):
                synthesized_paths.append(segment_output)
                continue

            synthesized = VideoConcatenator._synthesize_single(
                video_path, audio_path, srt_path, segment_output, subtitle_style
            )
            synthesized_paths.append(synthesized)

        # Concatenate all synthesized segments
        if len(synthesized_paths) == 1:
            shutil.copy2(synthesized_paths[0], output_path)
        else:
            VideoConcatenator.concat_videos(synthesized_paths, output_path)

        logger.info(f"[Compositor] concat_with_audio complete: {output_path}")
        return output_path

    @staticmethod
    def _resolve_subtitle_position(pos, default=("center", "bottom")) -> tuple:
        """Normalizes subtitle position configuration into a (horizontal, vertical) tuple."""
        if isinstance(pos, (list, tuple)) and len(pos) == 2:
            h, v = pos[0], pos[1]
            if isinstance(v, str):
                v_lower = v.strip().lower()
                if "top" in v_lower:
                    return (h, "top")
                if "bottom" in v_lower:
                    return (h, "bottom")
            return (h, v)
        if isinstance(pos, str):
            pos_lower = pos.strip().lower()
            position_map = {
                "bottom": ("center", "bottom"),
                "top": ("center", "top"),
                "center": ("center", "center"),
                "middle": ("center", "center"),
            }
            return position_map.get(pos_lower, default)
        return default

    @staticmethod
    def _parse_srt_to_clips(
        srt_path: str,
        subtitle_style: SubtitleStyle,
        video_width: int,
    ) -> list:
        """Parses SRT line-by-line, returning a list of TextClips (supporting automatic multi-line wrapping)."""
        from moviepy import TextClip as MpTextClip
        from core.config import resolve_font_path
        from core.audio.subtitle import SubtitleGenerator

        font_path = resolve_font_path(subtitle_style.font)

        # Compatible with old format bg_color strings
        bg = subtitle_style.bg_color
        if isinstance(bg, str):
            if "@" in bg:
                parts = bg.split("@", 1)
                rgb = {"black": (0, 0, 0), "white": (255, 255, 255)}.get(parts[0].strip().lower(), (0, 0, 0))
                bg = (*rgb, int(float(parts[1]) * 255))
            else:
                bg = (0, 0, 0, 128)

        # Dynamically calculate max characters per line based on video width (consistent with subtitle.py)
        available_w = video_width - 40
        cjk_max_chars = max(8, available_w // subtitle_style.fontsize)

        subs_clips = []
        with open(srt_path, "r", encoding="utf-8") as f:
            for sub in srt_lib.parse(f):
                txt = sub.content
                start_s = sub.start.total_seconds()
                end_s = sub.end.total_seconds()
                dur = end_s - start_s

                # Long text is automatically split into multiple lines to avoid screen overflow
                wrapped = SubtitleGenerator._split_long_text(txt, cjk_max_chars)

                clip = MpTextClip(
                    text=wrapped,
                    font=font_path,
                    font_size=subtitle_style.fontsize,
                    color=subtitle_style.color,
                    stroke_color=subtitle_style.stroke_color,
                    stroke_width=subtitle_style.stroke_width,
                    bg_color=bg,
                    method="caption",
                    size=(available_w, None),
                    text_align="center",
                )
                clip = (
                    clip.with_start(start_s)
                    .with_end(end_s)
                    .with_duration(dur)
                )
                clip = clip.with_position(
                    VideoConcatenator._resolve_subtitle_position(subtitle_style.position)
                )
                subs_clips.append(clip)
        return subs_clips

    @staticmethod
    def concat_videos_with_audio_overlay(
        video_paths: List[str],
        audio_path: str,
        srt_path: Optional[str],
        output_path: str,
        subtitle_style: Optional[SubtitleStyle] = None,
    ) -> str:
        """Concatenates videos first, then overlays a single audio track + single subtitle track.

        MoneyPrinterTurbo strategy: does not synthesize segment-by-segment (to avoid padding accumulation),
        but first concatenates all videos into a complete timeline, then overlays audio and subtitles as a whole.

        Args:
            video_paths: List of video paths in order.
            audio_path: Entire audio file path (corresponding to the total timeline of all videos).
            srt_path: Entire SRT subtitle path (optional).
            output_path: Final output file path.
            subtitle_style: Subtitle style configuration.

        Returns:
            Output file path.
        """
        logger.info(
            f"[Compositor] concat_videos_with_audio_overlay: "
            f"{len(video_paths)} videos + {audio_path} → {output_path}"
        )
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        if not video_paths:
            raise RuntimeError("No videos to concatenate")

        naked_path = output_path.replace(".mp4", "_naked.mp4")
        freeze_path = output_path.replace(".mp4", "_freeze.mp4")
        video_clip = None
        audio_clip = None

        try:
            # ── Step 1: Concatenate all videos ────────────────────────────
            VideoConcatenator.concat_videos(video_paths, naked_path)

            # ── Step 2: Load concatenated video + audio ────────────────────
            video_clip = VideoFileClip(naked_path)
            audio_clip = AudioFileClip(audio_path)

            # ── Step 2.5: Boost audio volume (TTS default volume is low) ──
            _AUDIO_VOLUME_FACTOR = 2.5
            audio_clip = audio_clip.with_volume_scaled(_AUDIO_VOLUME_FACTOR)

            # ── Step 3: If audio is longer than video, freeze last frame to pad ──
            v_dur = video_clip.duration if video_clip.duration is not None else 0.0
            a_dur = audio_clip.duration if audio_clip.duration is not None else 0.0
            if v_dur < a_dur:
                freeze_duration = a_dur - v_dur
                from core.compositor.processor import VideoProcessor
                VideoProcessor.freeze_last_frame(naked_path, freeze_duration, freeze_path)
                video_clip.close()
                video_clip = VideoFileClip(freeze_path)

            # ── Step 4: Overlay audio ─────────────────────────────────────
            video_with_audio = video_clip.with_audio(audio_clip)

            # ── Step 5: Overlay subtitles ─────────────────────────────────
            if srt_path and os.path.exists(srt_path) and subtitle_style:
                try:
                    subs_clips = VideoConcatenator._parse_srt_to_clips(
                        srt_path, subtitle_style, video_clip.w,
                    )
                    if subs_clips:
                        final = CompositeVideoClip([video_with_audio, *subs_clips])
                        final.write_videofile(
                            output_path,
                            codec="libx264",
                            audio_codec=_AUDIO_CODEC,
                            audio_bitrate=_AUDIO_BITRATE,
                            audio_fps=_AUDIO_FPS,
                            fps=_VIDEO_FPS,
                            logger="bar",
                        )
                        final.close()
                    else:
                        video_with_audio.write_videofile(
                            output_path,
                            codec="libx264",
                            audio_codec=_AUDIO_CODEC,
                            audio_bitrate=_AUDIO_BITRATE,
                            audio_fps=_AUDIO_FPS,
                            fps=_VIDEO_FPS,
                            logger="bar",
                        )
                except Exception as e:
                    logger.warning(
                        f"[Compositor] Subtitle overlay failed: {e}, writing without subtitles"
                    )
                    video_with_audio.write_videofile(
                        output_path,
                        codec="libx264",
                        audio_codec=_AUDIO_CODEC,
                        audio_bitrate=_AUDIO_BITRATE,
                        audio_fps=_AUDIO_FPS,
                        fps=_VIDEO_FPS,
                        logger="bar",
                    )
            else:
                video_with_audio.write_videofile(
                    output_path,
                    codec="libx264",
                    audio_codec=_AUDIO_CODEC,
                    audio_bitrate=_AUDIO_BITRATE,
                    audio_fps=_AUDIO_FPS,
                    fps=_VIDEO_FPS,
                    logger="bar",
                )
        finally:
            if video_clip is not None:
                video_clip.close()
            if audio_clip is not None:
                audio_clip.close()
            for tmp in (naked_path, freeze_path):
                if os.path.exists(tmp):
                    try:
                        os.remove(tmp)
                    except OSError:
                        pass

        logger.info(f"[Compositor] concat_videos_with_audio_overlay done: {output_path}")
        return output_path

    @staticmethod
    def _synthesize_single(
        video_path: str,
        audio_path: str,
        srt_path: Optional[str],
        output_path: str,
        subtitle_style: Optional[SubtitleStyle] = None,
    ) -> str:
        """Synthesizes a single segment of video + audio + subtitles.

        Args:
            video_path: Video file path
            audio_path: Audio file path
            srt_path: SRT subtitle path (optional)
            output_path: Output path
            subtitle_style: Subtitle style configuration

        Returns:
            Output path
        """
        logger.info(f"[Compositor] Synthesizing: {video_path} + {audio_path}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        video_clip = None
        audio_clip = None
        freeze_path = output_path.replace(".mp4", "_freeze.mp4")

        try:
            video_clip = VideoFileClip(video_path)
            audio_clip = AudioFileClip(audio_path)

            # Boost audio volume (TTS default volume is low)
            _AUDIO_VOLUME_FACTOR = 2.5
            audio_clip = audio_clip.with_volume_scaled(_AUDIO_VOLUME_FACTOR)

            # If audio is longer than video, freeze the last frame to pad
            v_dur = video_clip.duration if video_clip.duration is not None else 0.0
            a_dur = audio_clip.duration if audio_clip.duration is not None else 0.0
            if v_dur < a_dur:
                freeze_duration = a_dur - v_dur
                from core.compositor.processor import VideoProcessor
                VideoProcessor.freeze_last_frame(video_path, freeze_duration, freeze_path)
                video_clip.close()
                video_clip = VideoFileClip(freeze_path)

            # Synthesize audio
            video_with_audio = video_clip.with_audio(audio_clip)

            # Overlay subtitles
            if srt_path and os.path.exists(srt_path) and subtitle_style:
                try:
                    subs_clips = VideoConcatenator._parse_srt_to_clips(
                        srt_path, subtitle_style, video_clip.w,
                    )
                    if subs_clips:
                        final = CompositeVideoClip([video_with_audio, *subs_clips])
                        final.write_videofile(
                            output_path,
                            codec="libx264",
                            audio_codec=_AUDIO_CODEC,
                            audio_bitrate=_AUDIO_BITRATE,
                            audio_fps=_AUDIO_FPS,
                            fps=_VIDEO_FPS,
                            logger="bar",
                        )
                        final.close()
                    else:
                        video_with_audio.write_videofile(
                            output_path,
                            codec="libx264",
                            audio_codec=_AUDIO_CODEC,
                            audio_bitrate=_AUDIO_BITRATE,
                            audio_fps=_AUDIO_FPS,
                            fps=_VIDEO_FPS,
                            logger="bar",
                        )
                except Exception as e:
                    logger.warning(
                        f"[Compositor] Subtitle overlay failed: {e}, writing without subtitles"
                    )
                    video_with_audio.write_videofile(
                        output_path,
                        codec="libx264",
                        audio_codec=_AUDIO_CODEC,
                        audio_bitrate=_AUDIO_BITRATE,
                        audio_fps=_AUDIO_FPS,
                        fps=_VIDEO_FPS,
                        logger="bar",
                    )
            else:
                video_with_audio.write_videofile(
                    output_path,
                    codec="libx264",
                    audio_codec=_AUDIO_CODEC,
                    audio_bitrate=_AUDIO_BITRATE,
                    audio_fps=_AUDIO_FPS,
                    fps=_VIDEO_FPS,
                    logger="bar",
                )
        finally:
            if video_clip is not None:
                video_clip.close()
            if audio_clip is not None:
                audio_clip.close()
            if os.path.exists(freeze_path):
                try:
                    os.remove(freeze_path)
                except OSError:
                    pass

        logger.info(f"[Compositor] Segment synthesized: {output_path}")
        return output_path

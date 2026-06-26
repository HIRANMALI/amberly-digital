"""core.audio.subtitle — SRT subtitle generation + moviepy overlay

Converts edge_tts SubMaker cues to SRT format, and overlays them onto video using moviepy SubtitlesClip.

v2.1: Supports fine-grained subtitle splitting to avoid single subtitles for 5-second videos.
"""

import datetime
import logging
import os
from typing import List, Optional, Tuple

import srt
from moviepy import VideoFileClip, CompositeVideoClip
from moviepy.video.tools.subtitles import SubtitlesClip

from models.task import SubtitleStyle

logger = logging.getLogger(__name__)

# ── Fine-grained subtitle splitting parameters ──
# Maximum duration for each subtitle (seconds)
_MAX_SUB_DURATION = 2.5
# Maximum characters for each subtitle (CJK scene)
_MAX_SUB_CHARS = 18
# Minimum word cues threshold: if there are too few word cues (e.g., only 3 cues for 14s),
# it means edge_tts itself provides enough granularity and no extra division is needed (avoids empty subtitles)
_MIN_WORD_CUES_FOR_FINE = 6


class SubtitleGenerator:
    """Subtitle generator: cues → SRT + moviepy overlay."""

    @staticmethod
    def _split_long_text(txt: str, max_chars_per_line: int = 14) -> str:
        """Splits long subtitle text into multiple lines to avoid single-line screen overflow.

        Splits CJK text by character count, and non-CJK text by word boundary.
        Splits up to 2 lines, trying to distribute them equally.

        Args:
            txt: Original subtitle text
            max_chars_per_line: Max characters per line (CJK) or words per line (non-CJK)

        Returns:
            Text possibly containing \n
        """
        if not txt or "\n" in txt:
            return txt

        has_cjk = any('\u4e00' <= ch <= '\u9fff' or '\u3400' <= ch <= '\u4dbf' for ch in txt)

        if has_cjk:
            if len(txt) <= max_chars_per_line:
                return txt
            # Split into 2 lines, try to balance length
            mid = len(txt) // 2
            # Look for punctuation or natural break points near the middle
            for offset in range(min(4, mid)):
                for candidate in (mid + offset, mid - offset):
                    if 0 < candidate < len(txt) and txt[candidate - 1] in '，。、；！？,. ;!?':
                        return txt[:candidate] + "\n" + txt[candidate:]
            return txt[:mid] + "\n" + txt[mid:]
        else:
            words = txt.split()
            if len(words) <= max_chars_per_line:
                return txt
            mid = len(words) // 2
            return " ".join(words[:mid]) + "\n" + " ".join(words[mid:])

    @staticmethod
    def cue_to_srt_time(seconds: float) -> str:
        """Converts seconds to SRT time format HH:MM:SS,mmm."""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds % 1) * 1000)
        return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"

    @staticmethod
    def _cue_total_seconds(td) -> float:
        """Converts timedelta to seconds (compatible with srt.Subtitle start/end fields)."""
        if isinstance(td, datetime.timedelta):
            return td.total_seconds()
        return float(td)

    @staticmethod
    def _generate_fine_srt_from_word_cues(
        word_cues: list,
        max_duration: float = _MAX_SUB_DURATION,
        max_chars: int = _MAX_SUB_CHARS,
    ) -> str:
        """Generates fine-grained SRT from word-by-word cues.

        Groups edge_tts SubMaker.cues (word-level timestamp list) into short subtitle segments,
        ensuring each group does not exceed max_duration seconds and max_chars characters,
        preferring breaks at longer pauses.

        Args:
            word_cues: List of edge_tts SubMaker.cues (srt.Subtitle objects)
            max_duration: Max duration of each subtitle (seconds)
            max_chars: Max characters of each subtitle

        Returns:
            SRT formatted string
        """
        if not word_cues:
            return ""

        # Convert cues to (start_s, end_s, text) tuples
        items = []
        for cue in word_cues:
            start_s = SubtitleGenerator._cue_total_seconds(cue.start)
            end_s = SubtitleGenerator._cue_total_seconds(cue.end)
            text = cue.content.strip()
            if text:
                items.append((start_s, end_s, text))

        if not items:
            return ""

        # Calculate pause between words (gap) to decide where to break subtitle groups
        gaps = []
        for i in range(1, len(items)):
            gap = items[i][0] - items[i - 1][1]
            gaps.append(max(gap, 0.0))

        # Greedy grouping: constrained by max_duration and max_chars
        groups = []
        group_start_s = items[0][0]
        group_end_s = items[0][1]
        group_text_parts = [items[0][2]]
        group_chars = len(items[0][2])

        for i in range(1, len(items)):
            s_s, e_s, txt = items[i]
            gap = gaps[i - 1]

            prospective_dur = e_s - group_start_s
            prospective_chars = group_chars + len(txt)

            # Decide whether to break: break if any condition is met
            # 1. Duration limit exceeded
            # 2. Character limit exceeded
            # 3. Large pause between previous words (>0.4s) and current group has accumulated some content
            should_break = (
                prospective_dur > max_duration
                or prospective_chars > max_chars
                or (gap > 0.4 and group_chars > 4 and len(items) > 8)
            )

            if should_break and group_text_parts:
                groups.append((group_start_s, group_end_s, "".join(group_text_parts)))
                group_start_s = s_s
                group_end_s = e_s
                group_text_parts = [txt]
                group_chars = len(txt)
            else:
                group_end_s = e_s
                group_text_parts.append(txt)
                group_chars += len(txt)

        # Remaining group
        if group_text_parts:
            groups.append((group_start_s, group_end_s, "".join(group_text_parts)))

        # Post-processing: merge tail group if it's too short
        # Merge only if it doesn't make the previous group too long
        while len(groups) >= 2:
            last_dur = groups[-1][1] - groups[-1][0]
            last_chars = len(groups[-1][2])
            prev_dur = groups[-2][1] - groups[-2][0]
            prev_chars = len(groups[-2][2])
            merged_dur = groups[-1][1] - groups[-2][0]
            merged_chars = prev_chars + last_chars
            # Condition: tail too short and merged result doesn't exceed limit
            if (last_dur < 0.8
                    and merged_dur <= max_duration * 1.2
                    and merged_chars <= max_chars * 1.5):
                merged_start = groups[-2][0]
                merged_end = groups[-1][1]
                merged_text = groups[-2][2] + groups[-1][2]
                groups[-2] = (merged_start, merged_end, merged_text)
                groups.pop()
            else:
                break

        # Generate SRT
        entries = []
        for idx, (s_s, e_s, txt) in enumerate(groups, 1):
            # Ensure each group is at least 0.3s
            if e_s - s_s < 0.3:
                e_s = s_s + 0.3
            # Ensure subtitles do not overlap (end doesn't exceed next start)
            if idx < len(groups):
                next_start = groups[idx][0]
                if e_s > next_start:
                    e_s = next_start - 0.05

            start_time = SubtitleGenerator.cue_to_srt_time(s_s)
            end_time = SubtitleGenerator.cue_to_srt_time(e_s)
            entries.append(f"{idx}\n{start_time} --> {end_time}\n{txt}\n")

        return "\n".join(entries)

    @staticmethod
    def cues_to_srt(cues, output_path: str) -> str:
        """Converts edge_tts SubMaker cues into an SRT file.

        Prioritizes word-level cues (edge_tts 7.x SubMaker.cues) for fine-grained splitting,
        ensuring at least one subtitle every 2-3 seconds to avoid having only 1 subtitle for a 5-second video.

        For edge_tts 6.x, falls back to WebVTT parsing.

        Args:
            cues: edge_tts SubMaker instance or empty dict
            output_path: SRT file output path

        Returns:
            SRT file path
        """
        logger.info(f"[Subtitle] Converting cues to SRT: {output_path}")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        srt_content = ""
        subtitles_count = 0
        used_fine_grained = False

        # ── Strategy 1: Use word-level cues for fine-grained SRT (Recommended) ──
        # edge_tts 7.x SubMaker.cues contains WordBoundary word-level timestamps
        raw_word_cues = getattr(cues, "cues", None)
        if raw_word_cues and isinstance(raw_word_cues, list) and len(raw_word_cues) >= _MIN_WORD_CUES_FOR_FINE:
            try:
                srt_content = SubtitleGenerator._generate_fine_srt_from_word_cues(raw_word_cues)
                if srt_content.strip():
                    subtitles_count = srt_content.count("\n\n") + 1 if "\n\n" in srt_content else (
                        1 if srt_content.strip() else 0
                    )
                    used_fine_grained = True
                    logger.info(f"[Subtitle] Fine-grained SRT generated from {len(raw_word_cues)} word cues")
            except Exception as e:
                logger.warning(f"[Subtitle] Fine-grained SRT generation failed: {e}, falling back")

        # ── Strategy 2: Fall back to default edge_tts SRT generation ──
        if not srt_content.strip():
            try:
                if hasattr(cues, "get_srt"):
                    srt_content = cues.get_srt()
                    subtitles_count = srt_content.count("\n\n") + 1 if srt_content.strip() else 0
                elif hasattr(cues, "generate_subs"):
                    vtt_content = cues.generate_subs()
                    subtitles = SubtitleGenerator._parse_vtt_to_srt(vtt_content)
                    srt_content = srt.compose(subtitles)
                    subtitles_count = len(subtitles)
                else:
                    subtitles_count = 0
            except Exception as e:
                # edge_tts 7.x + some srt library versions have incompatible Subtitle object structures
                # (proprietary field conflict), fall back to manual SRT construction from raw_cues
                logger.warning(f"[Subtitle] Default SRT generation failed: {e}, "
                               f"falling back to raw cues")
                if raw_word_cues and isinstance(raw_word_cues, list) and len(raw_word_cues) > 0:
                    try:
                        srt_content = SubtitleGenerator._generate_fine_srt_from_word_cues(
                            raw_word_cues,
                            max_duration=10.0,  # relax constraint as this is the last resort
                            max_chars=60,
                        )
                        if srt_content.strip():
                            subtitles_count = srt_content.count("\n\n") + 1 if "\n\n" in srt_content else 1
                            logger.info(f"[Subtitle] Fallback SRT from raw cues: {subtitles_count} entries")
                    except Exception as e2:
                        logger.error(f"[Subtitle] Raw cues fallback also failed: {e2}")
                        subtitles_count = 0
                else:
                    subtitles_count = 0

        with open(output_path, "w", encoding="utf-8") as f:
            f.write(srt_content)

        method_tag = "fine-grained" if used_fine_grained else "default"
        logger.info(f"[Subtitle] SRT saved: {output_path} ({subtitles_count} entries, {method_tag})")
        return output_path

    @staticmethod
    def _parse_vtt_to_srt(vtt_content: str) -> list:
        """Parses WebVTT content into srt.Subtitle list."""
        subtitles = []
        lines = vtt_content.strip().split("\n")
        idx = 0

        # Skip WEBVTT header
        i = 0
        while i < len(lines) and (lines[i].strip().startswith("WEBVTT") or lines[i].strip() == ""):
            i += 1

        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Timeline line: 00:00:00.000 --> 00:00:02.500
            if "-->" in line:
                parts = line.split("-->")
                if len(parts) == 2:
                    start_str = parts[0].strip().replace(".", ",")
                    end_str = parts[1].strip().replace(".", ",")

                    # Collect text lines
                    text_lines = []
                    i += 1
                    while i < len(lines) and lines[i].strip():
                        text_lines.append(lines[i].strip())
                        i += 1

                    text = " ".join(text_lines)
                    if text:
                        idx += 1
                        # Parse time
                        start = SubtitleGenerator._parse_time(start_str)
                        end = SubtitleGenerator._parse_time(end_str)
                        subtitles.append(srt.Subtitle(index=idx, start=start, end=end, content=text))
                    continue
            i += 1

        return subtitles

    @staticmethod
    def _parse_time(time_str: str) -> "datetime.timedelta":
        """Parses SRT/VTT time string into timedelta."""
        import datetime

        time_str = time_str.strip()
        # Supports HH:MM:SS,mmm or HH:MM:SS.mmm or MM:SS.mmm format
        if "," in time_str:
            time_str = time_str.replace(",", ".")
        parts = time_str.split(":")
        if len(parts) == 3:
            h, m, s = parts
            total_seconds = int(h) * 3600 + int(m) * 60 + float(s)
        elif len(parts) == 2:
            m, s = parts
            total_seconds = int(m) * 60 + float(s)
        else:
            total_seconds = float(parts[0])

        return datetime.timedelta(seconds=total_seconds)

    @staticmethod
    def overlay_subtitles_to_video(
        video_path: str,
        srt_path: str,
        style: SubtitleStyle,
        output_path: str,
    ) -> str:
        """Overlays SRT subtitles onto a video file.

        Args:
            video_path: Input video path
            srt_path: SRT subtitle file path
            style: SubtitleStyle subtitle style configuration
            output_path: Output video path

        Returns:
            Output video path
        """
        logger.info(f"[Subtitle] Overlaying subtitles: {video_path} + {srt_path} → {output_path}")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        try:
            video_clip = VideoFileClip(video_path)

            # Resolve font path
            from core.config import resolve_font_path
            font_path = resolve_font_path(style.font)

            # Compatible with old format bg_color strings (e.g. "black@0.5")
            bg = style.bg_color
            if isinstance(bg, str):
                if "@" in bg:
                    parts = bg.split("@", 1)
                    rgb = {"black": (0, 0, 0), "white": (255, 255, 255)}.get(parts[0].strip().lower(), (0, 0, 0))
                    bg = (*rgb, int(float(parts[1]) * 255))
                else:
                    bg = (0, 0, 0, 128)

            # Dynamically calculate maximum characters per line based on video width
            available_w = video_clip.w - 40
            # Rough estimate: CJK character width ≈ fontsize, latin character width ≈ fontsize * 0.5
            cjk_max_chars = max(8, available_w // style.fontsize)

            # moviepy SubtitlesClip reads SRT file
            def make_text_clip(txt):
                from moviepy import TextClip
                # Long text automatically split into multiple lines
                wrapped = SubtitleGenerator._split_long_text(txt, cjk_max_chars)
                return TextClip(
                    text=wrapped,
                    font=font_path,
                    font_size=style.fontsize,
                    color=style.color,
                    stroke_color=style.stroke_color,
                    stroke_width=style.stroke_width,
                    bg_color=bg,
                    method="caption",
                    size=(available_w, None),
                    text_align="center",
                )

            subtitles_clip = SubtitlesClip(srt_path, make_textclip=make_text_clip)

            # Position subtitle according to style configuration
            pos = style.position
            if isinstance(pos, (list, tuple)) and len(pos) == 2:
                h, v = pos[0], pos[1]
                if isinstance(v, str):
                    v_lower = v.strip().lower()
                    if "top" in v_lower:
                        position = (h, "top")
                    elif "bottom" in v_lower:
                        position = (h, "bottom")
                    else:
                        position = (h, v)
                else:
                    position = (h, v)
            else:
                position = ("center", "bottom")

            final = CompositeVideoClip([video_clip, subtitles_clip.with_position(position)])
            final.write_videofile(
                output_path,
                codec="libx264",
                audio_codec="aac",
                audio_bitrate="192k",
                audio_fps=44100,
                fps=30,
                logger="bar",
            )

            video_clip.close()
            final.close()

            logger.info(f"[Subtitle] Overlay complete: {output_path}")
            return output_path

        except Exception as e:
            logger.error(f"[Subtitle] Overlay failed: {e}, falling back to copy")
            import shutil
            shutil.copy2(video_path, output_path)
            return output_path

"""core.audio.tts — Unified TTS interface: EdgeTTSEngine + SilentTTSEngine

Based on edge_tts (free Azure Edge TTS) and silent placeholders.
"""

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import Optional, Tuple

import edge_tts

logger = logging.getLogger(__name__)


class TTSEngine(ABC):
    """Abstract base class for TTS."""

    @abstractmethod
    async def generate(
        self, text: str, output_path: str, voice: str = "zh-CN-XiaoxiaoNeural", rate: str = "+0%"
    ) -> Tuple[str, object]:
        """Generate audio file, returning (audio_path, sub_maker_or_cues)."""
        ...


class EdgeTTSEngine(TTSEngine):
    """Free TTS engine based on edge_tts.

    generate() returns (audio_path, sub_maker), where sub_maker is an edge_tts.SubMaker instance,
    containing word-by-word timestamp cues, which can be used to generate SRT subtitles.
    """

    async def generate(
        self, text: str, output_path: str, voice: str = "zh-CN-XiaoxiaoNeural", rate: str = "+0%"
    ) -> Tuple[str, "edge_tts.SubMaker"]:
        """Generate TTS audio + SubMaker (containing timestamp cues).

        Args:
            text: The text to read
            output_path: Output audio file path (.mp3)
            voice: edge_tts voice character
            rate: Rate adjustment (e.g. "+0%", "+20%", "-10%")

        Returns:
            (audio_path, sub_maker) tuple
        """
        logger.info(f"[TTS] Generating audio: voice={voice}, rate={rate}, text={len(text)} chars...")

        communicate = edge_tts.Communicate(text, voice=voice, rate=rate)
        sub_maker = edge_tts.SubMaker()

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        with open(output_path, "wb") as audio_file:
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_file.write(chunk["data"])
                elif chunk["type"] in ("WordBoundary", "SentenceBoundary"):
                    sub_maker.feed(chunk)

        logger.info(f"[TTS] Audio saved: {output_path}")
        return output_path, sub_maker


class SilentTTSEngine(TTSEngine):
    """Silent placeholder TTS engine.

    Generates silent audio for a specified duration and returns empty cues. Used when the user turns off narration but still needs subtitle timelines.
    """

    async def generate(
        self,
        text: str,
        output_path: str,
        voice: str = "zh-CN-XiaoxiaoNeural",
        rate: str = "+0%",
        duration_sec: Optional[float] = None,
    ) -> Tuple[str, dict]:
        """Generate silent audio.

        Args:
            text: Text (used for estimating duration if duration_sec is not provided)
            output_path: Output audio file path
            voice: Ignored (silent mode)
            rate: Ignored (silent mode)
            duration_sec: Specified silent duration (seconds), estimated by text length if not provided

        Returns:
            (audio_path, empty_cues_dict) tuple
        """
        if duration_sec is None:
            # Estimate duration: 4 characters per second
            duration_sec = max(len(text) / 4.0, 1.0)

        logger.info(f"[TTS] Generating silent audio: {duration_sec:.1f}s → {output_path}")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        # Use ffmpeg to generate silent audio
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"anullsrc=r=44100:cl=mono",
            "-t", str(duration_sec),
            "-c:a", "libmp3lame",
            "-q:a", "4",
            output_path,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.DEVNULL,
        )
        await proc.wait()

        # Return empty cues
        return output_path, {}

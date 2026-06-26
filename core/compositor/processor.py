"""core.compositor.processor — Video processor

Provides utility methods for scaling, frame extraction, silent audio generation, and last frame freezing.
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)


class VideoProcessor:
    """Video processing toolkit (scaling, frame extraction, silence generation, last frame freezing)."""

    @staticmethod
    def resize_video(input_path: str, width: int, height: int, output_path: str) -> str:
        """Scales video to specified resolution."""
        logger.info(f"[Compositor] Resizing: {input_path} → {width}x{height}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        import subprocess
        subprocess.run([
            "ffmpeg", "-y", "-i", input_path,
            "-vf", f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
                    f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", "-preset", "fast",
            output_path,
        ], capture_output=True, check=True, timeout=120)

        return output_path

    @staticmethod
    def extract_last_frame(video_path: str, output_path: str) -> str:
        """Extracts the last frame of the video as an image."""
        logger.info(f"[Compositor] Extracting last frame: {video_path} → {output_path}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        import subprocess
        subprocess.run([
            "ffmpeg", "-y",
            "-sseof", "-1",
            "-i", video_path,
            "-frames:v", "1",
            "-update", "1",
            output_path,
        ], capture_output=True, check=True, timeout=30)

        return output_path

    @staticmethod
    def generate_silent_audio(duration_sec: float, output_path: str) -> str:
        """Generates silent audio file of specified duration."""
        logger.info(f"[Compositor] Generating silent audio: {duration_sec:.1f}s → {output_path}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        import subprocess
        subprocess.run([
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", f"anullsrc=r=44100:cl=mono",
            "-t", str(duration_sec),
            "-c:a", "libmp3lame", "-q:a", "4",
            output_path,
        ], capture_output=True, check=True, timeout=30)

        return output_path

    @staticmethod
    def freeze_last_frame(video_path: str, freeze_duration: float, output_path: str) -> str:
        """Freezes the last frame of the video for a specified duration, outputting a new video.

        Used for video-audio alignment: when video duration is shorter, freezes the last frame to fill.

        Args:
            video_path: Input video
            freeze_duration: Freeze duration (seconds)
            output_path: Output video path
        """
        logger.info(f"[Compositor] Freezing last frame: {freeze_duration:.1f}s → {output_path}")
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        import subprocess

        # 1. Extract the last frame
        frame_path = output_path + "_frame.jpg"
        subprocess.run([
            "ffmpeg", "-y",
            "-sseof", "-1",
            "-i", video_path,
            "-frames:v", "1",
            "-update", "1",
            frame_path,
        ], capture_output=True, check=True, timeout=30)

        # 2. Generate freeze video from the last frame
        freeze_video_path = output_path + "_freeze.mp4"
        subprocess.run([
            "ffmpeg", "-y",
            "-loop", "1",
            "-i", frame_path,
            "-i", video_path,  # Reuse original video parameters
            "-filter_complex",
            f"[0:v]scale=iw:ih,trim=duration={freeze_duration},setpts=PTS-STARTPTS[freeze];"
            f"[1:v][freeze]concat=n=2:v=1:a=0[out]",
            "-map", "[out]",
            "-c:v", "libx264", "-preset", "fast",
            "-t", str(freeze_duration),
            freeze_video_path,
        ], capture_output=True, check=False, timeout=60)

        # If complex filter fails, fall back to simple method
        if not os.path.exists(freeze_video_path) or os.path.getsize(freeze_video_path) == 0:
            from moviepy import VideoFileClip, concatenate_videoclips, ImageClip

            clip = VideoFileClip(video_path)
            last_frame = clip.to_ImageClip(duration=freeze_duration)
            final = concatenate_videoclips([clip, last_frame], method="compose")
            final.write_videofile(output_path, logger=None)
            clip.close()
            final.close()
        else:
            import shutil
            shutil.move(freeze_video_path, output_path)

        # Clean up temporary files
        for f in [frame_path, freeze_video_path]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

        return output_path

"""core.compositor — Video composition layer"""

from core.compositor.concatenator import VideoConcatenator
from core.compositor.processor import VideoProcessor

__all__ = ["VideoConcatenator", "VideoProcessor"]

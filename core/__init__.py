"""core — Agnes Video Generator v2.0 Core Module

Exports core classes and utility functions from all subpackages.
"""

from core.api import AgnesImageAPI, AgnesVideoAPI, AgnesChatAPI
from core.audio import EdgeTTSEngine, SilentTTSEngine, SubtitleGenerator
from core.compositor import VideoConcatenator, VideoProcessor
from core.pipelines import (
    BasePipeline,
    PipelineShutdown,
    SimpleVideoPipeline,
    CreativeVideoPipeline,
    ManuscriptVideoPipeline,
)

__all__ = [
    # API Layer
    "AgnesImageAPI",
    "AgnesVideoAPI",
    "AgnesChatAPI",
    # Audio Layer
    "EdgeTTSEngine",
    "SilentTTSEngine",
    "SubtitleGenerator",
    # Compositor Layer
    "VideoConcatenator",
    "VideoProcessor",
    # Pipeline Layer
    "BasePipeline",
    "PipelineShutdown",
    "SimpleVideoPipeline",
    "CreativeVideoPipeline",
    "ManuscriptVideoPipeline",
]

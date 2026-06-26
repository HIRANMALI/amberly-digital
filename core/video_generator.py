"""core.video_generator — Backward compatibility alias (migrated to core.api.agnes_video in v2.0)"""

from core.api.agnes_video import AgnesVideoAPI, VideoOutput

# Old class name compatibility
VideoGeneratorAgnesAPI = AgnesVideoAPI

__all__ = ["AgnesVideoAPI", "VideoOutput", "VideoGeneratorAgnesAPI"]

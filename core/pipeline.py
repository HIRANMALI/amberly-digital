"""core.pipeline — Backward compatibility alias (migrated to core.pipelines.creative_video in v2.0)"""

from core.pipelines import CreativeVideoPipeline, PipelineShutdown

# Old class name compatibility
VideoPipeline = CreativeVideoPipeline

__all__ = ["CreativeVideoPipeline", "VideoPipeline", "PipelineShutdown"]

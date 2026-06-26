"""core.image_generator — Backward compatibility alias (migrated to core.api.agnes_image in v2.0)"""

from core.api.agnes_image import AgnesImageAPI, ImageOutput

# Old class name compatibility
ImageGeneratorAgnesAPI = AgnesImageAPI

__all__ = ["AgnesImageAPI", "ImageOutput", "ImageGeneratorAgnesAPI"]

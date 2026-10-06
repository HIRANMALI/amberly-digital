import logging
import requests  # type: ignore
from typing import Optional
from tenacity import retry, stop_after_attempt

logger = logging.getLogger(__name__)


@retry(stop=stop_after_attempt(3))
def download_image(url: str, save_path: str) -> None:
    logger.info(f"Downloading image from {url} to {save_path}")
    resp = requests.get(url, timeout=(30, 120), stream=True)
    resp.raise_for_status()
    with open(save_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)
    logger.info(f"Image saved to {save_path}")


def optimize_image_to_b64(
    image_path: str, 
    max_size: tuple[int, int] = (2048, 2048), 
    include_prefix: bool = True,
    target_width: Optional[int] = None,
    target_height: Optional[int] = None
) -> str:
    import base64
    import os
    from io import BytesIO
    from PIL import Image, ImageOps
    
    requires_crop = target_width is not None and target_height is not None
    file_too_large = os.path.getsize(image_path) >= 2 * 1024 * 1024

    # If the file is under 2MB AND we don't need to crop, just send the original file exactly as-is
    if not file_too_large and not requires_crop:
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        if include_prefix:
            import mimetypes
            mime = mimetypes.guess_type(image_path)[0] or "image/png"
            return f"data:{mime};base64,{b64}"
        return b64

    # Process image (Resize or Crop)
    with Image.open(image_path) as img:
        if target_width is not None and target_height is not None:
            # Center-crop to exactly match the target aspect ratio
            target_ratio = target_width / target_height
            img_ratio = img.width / img.height
            
            if img_ratio > target_ratio:
                # Image is wider than target: crop left/right
                new_width = int(target_ratio * img.height)
                left = (img.width - new_width) // 2
                img = img.crop((left, 0, left + new_width, img.height))
            elif img_ratio < target_ratio:
                # Image is taller than target: crop top/bottom
                new_height = int(img.width / target_ratio)
                top = (img.height - new_height) // 2
                img = img.crop((0, top, img.width, top + new_height))
        
        # Resize only if the image is massive (e.g. > 2048x2048)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save as Lossless PNG to guarantee zero quality degradation
        buffer = BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
        
    if include_prefix:
        return f"data:image/png;base64,{b64}"
    return b64



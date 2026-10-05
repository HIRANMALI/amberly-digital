"""core.api.agnes_image — Agnes Image API wrapper (migrated from core/image_generator.py)"""

import asyncio
import base64
import logging
import mimetypes
import os
from typing import List, Optional

import requests  # type: ignore

from utils.image import download_image

logger = logging.getLogger(__name__)

BASE_URL = "https://apihub.agnes-ai.com/v1"


class ImageOutput:
    def __init__(self, fmt: str, ext: str, data: str):
        self.fmt = fmt
        self.ext = ext
        self.data = data

    def save(self, path: str) -> None:
        if self.fmt == "url":
            download_image(self.data, path)
        else:
            raw = self.data.split(",")[1] if "," in self.data else self.data
            with open(path, "wb") as f:
                f.write(base64.b64decode(raw))


class AgnesImageAPI:
    """Agnes Image generation API wrapper (t2i / i2i)."""

    def __init__(
        self,
        api_key: str,
        model: str = "agnes-image-2.1-flash",
        max_retries: int = 3,
        retry_base_delay: float = 15.0,
    ):
        self.api_key = api_key
        self.model = model
        self.i2i_model = "agnes-image-2.0-flash"
        self.max_retries = max_retries
        self.retry_base_delay = retry_base_delay
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    async def _resolve_image_ref(self, ref: str) -> str:
        if ref.startswith(("http://", "https://", "data:")):
            return ref
        if os.path.exists(ref):
            from utils.image import optimize_image_to_b64
            # Agnes Image API expects data URIs
            return await asyncio.to_thread(
                optimize_image_to_b64, ref, max_size=(2048, 2048), include_prefix=True
            )
        return ref

    async def generate_single_image(
        self,
        prompt: str,
        reference_image_paths: List[str] = [],
        size: Optional[str] = None,
        **kwargs,
    ) -> ImageOutput:
        use_i2i = len(reference_image_paths) > 0
        model = self.i2i_model if use_i2i else self.model
        payload: dict = {
            "model": model,
            "prompt": prompt,
            "size": size or "1024x1024",
            "n": 1,
        }

        if reference_image_paths:
            resolved = [await self._resolve_image_ref(p) for p in reference_image_paths]
            extra_body: dict = {"response_format": "url"}
            if len(resolved) == 1:
                extra_body["image"] = resolved[0]
            else:
                extra_body["image"] = resolved
            payload["extra_body"] = extra_body

        logger.info(f"[AgnesImage] Generating ({'i2i' if use_i2i else 't2i'}): {prompt[:80]}...")

        resp = None
        for attempt in range(self.max_retries):
            try:
                resp = await asyncio.to_thread(
                    requests.post,
                    f"{BASE_URL}/images/generations",
                    headers=self.headers,
                    json=payload,
                    timeout=(30, 120),
                )
                resp.raise_for_status()
                break
            except requests.exceptions.RequestException as e:
                error_detail = ""
                status_code = "?"
                if resp is not None:
                    try:
                        error_detail = resp.text[:500]
                        status_code = str(resp.status_code)
                    except Exception:
                        pass
                
                delay = self.retry_base_delay * (attempt + 1)
                if attempt < self.max_retries - 1:
                    logger.warning(
                        f"[AgnesImage] HTTP {status_code}: {error_detail or e}, "
                        f"retrying in {delay}s ({attempt + 1}/{self.max_retries})..."
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(
                        f"[AgnesImage] HTTP {status_code}: {error_detail or e} "
                        f"permanently failed after {self.max_retries} attempts."
                    )
                    raise

        if resp is None:
            raise RuntimeError("Agnes image request failed without response")
        result = resp.json()

        if "error" in result:
            err = result["error"]
            raise RuntimeError(f"Agnes image error: {err.get('message', err)}")

        data_list = result.get("data", [])
        if not data_list:
            raise RuntimeError("Agnes image: no data returned")

        url = data_list[0].get("url", "")
        if not url:
            b64_data = data_list[0].get("b64_json", "")
            if b64_data:
                logger.info("[AgnesImage] Got base64 response, saving...")
                return ImageOutput(fmt="b64", ext="png", data=b64_data)
            raise RuntimeError("Agnes image: no URL or base64 in response")

        logger.info(f"[AgnesImage] Done: {url[:80]}...")
        return ImageOutput(fmt="url", ext="png", data=url)

"""core.api.agnes_chat — Agnes Chat API wrapper (extracted from core/screenwriter.py)"""

import base64
import json
import logging
import mimetypes
import os
from typing import Any, Dict, List

import requests  # type: ignore

logger = logging.getLogger(__name__)

BASE_URL = "https://apihub.agnes-ai.com/v1"


class AgnesChatAPI:
    """Agnes LLM Chat API wrapper (text + multimodal)."""

    def __init__(self, api_key: str, model: str = "agnes-2.0-flash"):
        self.api_key = api_key
        self.model = model
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def _image_to_b64_uri(self, path: str) -> str:
        with open(path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        mime = mimetypes.guess_type(path)[0] or "image/png"
        return f"data:{mime};base64,{b64}"

    def chat(self, system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> str:
        """Pure text Chat invocation."""
        logger.info(f"[AgnesChat] Calling chat ({self.model}), prompt: {len(user_prompt)} chars...")
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers=self.headers,
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "temperature": 0.7,
                "max_tokens": max_tokens,
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

    def chat_json(self, system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> dict:
        """Chat invocation and parsing of JSON response."""
        content = self.chat(system_prompt, user_prompt, max_tokens=max_tokens)
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[1]
            if content.endswith("```"):
                content = content[:-3]
        return json.loads(content)

    def chat_multimodal(
        self,
        system_prompt: str,
        text_prompt: str,
        image_paths: List[str],
        max_tokens: int = 4096,
    ) -> str:
        """Multimodal Chat invocation (text + image)."""
        messages: List[Dict[str, Any]] = [{"role": "system", "content": system_prompt}]

        user_content: List[Dict[str, Any]] = [{"type": "text", "text": text_prompt}]
        for img_path in image_paths:
            if img_path.startswith(("http://", "https://")):
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": img_path},
                })
            elif os.path.exists(img_path):
                b64_uri = self._image_to_b64_uri(img_path)
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": b64_uri},
                })
        messages.append({"role": "user", "content": user_content})

        logger.info(
            f"[AgnesChat] Calling multimodal ({self.model}), "
            f"{len(image_paths)} image(s), prompt: {len(text_prompt)} chars..."
        )
        resp = requests.post(
            f"{BASE_URL}/chat/completions",
            headers=self.headers,
            json={
                "model": self.model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": max_tokens,
            },
            timeout=300,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]

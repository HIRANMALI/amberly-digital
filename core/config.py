"""
core/config.py — Agnes Video Generator v2.0 Configuration Module

Contains API Key management, working directories, default audio/subtitle configuration factory functions.
"""

import json
import logging
import os

from models.task import AudioConfig, SubtitleStyle

logger = logging.getLogger(__name__)

CONFIG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".agnes_config")
CONFIG_FILE = os.path.join(CONFIG_DIR, "config.json")

# Project root directory
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def font_dir() -> str:
    """Return project built-in fonts directory."""
    return os.path.join(_PROJECT_ROOT, "resource", "fonts")


# Default CJK font file name (must be located under resource/fonts/)
DEFAULT_CHINESE_FONT = "STHeitiMedium.ttc"

# Common font names that do not support CJK characters (for backward compatibility with legacy tasks)
# These fonts do not render CJK characters correctly in moviepy/pillow TextClip,
# and will fall back to DEFAULT_CHINESE_FONT when detected.
_NON_CJK_FONTS = frozenset({
    "arial", "arial bold", "arial italic", "arial black",
    "helvetica", "times", "times new roman", "courier",
    "courier new", "verdana", "tahoma", "georgia", "trebuchet ms",
    "impact", "comic sans ms", "lucida console",
})


def resolve_font_path(font: str) -> str:
    """Resolve font name to a path usable by moviepy TextClip.

    Priority:
    1. Absolute path and file exists -> return directly
    2. File name (with extension) -> look inside resource/fonts/ directory
    3. Known non-CJK font name -> fall back to DEFAULT_CHINESE_FONT (legacy task compatibility)
    4. Other system font names -> return directly
    """
    # Already an absolute path, return directly
    if os.path.isabs(font) and os.path.exists(font):
        return font

    # Looks like a filename (with extension), attempt to find in project font directory
    if "." in font and "/" not in font and "\\" not in font:
        candidate = os.path.join(font_dir(), font)
        if os.path.exists(candidate):
            return candidate

    # Check if it is a known non-CJK font (backward compatibility: legacy task font might be "Arial")
    if font.strip().lower() in _NON_CJK_FONTS:
        fallback = os.path.join(font_dir(), DEFAULT_CHINESE_FONT)
        if os.path.exists(fallback):
            logger.warning(
                f"Font '{font}' does not support CJK characters, "
                f"falling back to {DEFAULT_CHINESE_FONT}"
            )
            return fallback

    # Return as system font name
    return font


# ═══════════════════════════════════════════════════
# API Key Management (maintain existing logic)
# ═══════════════════════════════════════════════════


def _ensure_config_dir():
    os.makedirs(CONFIG_DIR, exist_ok=True)


def load_config() -> dict:
    _ensure_config_dir()
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    return {}


def save_config(config: dict):
    _ensure_config_dir()
    with open(CONFIG_FILE, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_api_key() -> str:
    return os.environ.get("AGNES_API_KEY", "")


def set_api_key(key: str):
    raise RuntimeError("API Key can only be configured via environment variables (.env)")


def delete_api_key() -> bool:
    raise RuntimeError("API Key can only be configured via environment variables (.env)")


def get_api_key_source() -> str:
    """Return the source of the current API key.

    Returns:
        'env' if from AGNES_API_KEY environment variable,
        'none' if no key is configured.
    """
    if os.environ.get("AGNES_API_KEY", ""):
        return "env"
    return "none"


def get_working_dir() -> str:
    return os.path.join(os.getcwd(), ".working_dir")


# ═══════════════════════════════════════════════════
# Added in v2.0: default audio / subtitle configurations
# ═══════════════════════════════════════════════════

# D3: default voice role
DEFAULT_VOICE = "zh-CN-XiaoxiaoNeural"

# D3: available CJK voice roles
AVAILABLE_VOICES = [
    {"id": "zh-CN-XiaoxiaoNeural", "label": "Xiaoxiao (Gentle Female)"},
    {"id": "zh-CN-YunyangNeural", "label": "Yunyang (Steady Male)"},
    {"id": "zh-CN-XiaoyiNeural", "label": "Xiaoyi (Lively Female)"},
    {"id": "zh-CN-YunxiNeural", "label": "Yunxi (Young Male)"},
]


def get_default_subtitle_style() -> SubtitleStyle:
    """Return default subtitle style configuration (D4)."""
    return SubtitleStyle(
        font=DEFAULT_CHINESE_FONT,
        color="white",
        position=("center", "bottom-80"),
        fontsize=48,
        stroke_color="black",
        stroke_width=2,
        bg_color=(0, 0, 0, 128),
    )


def get_default_audio_config() -> AudioConfig:
    """Return default audio configuration (including subtitle style) (D3)."""
    return AudioConfig(
        enabled=True,
        voice=DEFAULT_VOICE,
        rate="+0%",
        subtitle_style=get_default_subtitle_style(),
    )


# ═══════════════════════════════════════════════════
# Video Parameter Presets (D7)
# ═══════════════════════════════════════════════════

VIDEO_RESOLUTION_PRESETS = {
    "portrait": {"width": 768, "height": 1152, "label": "Portrait 9:16"},
    "landscape": {"width": 1152, "height": 768, "label": "Landscape 16:9"},
    "square": {"width": 1024, "height": 1024, "label": "Square 1:1"},
}

# Duration -> (num_frames, frame_rate) mapping
DURATION_FRAME_MAP = {
    5: (121, 24),
    10: (241, 24),
    15: (361, 24),
    18: (441, 24),
    20: (441, 22),
}

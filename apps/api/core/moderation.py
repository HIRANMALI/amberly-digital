"""
Content Moderation System for Amberly Digital API
- Image Moderation via Cloudinary (AWS Rekognition / WebPurify)
- Prompt & Script NSFW / Prohibited Keyword Filtering
"""

import re
import logging
from typing import Optional, Tuple, List

try:
    from fastapi import HTTPException
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: str):
            self.status_code = status_code
            self.detail = detail
            super().__init__(f"HTTP {status_code}: {detail}")

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════
# Comprehensive NSFW & Prohibited Content Keyword Blocklist
# ═══════════════════════════════════════════════════

# Core NSFW, adult, explicit, gore, and harmful terms
_PROHIBITED_KEYWORDS = {
    # Explicit Adult & Sexual Content
    "nsfw", "porn", "porno", "pornography", "xxx", "sex", "sexy", "sexual",
    "nude", "nudity", "naked", "topless", "bottomless", "erotic", "erotica",
    "boobs", "breasts", "tits", "nipple", "nipples", "vagina", "pussy",
    "penis", "dick", "cock", "orgasm", "cum", "ejaculation", "blowjob", "handjob",
    "fetish", "bdsm", "bondage", "anal", "masturbation", "hentai", "ecchi",
    "milf", "dildo", "vibrator", "striptease", "stripper", "cleavage", "lingerie",
    "thong", "playboy", "onlyfans", "explicit", "cunt", "slut", "whore",

    # Violence, Gore & Bodily Harm
    "gore", "bloodshed", "decapitation", "behead", "beheading", "mutilate",
    "mutilation", "torture", "suicide", "self-harm", "slashing", "snuff",
    "dismember", "dismemberment", "corpse", "slaughter", "massacre",

    # Harassment & Extreme Hate
    "rape", "rapist", "molest", "molestation", "pedophile", "pedo", "pedophilia",
    "childporn", "csam", "incest", "bestiality", "zoophilia"
}

import unicodedata

# Allowlisted phrases and benign compound words
_BENIGN_PHRASES = {
    "chicken breast", "turkey breast", "duck breast", "breast cancer", "breastplate",
}

_BENIGN_WORDS = {
    "cocktail", "cocktails", "dickens", "peacock", "peacocks", "shuttlecock",
    "shuttlecocks", "hitchcock", "woodcock", "cockerel"
}

# Regex patterns for obfuscated/leetspeak variants
_LEET_SUBS = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
    '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i',
    '+': 't', 'v': 'u',
}

# Common Cyrillic / Greek homoglyphs to Latin mapping
_HOMOGLYPHS = {
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
    'і': 'i', 'ј': 'j', 'ѕ': 's', 'ԁ': 'd', 'ԛ': 'q', 'ԝ': 'w',
    'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'κ': 'k', 'ν': 'v', 'ο': 'o', 'ρ': 'p', 'τ': 't',
}


def _normalize_text(text: str) -> str:
    """Normalize text by converting unicode, homoglyphs, leetspeak, and removing evasion formatting."""
    # 1. Unicode decomposition (converts full-width, math fonts, accented characters like é, ü to base ascii)
    normalized = unicodedata.normalize('NFKD', text)
    normalized = ''.join(c for c in normalized if not unicodedata.combining(c))
    normalized = normalized.lower()

    # 2. Replace Cyrillic / Greek lookalikes
    for cyr, lat in _HOMOGLYPHS.items():
        normalized = normalized.replace(cyr, lat)

    # 3. Strip zero-width & invisible characters
    normalized = re.sub(r'[\u200B-\u200D\uFEFF\u00AD\u2060\u200E\u200F]', '', normalized)

    # 4. Convert leetspeak numbers & symbols
    for char, sub in _LEET_SUBS.items():
        normalized = normalized.replace(char, sub)

    # 5. Remove excessive punctuation used for evasion (e.g., p.o.r.n -> porn, n-u-d-e -> nude)
    cleaned = re.sub(r'[^a-z0-9\s]', '', normalized)

    # 6. Collapse single-letter spaced evasion (e.g., "n u d e" -> "nude", "p  o  r  n" -> "porn")
    cleaned = re.sub(r'(?<=\b[a-z])\s+(?=[a-z]\b)', '', cleaned)

    return cleaned


def is_prompt_safe(text: str) -> Tuple[bool, Optional[str]]:
    """
    Check if a prompt or script contains prohibited/NSFW terms.
    Returns (is_safe: bool, matched_reason: Optional[str]).
    """
    if not text or not text.strip():
        return True, None

    normalized = _normalize_text(text)
    
    # Ignore benign phrases (e.g. 'chicken breast', 'breast cancer')
    for phrase in _BENIGN_PHRASES:
        normalized = normalized.replace(phrase, " ")

    words = set(re.findall(r'\b[a-z0-9]+\b', normalized))

    for word in words:
        if word in _BENIGN_WORDS:
            continue

        # Check direct match
        if word in _PROHIBITED_KEYWORDS:
            return False, f"Prohibited word detected: '{word}'"

        # Check de-duplicated elongated word (e.g. seeeexxyyy -> sexy, nuuude -> nude)
        deduped = re.sub(r'(.)\1+', r'\1', word)
        if deduped in _PROHIBITED_KEYWORDS:
            return False, f"Prohibited word variant detected: '{word}'"

    # Also check compound evasions (e.g. "nakedwoman", "pornvideo")
    for keyword in _PROHIBITED_KEYWORDS:
        if len(keyword) >= 4:
            pattern = r'\b' + re.escape(keyword) + r'[a-z]+\b'
            matches = re.findall(pattern, normalized)
            for m in matches:
                if m not in _BENIGN_WORDS:
                    return False, f"Prohibited keyword compound detected: '{m}'"

    return True, None


def validate_prompt_safety(text: Optional[str], field_name: str = "Prompt") -> None:
    """
    Validates text safety and raises FastAPI HTTPException if prohibited content is found.
    """
    if not text:
        return

    is_safe, reason = is_prompt_safe(text)
    if not is_safe:
        logger.warning(f"[Moderation] Rejected {field_name}: {reason}")
        raise HTTPException(
            status_code=400,
            detail=f"{field_name} rejected by Content Safety Filter: {reason}. Please adjust your prompt to comply with safety guidelines."
        )


# ═══════════════════════════════════════════════════
# Cloudinary Image Moderation
# ═══════════════════════════════════════════════════

def upload_and_moderate_image(
    file_path: str,
    folder: str,
    public_id: Optional[str] = None,
    moderation_model: Optional[str] = None
) -> dict:
    """
    Uploads an image to Cloudinary for permanent storage.
    If a moderation_model is provided (and supported on the Cloudinary account),
    it checks the moderation verdict. Otherwise it directly stores the image safely.
    
    Returns the Cloudinary upload response dictionary.
    """
    import cloudinary
    import cloudinary.uploader

    if not cloudinary.config().cloud_name:
        logger.warning("[Cloudinary] Cloudinary is not configured. Skipping upload.")
        return {}

    upload_params = {
        "folder": folder,
        "overwrite": True,
        "invalidate": True,
    }
    if moderation_model:
        upload_params["moderation"] = moderation_model
    if public_id:
        upload_params["public_id"] = public_id

    try:
        logger.info(f"[Cloudinary] Uploading {file_path} (folder={folder}, public_id={public_id})...")
        response = cloudinary.uploader.upload(file_path, **upload_params)
        
        # Check moderation results if enabled
        moderations = response.get("moderation", [])
        for mod in moderations:
            status = mod.get("status")
            kind = mod.get("kind", "AI Moderation")
            logger.info(f"[Cloudinary Moderation] Result for {public_id or file_path}: kind={kind}, status={status}")
            
            if status == "rejected":
                uploaded_id = response.get("public_id")
                if uploaded_id:
                    cloudinary.uploader.destroy(uploaded_id)
                
                logger.warning(f"[Cloudinary Moderation] Image rejected by {kind}: {public_id or file_path}")
                raise HTTPException(
                    status_code=400,
                    detail="Uploaded image was flagged and rejected by content moderation. Please upload an appropriate image."
                )

        return response

    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        # If it failed due to unsupported moderation model subscription, retry standard upload immediately
        if moderation_model and ("subscription" in err_msg.lower() or "not active" in err_msg.lower() or "rekognition" in err_msg.lower()):
            logger.info(f"[Cloudinary] Rekognition AI moderation add-on not subscribed on account. Uploading standard image for {file_path}...")
            upload_params.pop("moderation", None)
            try:
                response = cloudinary.uploader.upload(file_path, **upload_params)
                return response
            except Exception as fallback_err:
                logger.error(f"[Cloudinary] Standard upload fallback failed: {fallback_err}")
                raise fallback_err
        else:
            logger.error(f"[Cloudinary] Upload failed for {file_path}: {e}")
            raise

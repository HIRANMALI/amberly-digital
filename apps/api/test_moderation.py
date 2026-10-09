import os
import sys
import importlib.util

# Set utf-8 output encoding for windows console
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    getattr(sys.stdout, "reconfigure")(encoding="utf-8")

module_path = os.path.join(os.path.dirname(__file__), "core", "moderation.py")
spec = importlib.util.spec_from_file_location("moderation", module_path)
assert spec and spec.loader
moderation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(moderation)

is_prompt_safe = moderation.is_prompt_safe
validate_prompt_safety = moderation.validate_prompt_safety
HTTPException = moderation.HTTPException

test_cases = [
    # Safe Prompts (Should PASS)
    ("Cinematic drone shot of mountains at golden hour", True),
    ("A futuristic robot helping a student learn science", True),
    ("Cooking a delicious chicken breast with fresh rosemary", True),
    ("A peaceful walking tour through historic Sussex town", True),
    ("An astronaut floating gracefully in deep space", True),
    ("A business meeting in a modern glass office", True),

    # Benign Words / False Positive Defenses (Should PASS)
    ("An antique brass cocktail shaker on a wooden bar", True),
    ("A peacock displaying magnificent colorful feathers in the park", True),
    ("A classic glass building reflecting the sunlight", True),
    ("Doctor researching breast cancer treatments in a modern laboratory", True),
    ("A brave knight wearing a polished medieval steel breastplate", True),
    ("Reading a classic vintage novel by Charles Dickens", True),
    ("An executive assistant organizing financial documents in an office", True),
    ("A fresh green cucumber in a summer salad", True),

    # Direct NSFW & Adult Content (Should BLOCK)
    ("A photo of a naked person standing outside", False),
    ("Generate a porn video with xxx adult content", False),
    ("Explicit erotic photoshoot with nudity", False),
    ("A model posing in lingerie and sexy dress", False),
    ("Close up erotic portrait with cleavage", False),
    ("Uncensored hentai anime scene", False),

    # Evasion & Leetspeak Attempts (Should BLOCK)
    ("A high quality n.u.d.e portrait", False),
    ("A realistic image with p0rnography aesthetics", False),
    ("High quality b00bs photo", False),
    ("Very s3xy woman on the beach", False),

    # Advanced Evasions: Accents, Homoglyphs, Zero-Width Chars, Spacing (Should BLOCK)
    ("A high quality nüdity portrait", False),
    ("A realistic рorn video", False),  # Cyrillic 'р' lookalike
    ("A cinematic p\u200bo\u200br\u200bn photoshoot", False),  # Zero-width spaces
    ("A high quality n u d e model on a couch", False),  # Space-separated letters
    ("Very seeeexxyyy model posing", False),  # Elongated letters

    # Violence & Gore (Should BLOCK)
    ("Extremely graphic gore and decapitation scene", False),
    ("A brutal torture and mutilation scene", False),
    ("Violent bloodshed and slaughter of soldiers", False),

    # Harm & Harassment (Should BLOCK)
    ("A scene depicting rape and assault", False),
]

print("=" * 75)
print("TEST: AMBERLY DIGITAL - CONTENT & NSFW MODERATION")
print("=" * 75)

passed = 0
for text, should_be_safe in test_cases:
    safe, reason = is_prompt_safe(text)
    status = "SAFE" if safe else "BLOCKED"
    correct = (safe == should_be_safe)
    
    if correct:
        passed += 1
        mark = "[PASS]"
    else:
        mark = "[FAIL]"
        
    expected_str = "SAFE" if should_be_safe else "BLOCKED"
    print(f"{mark} | Expected: {expected_str:7} | Got: {status:7} | \"{text}\"")
    if reason:
        print(f"       └── Trigger: {reason}")

print("=" * 75)
print(f"Final Result: {passed}/{len(test_cases)} tests passed ({(passed/len(test_cases))*100:.1f}%)")
print("=" * 75)

# Test FastAPI HTTPException behavior
print("\nTesting FastAPI Exception Trigger...")
try:
    validate_prompt_safety("generate a nude person on a bed", "User Prompt")
    print("[FAIL] Expected HTTPException was not raised!")
except HTTPException as e:
    print(f"[PASS] Success: FastAPI raised HTTPException({e.status_code}): {e.detail}")

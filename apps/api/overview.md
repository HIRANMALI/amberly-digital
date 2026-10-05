# Agnes Video Generator v2.1 — Code and Regression Pipeline Optimization Report

## Fix Date
2026-06-15

## 1. Coarse Subtitle Segmentation (Core Fix)

**Issue**: A 14-second video had only 5 subtitle entries, and a 5-second video might have only 1. edge_tts by default generates sentence-level subtitles.

**Fix**: `core/audio/subtitle.py`

1. Added `_generate_fine_srt_from_word_cues()` — Uses the word-level timestamp `cues` property from edge_tts 7.x SubMaker to group subtitles using the following greedy rules:
   - Max 2.5 seconds or 18 characters per subtitle line.
   - Break at long pauses (>0.4s) first.
   - Combine short tail groups (<0.8s) if the limit is not exceeded.
2. Threshold fallbacks: Fall back to default sentence-level SRT generation if word cues are fewer than 6.
3. Compatibility handling: Fixed a crash in `get_srt()` caused by a conflict in the `proprietary` field between edge_tts 7.2.8 and certain srt libraries by adding a try/except block to manually construct SRT blocks.

**Result**: A 14-second video now generates 6–7 subtitle entries instead of 5, offering smoother pacing.

## 2. Regression Runner False Positives Fixed

**Issue**: The previous regression report showed 22 "FAILED" checks for C1/C4/M1/M2, which were mostly false positives.

**Fix**: `scripts/regression_runner.py`

| Fix Item | Root Cause | Fix Description |
|--------|------|---------|
| R3_all_completed | Modes other than keyframes do not run end_frame_prompts/generation steps | Skip validation of mode-specific steps |
| R5_task_json / R5_has_video_id | Creative/Manuscript tasks store task.json in subdirectories | Scan `scene_N/` and `para_N/` subdirectories |
| R6_curl_sh / R6_has_video_id_in_curl | Same as above | Same as above |
| R7_audio_files | Mark as false for silent/no-audio scenes | Mark as N/A depending on the `audio_enabled` parameter |
| R10_srt_entries | Check subtitles for mute tasks | Mark as N/A depending on the `audio_enabled` parameter |
| Missing Task Dir | Script crashed when C2/C3 failed due to missing assets | Added defensive directory check |

## 3. Regression Plan Documentation Update

**Fix**: `docs/regression_test_plan.md`

1. **Added "8. Tool Dependencies & Troubleshooting"**: Detailed guidelines for whisper, ffmpeg, moviepy installation, common problems, and health check scripts.
2. **Added "9. Regression Process Self-Iteration"**: Problem logging, self-iteration flow chart, check list, and principles for modifying validation logic.
3. **Asset Generation**: Automatically generates test_ref.png and test_end.png using Pillow if PIL is installed.
4. **Section Renumbering**: Renumbered old section 8 to 10 and 9 to 11.

## 4. Regression Script Enhancements

**Fix**: `scripts/regression_runner.py`

- Added `_ensure_test_assets()` — Generates placeholder images for testing if they are missing.
- Trigger asset check before `main()` execution.

## Impact Scope

| File | Change Type | Risk |
|------|---------|------|
| `core/audio/subtitle.py` | Added fine-grained SRT + fallback | Low (full fallback mechanism in place) |
| `scripts/regression_runner.py` | Fixed false positives + auto asset generation | Low (only modifies validation runner) |
| `docs/regression_test_plan.md` | Added documentation sections | No risk |

## Recommendations

1. Monitor subtitle entries count during subsequent regression runs (R10_srt_entries is expected to be > 4).
2. Ensure test_ref.png is present or auto-generated for C2/C3 to pass.
3. Simplify the fallback logic in subtitle generator if future edge_tts updates fix the srt_composer compatibility.

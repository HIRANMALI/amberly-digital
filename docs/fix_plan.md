# Fix Plan: Regression Test Issue Resolution

> Date: 2026-06-14
> Related: 3 critical issues exposed in the regression test report

---

## Issue 1: CreativePipeline Narration is Too Long → Abnormal Video Duration

**Symptom**: The C4 scenario (Creative + TTS) output video is 262.79s, far exceeding the expected duration (3 × 5s ≈ 15s).

**Root Cause**: `core/pipelines/creative_video.py` `_populate_narrations()` evenly distributes the full AI-generated story paragraphs to each scene as narration. TTS speaking a long paragraph takes tens of seconds, and `_synthesize_single()` freezes the last frame to stretch the video to match the audio length.

**Fix**: When the narration length of a scene exceeds `video_duration × 4` (assuming 4 chars/sec speed), clip the narration at a sentence boundary.

### Impacted Code

| Location | Change |
|------|------|
| `creative_video.py:1026-1046` `_populate_narrations()` | Add trimming logic |

### Core Changes

```python
_CHARS_PER_SEC = 4.0

def _trim_narration(text: str, max_chars: int) -> str:
    if len(text) <= max_chars:
        return text
    # Trim by sentence boundary
    trimmed = text[:max_chars]
    last_period = max(
        trimmed.rfind("。"), trimmed.rfind("！"), trimmed.rfind("？"),
        trimmed.rfind("."), trimmed.rfind("!"), trimmed.rfind("?"),
    )
    if last_period > max_chars * 0.5:
        return text[: last_period + 1]
    return trimmed[:max_chars]
```

---

## Issue 2: ManuscriptPipeline Video Duration Mismatches Paragraph Actual Duration

**Symptom**: M1/M2 paragraphs are submitted with a fixed `video_duration=5s`, but paragraph narration text can be longer (~22 characters ≈ 5.5s), causing mismatch between voiceover and video.

**Root Cause**: `core/pipelines/manuscript_video.py` `_step_generate_videos()` calls `submit_video(duration=self._state.video_duration, ...)` using the fixed default value for all segments.

**Fix**: Use estimated speech duration `max(ceil(len(para.text) / 4.0), 3)` as the duration parameter for submitting video.

### Impacted Code

| Location | Change |
|------|------|
| `manuscript_video.py:483-488` `_step_generate_videos()` | Replace `video_duration` with segment estimated duration |

---

## Issue 3: Regression Runner Does Not Persist task_id Immediately on Task Creation

**Symptom**: If the regression script is interrupted after task submission but before completion, `--resume` cannot find the submitted task ID, requiring a full rerun.

**Root Cause**: `scripts/regression_runner.py` `run_scenario()` only writes to the report after the task finishes.

**Fix**:
1. Add a `"submitted"` intermediate state.
2. Immediately call `report.update_scenario(sc.id, "submitted", result={task_id, dir_name})` after `submit_task()` succeeds.
3. Keep `"submitted"` and `"running"` states in `should_run()` (so resumption processes them as pending).
4. Resume path: If state is `"submitted"`, try to poll the existing task ID; if it times out or fails, re-submit.
5. Fix E1 check text: Change `"simple-video"` to `"Agnes Video Generator"`.

### Impacted Code

| Location | Change |
|------|------|
| `regression_runner.py:324-326` `should_run()` | Do not filter out `submitted`/`running` |
| `regression_runner.py:588-592` `run_scenario()` | Persist task ID immediately after submission |
| `regression_runner.py:699-701` Endpoint check E1 | Fix matching text |

---

## Verification Plan

1. Start the server: `bash start.sh`
2. Run the regression test: `python scripts/regression_runner.py --auto-start`
3. Verify C4 duration is ~15s (3 × 5s, no longer stretched by long narration).
4. Verify M1/M2 segment durations match their narration lengths.
5. Interrupt with `Ctrl+C` and verify that `--resume` resumes successfully from the checkpoints.

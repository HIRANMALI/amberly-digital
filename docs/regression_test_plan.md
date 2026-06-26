# Agnes Video Generator v2.0 — Major Version Regression Test Plan

> User Trigger Phrase: **"执行大版本回归"**
> The Lead Agent automatically loads this document, executes the steps in order, and outputs a report.

---

## 1. Regression Scope Overview

| Task Type | Scenarios | Core Modules Involved |
|----------|-----------|-------------|
| Simple Video (Type 1) | 3 | `simple_video.py`, `agnes_video.py`, `task_manager.py` |
| Creative Video (Type 2) | 4 | `creative_video.py`, `agnes_image.py`, `agnes_video.py`, `screenwriter.py`, `tts.py`, `subtitle.py`, `concatenator.py` |
| Manuscript Video (Type 3) | 2 | `manuscript_video.py`, `agnes_video.py`, `screenwriter.py`, `tts.py`, `subtitle.py`, `concatenator.py` |
| **Total** | **9** | |

---

## 2. Test Scenario Matrix

### 2.1 Simple Video (SimpleVideoPipeline)

| ID | Scenario | Mode | Ref Image | End Frame | Key Validation Points |
|----|------|------|--------|------|---------|
| S1 | Text-to-Video | t2v | None | None | Basic t2v submission flow, polling, download |
| S2 | Image-to-Video | ti2vid | Upload Ref Image | None | Image upload, i2v parameter construction |
| S3 | Keyframe Animation | keyframes | Upload Ref Image | Upload End Frame | Dual-image mode, keyframes parameter construction |

### 2.2 Creative Video (CreativeVideoPipeline)

Test focus: **Mute scenes are primary**; only one scene is required to verify TTS and subtitles.

| ID | Scenario | Chaining Mode | Ref Image | Narration | Key Validation Points |
|----|------|--------------|--------|------|---------|
| C1 | Text + Independent + Mute | independent | None | Disabled | Pure text input, story→script→video→SilentTTS→concat workflow |
| C2 | Ref Image + Keyframes + Mute | keyframes | Upload Ref Image | Disabled | Ref image upload, end-frame generation, keyframes submission |
| C3 | Ref Image generated End Frame + Keyframes + Mute | keyframes | Upload Ref Image | Disabled | `generate_end_frames_from_ref` (i2i), keyframes |
| C4 | Independent + Narration/Subtitles | independent | None | Enabled | End-to-end TTS + subtitle validation (single scene coverage) |

### 2.3 Manuscript Video (ManuscriptVideoPipeline)

Verify short manuscript scenario only. Long manuscripts are excluded from regression.

| ID | Scenario | Manuscript Length | Narration | Key Validation Points |
|----|------|---------|------|---------|
| M1 | Short Manuscript + Narration | ~100 characters | Enabled | split→prompt→video→TTS→SRT→concat overlay |
| M2 | Short Manuscript + Custom Style | ~100 characters | Enabled | Custom stroke/position/bg subtitle style options |

---

## 3. Verification Artifact List

Verify the following artifacts after running each test scenario. The **Verification Method** indicates who performs the check: Auto (script checks automatically) or Manual (requires user manual verification).

### 3.1 Final Outputs

| # | Artifact | Path Pattern | Verification | Method | Criteria |
|---|------|---------|---------|---------|---------|
| F1 | Final Video | `{working_dir}/{task_dir}/final_video.mp4` | File exists, not empty | Auto | `os.path.exists` and `os.path.getsize > 0` |
| F2 | Video Duration | — | Duration is reasonable (> 0) | Auto | Read via `ffprobe` or `moviepy` |
| F3 | Video Resolution | — | Matches request parameters | Auto | Read width/height via `ffprobe` |
| F4 | Audio Track + Speech Content | — | Video contains audio stream + speech matches prompt | Auto | `moviepy` detects audio track + ASR transcription (e.g., whisper) fuzzy match with source text |
| F5 | Subtitle Visibility | — | Subtitles are rendered on video | Manual | Play video, check appearance timing, content, styling |
| F6 | Subtitle Text Match | — | Subtitles match input text | Auto | Transcription of audio matches original text (overlap > 30%) |
| F7 | Reasonable Duration | — | Total duration ≈ max(video segments sum, narration duration + 1s) | Auto | Validate via `ffprobe` |

### 3.2 Checkpoints (Resume Checkpoints)

| # | Artifact | Path Pattern | Verification | Method | Criteria |
|---|------|---------|---------|---------|---------|
| R1 | task_state.json | `{task_dir}/task_state.json` | Valid JSON containing required fields | Auto | `json.load` succeeds, fields complete |
| R2 | task_type Field | task_state.json | Correct value (simple/creative/manuscript) | Auto | Matches task creation type |
| R3 | Step Statuses | task_state.json | Finished steps are marked as `completed` | Auto | Validate step statuses |
| R4 | final_video_file | task_state.json | Path exists and is valid | Auto | `os.path.exists(path)` |
| R5 | task.json (video_id) | `{task_dir}/task.json` (Simple) or `{scene_dir}/task.json` (Creative/Manuscript) | File exists, contains video_id | Auto | `json.load` contains `video_id` |
| R6 | curl.sh | `{task_dir}/curl.sh` or `{scene/para_dir}/curl.sh` | File exists, contains valid curl command | Auto | Contains `agnesapi?video_id=` |
| R7 | Segment Audio | `para_{n}/narration.mp3` etc. | Audio file exists (Creative/Manuscript) | Auto | `os.path.exists` |
| R8 | Segment Subtitles | `{para_dir}/narration.srt` or `{scene_dir}/subtitle.srt` | Subtitle file exists | Auto | `os.path.exists` |
| R9 | Combined Audio | `{task_dir}/full_narration.mp3` | Combined narration audio exists | Auto | Same as F1 |
| R10 | Combined Subtitles | `{task_dir}/full_subtitle.srt` | Combined subtitles exist with valid entries | Auto | Valid parsing, entries > 0 |

### 3.3 Server Endpoints

| # | Endpoint | Description | Method | Expected Result |
|---|------|---------|---------|---------|
| E1 | `GET /` | Returns Web UI HTML (with 3 tabs) | Auto | Status 200 |
| E2 | `GET /api/config` | Returns API Key (masked) | Auto | Status 200 |
| E3 | `POST /api/tasks/simple` | Validates parameters | Auto | Status 200 (or 422 for invalid parameters) |
| E4 | `POST /api/tasks/creative` | Validates parameters | Auto | Status 200 |
| E5 | `POST /api/tasks/manuscript` | Validates parameters | Auto | Status 200 |
| E6 | `GET /api/tasks` | List containing multiple task_types | Auto | Returns list of tasks |
| E7 | `GET /api/tasks/{id}` | Returns task detail with task_type | Auto | Status 200 |
| E8 | `POST /api/tasks/{id}/resume` | Resumes an interrupted task | Auto | Status 200 (or reasonable 4xx) |
| E9 | `POST /api/tasks/{id}/stop` | Stops a running task | Auto | Status 200 |

---

## 4. Verification Methods Description

### 4.1 Automated Verification (Run by Lead Agent)

The following checks are evaluated by the regression runner script, reporting `✅ PASS` or `❌ FAIL`:

```python
# Auto verification script pseudocode:
def auto_check(task_dir):
    checks = {}
    # F1: Final video exists
    video = os.path.join(task_dir, "final_video.mp4")
    checks["final_video_exists"] = os.path.exists(video)
    checks["final_video_nonempty"] = os.path.getsize(video) > 0 if checks["final_video_exists"] else False

    # F2: Video duration
    from moviepy import VideoFileClip
    clip = VideoFileClip(video)
    checks["video_duration"] = clip.duration > 0

    # F7: Video dimensions
    checks["video_width"] = clip.w
    checks["video_height"] = clip.h

    # R1-R10: Checkpoints
    task_state = os.path.join(task_dir, "task_state.json")
    checks["task_state_exists"] = os.path.exists(task_state)
    ...

    return checks
```

### 4.2 Manual Verification (User Confirmed)

> **Audio presence (F4) and subtitle text matches (F6) are verified automatically via Whisper ASR**: The script extracts audio from final_video.mp4, runs it through the `whisper` model, and checks text overlap (>30%).
>
> The following items require manual review:

| Check | Steps | Expected Result |
|--------|------------|---------|
| Subtitle Visibility (F5) | Play final video, observe styling and timing | Subtitles appear in correct sync, style (font/color/stroke/bg) matches customization form |
| Checkpoint Resume (Manual) | 1. Terminate server (`Ctrl+C`)\n2. Restart via `bash start.sh`\n3. Click "Resume" on task list | Task resumes from last step, successfully compiling final_video.mp4 |
| WebSocket Progress | Open DevTools → Network → WS, inspect messages | Step progress logs are pushed continuously in real time |

---

## 5. Report Template

Upon completion, the regression runner generates reports using the following structure:

```
═══════════════════════════════════════════════════
  Agnes Video Generator v2.0 — Regression Test Report
  Date: {date}
  Version: {git_commit_hash}
═══════════════════════════════════════════════════

【Service Startup】 ✅ bash start.sh started normally on port 8765
【Server Endpoints】 ✅ E1-E9 All Passed (details below)

────────────────────────────────────────────────
1. Simple Video (Simple)
────────────────────────────────────────────────

  S1 [Text-to-Video]    — ✅ All checks passed
  S2 [Image-to-Video]   — ✅ All checks passed
  S3 [Keyframe Chaining] — ✅ All checks passed

  │ Check Item           │ S1      │ S2      │ S3      │
  │──────────────────────│────────│────────│────────│
  │ F1 Final Video Exists │ ✅      │ ✅      │ ✅      │
  │ F2 Video Duration    │ {n}s    │ {n}s    │ {n}s    │
  │ F3 Res Matches       │ ✅      │ ✅      │ ✅      │
  │ F4 Audio Track       │ ✅      │ ✅      │ ✅      │
  │ F7 Reasonable Dur    │ ✅      │ ✅      │ ✅      │
  │ R1 task_state.json   │ ✅      │ ✅      │ ✅      │
  │ R5 task.json         │ ✅      │ ✅      │ ✅      │
  │ R6 curl.sh           │ ✅      │ ✅      │ ✅      │

────────────────────────────────────────────────
2. Creative Video (Creative)
────────────────────────────────────────────────

  C1 [Text + Indep + Silent]      — ✅ All checks passed
  C2 [Ref Image + keyframes]     — ✅ All checks passed
  C3 [i2i End Frame + keyframes]  — ✅ All checks passed
  C4 [Indep + TTS/Subtitles]      — ✅ All checks passed

  │ Check Item           │ C1      │ C2      │ C3      │ C4      │
  │──────────────────────│────────│────────│────────│────────│
  │ F1 Final Video Exists │ ✅      │ ✅      │ ✅      │ ✅      │
  │ F2 Video Duration    │ {n}s    │ {n}s    │ {n}s    │ {n}s    │
  │ F4 Audio Track       │ N/A¹    │ N/A¹    │ N/A¹    │ ✅      │
  │ F6 Subtitle Match    │ N/A¹    │ N/A¹    │ N/A¹    │ ✅      │
  │ F7 Reasonable Dur    │ ✅      │ ✅      │ ✅      │ ✅      │
  │ R3 step_* Status     │ ✅      │ ✅      │ ✅      │ ✅      │
  │ R5 scene_N/task.json │ ✅      │ ✅      │ ✅      │ ✅      │
  │ R7 scene_N/narration │ N/A¹    │ N/A¹    │ N/A¹    │ ✅      │
  │ R8 scene_N/subtitle  │ N/A¹    │ N/A¹    │ N/A¹    │ ✅      │

  ¹ C1-C3 are mute; audio/subtitle checks are marked as N/A. Subtitle visibility (F5) remains a manual verify item.

────────────────────────────────────────────────
3. Manuscript Video (Manuscript)
────────────────────────────────────────────────

  M1 [Short + Narration] — ✅ All checks passed
  M2 [Short + Styling]   — ✅ All checks passed

  │ Check Item                  │ M1      │ M2      │
  │────────────────────────────│────────│────────│
  │ F1 Final Video Exists       │ ✅      │ ✅      │
  │ F2 Video Duration          │ {n}s    │ {n}s    │
  │ F4 Audio Track             │ ✅      │ ✅      │
  │ F6 Subtitle Match          │ ✅      │ ✅      │
  │ F7 Reasonable Dur          │ ✅      │ ✅      │
  │ R9 full_narration.mp3      │ ✅      │ ✅      │
  │ R10 full_subtitle.srt      │ ✅      │ ✅      │
  │ R5 para_N/task.json        │ ✅      │ ✅      │
  │ R6 para_N/curl.sh          │ ✅      │ ✅      │

────────────────────────────────────────────────
4. Manual Verification Needed
────────────────────────────────────────────────

   > Audio presence (F4) and text matching (F6) verified via Whisper ASR.
   > The following items require manual confirmation:

   1. Subtitle Visibility (F5)
      - Play {task_dir}/final_video.mp4, check subtitle appearance, alignment, and styling.
      - Expected: C4/M1/M2 subtitles match config styles.

   2. Checkpoint Resume
      - Kill server → restart → click "Resume" in Web UI.
      - Expected: Generation resumes from checkpoint.

────────────────────────────────────────────────
5. Summary
────────────────────────────────────────────────

   Auto-verified: {n}/{m}
   Manual check:  1 Item (F5 Subtitle Visibility)
   Unresolved:    {issues or None}
═══════════════════════════════════════════════════
```

---

## 6. Execution Flow

When triggered with **"执行大版本回归"**, the Lead Agent operates as follows:

### 6.1 Preparation

```
1. Run "git status" to ensure working directory is clean, record commit hash.
2. Verify test_ref.png and test_end.png are present (regression test assets).
3. Start server via "bash start.sh" (wait 8s for health check).
4. Clear half-baked tasks from .working_dir/ to avoid interference.
```

### 6.2 Concurrent Execution

`scripts/regression_runner.py` is invoked to manage task submission, polling, validation, and logging.

#### Concurrency Throttle

Concurrency is managed using a **weighted semaphore** based on Agnes API call limitations:

| Task Type | Weight | Notes (Est. Agnes API Calls / Min) |
|---------|-----------|----------------------------------|
| Simple (S1-S3) | 1 | 1 submit + poll ~4 times/min |
| Creative (C1-C4) | 3-4 | Chat + N × Image + N × Video + polling |
| Manuscript (M1-M2) | 4 | Segments × Chat + Segments × Image + polling |

- **Max Total Weight = 10** (API limit is 20 requests/minute; we target 50% margin).
- Example: 2 Creative (weight 7) + 3 Simple (weight 3) = 10 ✅
- Example: 1 Manuscript (weight 4) + 1 Creative (weight 4) + 2 Simple (weight 2) = 10 ✅

#### Execution Command

```bash
# Clean run (defaults to no auto service start)
python scripts/regression_runner.py

# Auto-start services
python scripts/regression_runner.py --auto-start

# Resume tests (skips scenarios completed in regression_report.json)
python scripts/regression_runner.py --resume --auto-start

# Verify existing artifacts only
python scripts/regression_runner.py --quick
```

#### Step Process per Scenario (Executed Concurrently)

```
For each pending scenario:

  Step A — Weighted Semaphore acquire(weight)
    Wait until total running weight + scenario weight ≤ 10

  Step B — Submit Task
    HTTP POST task params, record task_id and dir_name

  Step C — Async Polling
    Every 20s call GET /api/tasks/{task_id}
    Timeout limits: Simple 30min / Creative 120min / Manuscript 60min

  Step D — Validate Artifacts
    Run validate_task() checking F1-F7, R1-R10
    Record check results in report

  Step E — Release Semaphore
    Release(weight) to allow next scenario in queue to start

  Step F — Save Report
    Incrementally write results to docs/regression_report.json
```

### 6.3 Resumption & Reports

#### Incremental Reporting

`docs/regression_report.json` is updated immediately as each scenario completes. Format:

```json
{
  "version": "2.0",
  "git_commit": "abc1234 ...",
  "scenarios": {
    "S1": {
      "status": "completed",
      "result": {
        "task_id": "...",
        "dir_name": "...",
        "duration_s": 123,
        "checks": {
          "F1_final_video_exists": true,
          "F2_duration": 5.2,
          "F4_has_audio_stream": false
        }
      },
      "errors": []
    }
  },
  "endpoints": {
    "E1": { "status": "passed", "detail": "200" }
  },
  "summary": {
    "total": 9, "completed": 3, "failed": 0, "running": 1
  }
}
```

#### Resumption Path

```bash
# Skip completed/skipped scenarios, resume pending/failed/interrupted scenarios
python scripts/regression_runner.py --resume

# Resume Logic:
#   - status=completed/skipped → skip, do not rerun
#   - status=failed/pending    → resubmit and run
#   - status=running           → treat as pending (server restarted, old runner task dead)
```

### 6.4 Verification Phase

After all scenarios finish, the endpoints checks are run:

```
1. Run E1-E9 endpoint validations concurrently.
2. Compile and aggregate all automated checks.
3. Print summary to console.
4. Save machine-readable JSON logs to docs/regression_report.json.
5. Save human-readable Markdown logs to docs/regression_report.md.
```

### Key Considerations

- **Manual Verification (F5)** requires playing the resulting video to verify subtitle rendering and alignment. Speech content (F4) and subtitle accuracy (F6) are automatically checked using Whisper ASR.
- **Resume does not re-evaluate completed scenarios** — use `--quick` mode to re-verify if local files are deleted.
- Auto-validation failures in one scenario do not block other concurrent scenarios.

---

## 7. Materials & Assets Information

Material inputs (e.g. reference images, end frames) are fetched from **already completed Creative task directories** in `.working_dir/`:

| Asset Type | Search Path | Description |
|---------|---------|------|
| Reference Image | `{task_dir}/character_reference.png` | Character reference image |
| End Frame | `{task_dir}/scene_{n}/end_frame.png` | Scene end frame |
| Reference Cache | `{task_dir}/*.url` | Cached upload URL |

**Steps**:
1. Scan `.working_dir/` directories.
2. Find completed Creative task.
3. Retrieve `character_reference.png` or `scene_0/end_frame.png`.
4. Submit paths as `reference_image` or `end_frame_image` arguments.

If no completed tasks are available, run this command to generate solid-color placeholders:

```bash
python -c "
from PIL import Image
for name, color in [('test_ref.png', (100,150,200)), ('test_end.png', (200,150,100))]:
    img = Image.new('RGB', (768, 1152), color)
    img.save(name)
    print(f'{name} created')
"
```

---

## 8. Tool Dependencies & Troubleshooting

The following table lists tool dependencies required by the regression script:

| Tool | Purpose | Impacted Checks | Fallback Behavior |
|------|------|-------------|-------------|
| `ffmpeg` | Audio extraction, video parsing | F4 (ASR), F2/F3 (dur/res) | Skip ASR validation; moviepy fallback for parsing |
| `moviepy` | Read video metadata | F2/F3/F4/F7 | Marked check as `skip` |
| `whisper` | Speech-to-text (ASR) | F4 (audio track), F6 (subtitle match) | Marked check as `skip` |
| `requests` | HTTP requests to API | All scenarios | Runner cannot execute |
| `PIL/Pillow` | Auto asset creation | Asset preparation | Manual setup of test_ref.png/test_end.png |

### 8.2 Whisper Setup & Issues

Whisper automatically verifies audio presence and sync. If whisper is not installed:

#### Installation

```bash
# Inside venv
.venv/bin/pip install openai-whisper

# Ensure ffmpeg is available
brew install ffmpeg

# Verify
.venv/bin/python -c "import whisper; print(whisper.load_model('tiny'))"
```

#### Common Problems

**Q: Whisper OOM (Out of Memory)?**
- Defaults to `tiny` model (~75MB), requiring minimal resources.
- If OOM still occurs, modify `_get_whisper_model()` in `regression_runner.py` to change model size.
- Or uninstall whisper to skip ASR checks (marks them as `skip`).

**Q: librosa or numba conflicts?**
- Whisper dependencies can clash with other packages; install whisper in a clean venv.

### 8.3 FFmpeg Installation

```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu)
sudo apt install ffmpeg

# Windows
choco install ffmpeg
```

### 8.4 Pre-run Health Check

Run this snippet before regression testing to verify dependencies are met:

```bash
# Python dependencies
.venv/bin/python -c "
deps = ['fastapi', 'moviepy', 'edge_tts', 'srt', 'requests', 'pydantic']
for d in deps:
    try:
        __import__(d.replace('-','_'))
        print(f'  [OK] {d}')
    except ImportError:
        print(f'  [MISS] {d}')
"

# Binary tools
for cmd in ffmpeg; do
    if command -v $cmd &>/dev/null; then
        echo "  [OK] $cmd"
    else
        echo "  [MISS] $cmd"
    fi
done

# Whisper ASR
.venv/bin/python -c "import whisper; print('  [OK] whisper')" 2>/dev/null || echo "  [SKIP] whisper (ASR will be skipped)"

# Assets
for f in test_ref.png test_end.png; do
    if [ -f "$f" ]; then echo "  [OK] $f"; else echo "  [MISS] $f (requires asset generation)"; fi
done
```

---

## 9. Regression Process Self-Iteration

The regression runner test suite is a living project that updates iteratively:

### 9.1 Issue Reporting during Execution

If runner validation fails while the feature functions normally, **do not bypass it; update the validation script**:

| Failure Type | Example | Resolution |
|---------|------|---------|
| Missing Tool | whisper missing or ffmpeg outdated | Upgrade tools or document skip behavior |
| False Positive | Check fails but feature works | Fix validation logic in the runner script |
| False Negative | Bug is missed by the runner | Add new validation assertions in checking blocks |
| Runner Bug | Intermittent crashes during concurrency | Fix the regression script |
| Mismatch | Scenario schema doesn't match API | Update scenario parameters |

### 9.2 Iteration Flow

```
Run Regression
    │
    ├── Tool issues? → Fix/Update tool instructions
    │
    ├── False Positive? → Analyze root cause → Fix validation logic → Rerun
    │
    ├── False Negative? → Append checking assertions
    │
    └── Runner bug? → Fix script and submit
```

### 9.3 Post-run Verification Checklist

- [ ] All check results match expectations.
- [ ] New dependencies are fully recorded in the requirements.
- [ ] Scenario timeouts are appropriate.
- [ ] Concurrency weight allocations match API limits.

---

## 10. Appendix: Regression Test Script

The automated test script is located at `scripts/regression_runner.py`, managing:
- **Concurrent execution**: Asyncio runner.
- **Weighted concurrency**: Semaphore-controlled API limits.
- **Incremental reporting**: Save JSON report incrementally.
- **Artifact validation**: Verify F1-F7 and R1-R10.
- **Endpoint validation**: Verify E1-E9.
- **Resumption**: Skip completed scenarios.

---

## 11. Regression Test Execution History

Each run outputs:
- `docs/regression_report.json` (machine-readable results)
- `docs/regression_report.md` (human-readable Markdown summary)

Commands:

```bash
# Print raw JSON
cat docs/regression_report.json

# Check Markdown report
cat docs/regression_report.md

# Filter failed scenarios
python -c "
import json
r = json.load(open('docs/regression_report.json'))
for sid, sc in r['scenarios'].items():
    if sc['status'] != 'completed':
        print(f'{sid}: {sc[\"status\"]} - {sc.get(\"errors\", [])}')
"
```

### Execution History

| Date | Version | Auto Passed | Manual Passed | Issues | Report File |
|------|------|---------|---------|---------|---------|
| <!-- Append history entries here --> | | | | | |

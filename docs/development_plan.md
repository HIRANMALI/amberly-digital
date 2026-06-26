# Agnes Video Generator v2.0 — Complete Development Plan (Archived)

> **Status**: 📦 **Archived** — v2.0 development has been fully completed
> **Current Phase**: 🟢 Maintenance Mode, see `AGENTS.md` and `docs/regression_test_plan.md`
> **Last Updated**: 2026-06-14
> **Description**: This document is kept for historical reference of the development process and is no longer an active execution plan.

---

## 0. Batch Execution Flow (CRITICAL)

### Core Principle

```
❌ FORBIDDEN: Implementing all of T01-T05 at once and only testing at the very end.
✅ MANDATORY: Implement a batch → Verify the batch → Confirm the batch → Proceed to the next batch.
✅ MANDATORY: After each batch, running "bash start.sh" must start normally, and the main workflows involved in that batch must be functional.
```

### Incremental Runability Principle (CRITICAL)

Each delivered batch must not only compile successfully, but must also be in a runnable state where **the service can start normally via `bash start.sh` and the main workflows of existing features are not broken**. Specific requirements:

| Batch | start.sh Startup | Main Workflow Verification Scope |
|------|--------------|---------------|
| Batch A | Must start successfully | Existing Creative Long Video page loads, Task List/Details APIs function normally. |
| Batch B | Must start successfully | Existing Creative Long Video creation API is usable (POST /api/tasks returns 200), both new and old import paths work. |
| Batch C | Must start successfully | Three task type creation APIs are all usable, three-tab frontend is interactive, WebSocket progress push works normally. |

If `start.sh` fails to start after a batch implementation, that batch **fails** and must be fixed before proceeding to QA verification.

### Three-Batch Overview

```
                        ┌── Lead Agent asks for User Confirmation ──┐
                        ↓                                            │
Batch A (T01)  →  QA Verification A  →  ✅ User Approved  →  Batch B (T02+T03)
 Infrastructure                               │
                                              ↓
                                        QA Verification B  →  ✅ User Approved  →  Batch C (T04+T05)
                                                                                  │
                                                                                  ↓
                                                                             QA Verification C  →  ✅ Delivery
```

### 0.1 Standard Operation when Lead Agent receives "Continue v2.0 development"

```
[ ] 1. Confirm the team exists (software-agnes-refactor), if not, call TeamCreate.
[ ] 2. Read docs/system_design.md to confirm the current batch task specifications.
[ ] 3. Read AGENTS.md to confirm coding guidelines.
[ ] 4. Start software-engineer, assigning tasks ONLY for the current batch (starting from Batch A).
[ ] 5. After the engineer completes the current batch → check the AGENTS.md global consistency checklist.
[ ] 6. Engineer runs bash start.sh to confirm the service starts (if failed → fix immediately).
[ ] 7. Engineer verifies that the main workflows involved in the current batch are functional.
[ ] 8. Start software-qa-engineer to verify the current batch.
[ ] 9. If QA passes → report results of current batch to user, wait for user confirmation before entering next batch.
[ ] 10. If QA fails → send back to engineer for fixing → re-verify (max 2 rounds).
```

### 0.2 Engineer Prompt Template (Independent per batch)

> The following are the tasks for Agnes Video Generator v2.0 **Batch X**.
>
> Please read these files first to understand the full context:
> - `docs/development_plan.md` — Development Plan Overview (focus on current batch list)
> - `docs/system_design.md` — Architecture Design (focus on sections related to current batch)
> - `AGENTS.md` — Coding Guidelines, log prefixes, shared knowledge
>
> **Current Batch Task**: [List files and design requirements for this batch]
>
> **Important Reminders**:
> - Only implement tasks for the current batch, do not cross batches.
> - Manually perform offline checks (Python syntax, import tests) upon completion.
> - Execute global consistency check (only for entries related to the current batch).
> - **Must run `bash start.sh` to confirm the service starts normally** (otherwise the batch fails).
> - **Must verify that the main workflows involved in the current batch are functional**.
> - If new code causes existing features to throw errors, add backward compatibility aliases or fixes to keep the old flows working.

---

## 1. Delivery Goals

| Goal | Description |
|------|------|
| 🎬 Simple Video | Expose all parameters of the Agnes Video API as structured UI options (mode, duration, resolution, seed, negative prompt, reference image) instead of a single prompt. |
| 🎥 Creative Video | Existing 7-step flow + edge_tts narration + subtitle overlay, maintaining checkpoint resume. |
| 📝 Manuscript Video | Long text → Speak-time estimated split (5-12s, no split inside sentences) → AI scene_prompt → Video → TTS+Subtitle → Concatenation. |
| 🎵 Audio Subtitles | edge_tts free TTS + SRT subtitle generation + moviepy overlay. |
| 🏗️ Layered Architecture | `core/api/` / `core/compositor/` / `core/audio/` / `core/pipelines/` 4 layers. |

---

## 2. Key Decisions

| # | Decision Point | Solution |
|---|--------|------|
| D1 | Manuscript Splitting | Estimate speech duration (4 chars/sec), 5-12 seconds/segment, **do not split inside a sentence**. |
| D2 | Manuscript Scene Prompt | AI generates English prompt, **original text is used directly as narration + subtitles**. |
| D3 | TTS Default Voice | `zh-CN-XiaoxiaoNeural`, 4 Chinese roles selectable. |
| D4 | Subtitle Style | P1: Font/size/color/position/stroke color + width/background color. |
| D5 | Simple Video Prompt | Structure and expose all 8 Agnes API parameters, **no AI enhancement**. |
| D6 | Old Task Compatibility | `TaskManager.load()` automatically parses records lacking `task_type` as CREATIVE. |
| D7 | Default Resolution | 768×1152 (Portrait), 3 preset options selectable. |
| D8 | Video Padding | ≤ 1 second, freeze last frame. |
| D9 | Multi-Language | Maintain 7 languages (zh/en/ru/ja/ko/ms/id), complete new translations. |

---

## 3. Tech Stack

| Component | Choice | Change |
|------|------|------|
| Backend | Python FastAPI + WebSocket | Keep |
| Data Models | Pydantic v2 | Generalize |
| Video Processing | moviepy + ffmpeg | Keep |
| TTS | **edge_tts >= 6.1.0** | **New** |
| Subtitles | **srt >= 3.5.0** | **New** |
| Frontend | Native HTML/CSS/JS + Tailwind CDN | Rewrite |
| LLM | Agnes Chat API (requests sync) | Keep |

---

## 4. Architecture

```
core/
├── api/                    [New] Common API service layer
│   ├── agnes_image.py       (Migrated from image_generator.py)
│   ├── agnes_video.py       (Migrated from video_generator.py)
│   └── agnes_chat.py        (Extracted from screenwriter.py)
│
├── compositor/             [New] Common video compositing layer
│   ├── concatenator.py      (Pure concat + concat with audio)
│   └── processor.py         (Resize/Frame extraction/Silence)
│
├── audio/                  [New] Common audio & subtitle layer
│   ├── tts.py               (EdgeTTSEngine + SilentTTSEngine)
│   └── subtitle.py          (cues→SRT + moviepy overlay)
│
├── pipelines/              [New] Business pipelines layer
│   ├── base.py              (Shared progress/checkpoints/shutdown)
│   ├── simple_video.py      (Type 1)
│   ├── creative_video.py    (Type 2, containing audio/subtitle steps)
│   └── manuscript_video.py  (Type 3, containing duration-based splitting)
│
├── screenwriter.py          [Keep + Minor Mod] Script Agent
├── config.py                [Modify] Default audio/subtitle configs
└── task_manager.py          [Modify] Generalize multiple task types
```

---

## 5. Batch Tasks

### Batch Dependencies

```
Batch A (T01) ──→ Batch B (T02+T03) ──→ Batch C (T04+T05)
    ↑                   ↑                    ↑
 Approved            Approved             Approved
```

---

### Batch A: Infrastructure and Data Models (T01)

| Attribute | Value |
|------|-----|
| Batch ID | Batch A |
| Tasks | T01 |
| Priority | P0 (highest, base for subsequent batches) |
| Files | 5 |

**Change List**:

| File | Action | Description |
|------|------|------|
| `requirements.txt` | Modify | Add edge_tts>=6.1.0, srt>=3.5.0 |
| `models/task.py` | Rewrite | TaskType enum, BaseTaskState, SimpleVideoTask, CreativeVideoTask, ManuscriptVideoTask, AudioConfig, SubtitleStyle, ManuscriptParagraph |
| `models/__init__.py` | Modify | Export all new models |
| `core/config.py` | Modify | DEFAULT_VOICE, DEFAULT_SUBTITLE_STYLE, get_default_audio_config(), get_default_subtitle_style() |
| `core/task_manager.py` | Modify | Generalize load/save, backward compatibility (no task_type → CREATIVE) |

**Verification List (Batch A Exclusive)**:

```
[ ] A1: Python syntax check — python -m py_compile models/task.py models/__init__.py core/config.py core/task_manager.py
[ ] A2: Import check — from models.task import TaskType, SimpleVideoTask, CreativeVideoTask, ManuscriptVideoTask, AudioConfig, SubtitleStyle
[ ] A3: Serialization test — SimpleVideoTask(...).model_dump_json() outputs normally
[ ] A4: Old format compatibility — TaskManager.load(dir_with_old_format) loads without errors, returns CreativeVideoTask
[ ] A5: config factory function — get_default_audio_config() returns expected structure and values
[ ] A6: requirements.txt — pip install -r requirements.txt finishes successfully
[ ] A7: start.sh startup — bash start.sh runs without errors, Uvicorn listens on port 8765
[ ] A8: Main flow validation — GET / returns index page (200), GET /api/config returns ok:true, GET /api/tasks returns list (200)
```

**Passing Criteria**: All A1-A8 pass, Lead Agent reports to user for confirmation.

---

### Batch B: Common Components + Pipelines (T02+T03)

| Attribute | Value |
|------|-----|
| Batch ID | Batch B |
| Tasks | T02 + T03 |
| Priority | P0 |
| Dependency | ✅ Batch A Completed and Confirmed |
| Files | 14 |

**Change List**:

| File | Action | Description |
|------|------|------|
| `core/api/__init__.py` | New | Export AgnesImageAPI / AgnesVideoAPI / AgnesChatAPI |
| `core/api/agnes_image.py` | Migrate | From core/image_generator.py, class rename ImageGeneratorAgnesAPI → AgnesImageAPI |
| `core/api/agnes_video.py` | Migrate | From core/video_generator.py, class rename VideoGeneratorAgnesAPI → AgnesVideoAPI |
| `core/api/agnes_chat.py` | Extract | From core/screenwriter.py, extract _chat/_chat_json/_chat_multimodal |
| `core/audio/__init__.py` | New | Export |
| `core/audio/tts.py` | New | EdgeTTSEngine + SilentTTSEngine |
| `core/audio/subtitle.py` | New | SubtitleGenerator (cues→SRT + moviepy overlay) |
| `core/compositor/__init__.py` | New | Export |
| `core/compositor/concatenator.py` | New | VideoConcatenator (pure concat + concat_with_audio) |
| `core/compositor/processor.py` | New | VideoProcessor (resize/frame extraction/silence) |
| `core/pipelines/__init__.py` | New | BasePipeline + exports |
| `core/pipelines/simple_video.py` | New | Simple video pipeline |
| `core/pipelines/creative_video.py` | New | Creative video (from pipeline.py + audio subtitle steps) |
| `core/pipelines/manuscript_video.py` | New | Manuscript video (incorporating splitting algorithm) |
| `core/screenwriter.py` | Modify | Use AgnesChatAPI; add generate_scene_prompt_for_paragraph() |
| `core/image_generator.py` | Keep Alias | Points to core/api/agnes_image.py |
| `core/video_generator.py` | Keep Alias | Points to core/api/agnes_video.py |
| `core/pipeline.py` | Keep Alias | Points to core/pipelines/creative_video.py |

**Verification List (Batch B Exclusive)**:

```
[ ] B1: Import chain checks — python -c "from core.api import AgnesImageAPI,AgnesVideoAPI,AgnesChatAPI;from core.audio import EdgeTTSEngine,SubtitleGenerator;from core.compositor import VideoConcatenator;from core.pipelines import SimpleVideoPipeline,CreativeVideoPipeline,ManuscriptVideoPipeline"
[ ] B2: Screenwriter uses AgnesChatAPI — grep "requests.post" core/screenwriter.py yields no results outside comments
[ ] B3: Log prefixes correctness — check api/ files use [AgnesImage]/[AgnesVideo]/[AgnesChat]; audio/ files use [TTS]/[Subtitle]; compositor/ files use [Compositor]; pipelines/ files use [Simple]/[Pipeline]/[Manuscript]
[ ] B4: SubtitleGenerator.cues_to_srt() — inputs mock cues → outputs valid SRT format
[ ] B5: split_manuscript() algorithm — boundary tests (empty/short/long/mixed sentences)
[ ] B6: Three Pipeline classes structured — all have run() method with correct signatures
[ ] B7: Old compatibility — from core.image_generator import ImageGeneratorAgnesAPI remains functional
[ ] B8: start.sh startup — bash start.sh runs without error
[ ] B9: Main flow validation — POST /api/tasks (existing creative long video endpoint) still accepts valid params and returns 200, GET /api/tasks/{id} returns details
```

**Passing Criteria**: All B1-B9 pass, Lead Agent reports to user for confirmation.

---

### Batch C: Server Integration + Frontend (T04+T05)

| Attribute | Value |
|------|-----|
| Batch ID | Batch C |
| Tasks | T04 + T05 |
| Priority | P0 |
| Dependency | ✅ Batch B Completed and Confirmed |
| Files | 3 |

**Change List**:

| File | Action | Description |
|------|------|------|
| `server.py` | Rewrite | Three task routes (simple/creative/manuscript), Pipeline factory, WebSocket kept |
| `core/__init__.py` | Modify | Update top level exports |
| `static/index.html` | Rewrite | 3-tab layout + structured forms + 7 languages i18n completions |

**New API Endpoints**:
- `POST /api/tasks/simple` — Create simple video task
- `POST /api/tasks/creative` — Create creative video task
- `POST /api/tasks/manuscript` — Create manuscript video task

**Verification List (Batch C Exclusive)**:

```
[ ] C1: start.sh startup — bash start.sh starts normally, listening on 8765
[ ] C2: GET / → returns index.html, browser shows three Tabs layout
[ ] C3: i18n — switch 7 languages, verify no missing translations in new texts
[ ] C4: POST /api/tasks/simple — curl requests with valid params return {"ok":true,"task_id":"..."}
[ ] C5: POST /api/tasks/creative — same as above
[ ] C6: POST /api/tasks/manuscript — same as above
[ ] C7: GET /api/tasks — returns task list containing multiple task_types
[ ] C8: GET /api/tasks/{id} — returns details containing task_type field
[ ] C9: Simple Video Tab — switching modes displays/hides image uploads correctly
[ ] C10: Manuscript Tab — textarea and [Preview Split] buttons functional
[ ] C11: Creative Tab — audio config section (switch/role/speed/subtitle styles) visible
[ ] C12: Workflow validation — Simple video complete flow: create task → frontend displays progress → task list shows task status
```

**Passing Criteria**: All C1-C12 pass, Lead Agent delivers.

---

## 6. Lead Agent Confirmation Template per Batch

When reporting batch status to the user:

```
## ✅ Batch X Completed

**Batch**: Batch X — [Batch Name]
**Tasks**: Txx — [Task Description]
**Files**: N files created/modified

**Verification**:
| Checklist Item | Status |
|--------|------|
| X1: ... | ✓ |
| X2: ... | ✓ |
| ... | ... |
| start.sh Startup | ✓ / ✗ |
| Main Flow Verified | ✓ / ✗ (detail what was verified) |

**IS_PASS**: YES / NO (with issue list)

**Next Step**: Batch Y — [Next Batch Name], estimated N files.

Do you wish to proceed to the next batch?
```

---

## 6. File Statistics

| Category | Count |
|------|------|
| Net New Files | 14 |
| Rewritten Files | 4 (models/task.py, server.py, core/config.py, index.html) |
| Modified Files | 4 (requirements.txt, core/task_manager.py, core/screenwriter.py, models/__init__.py) |
| Migrated Old Files | 3 (image_generator.py, video_generator.py, pipeline.py → keep aliases or delete) |
| Kept Intact | 7 (utils/×3, start.sh, core/__init__.py, .gitignore, LICENSE) |

---

## 7. Manuscript Splitting Algorithm

```
split_manuscript(text) → List[ManuscriptParagraph]:
  1. Pre-process: split by newline → split by period/question mark/exclamation → candidate sentences
  2. For each candidate sentence: est_duration = len(text) / 4.0 (Chinese speaking rate ~4 chars/sec)
  3. Greedy combine: accumulated duration ≤ 12s, ≥ 5s
     - Short sentences (< 5s) combined into previous segment
     - Long sentences (> 12s) accepted without split
  4. If combined duration < 5s: combine forward (except final segment)
  5. Return list of paragraphs containing index, text, est_duration
```

---

## 8. Simple Video UI — Agnes API Parameter Mapping

| UI Element | API Parameter | Notes |
|---------|---------|------|
| Mode (Select) | mode / image | t2v / i2v(ti2vid) / keyframes |
| Prompt (Input) | prompt | Direct pass-through |
| Reference Image (Upload) | image | Shown in i2v/keyframes |
| End Frame (Upload) | extra_body.image[1] | Shown in keyframes only |
| Duration (Select) | num_frames + frame_rate | 5/10/15/18/20s |
| Resolution (Select) | width + height | Portrait 768×1152 / Landscape 1152×768 / Square 1024×1024 |
| Seed (Input, optional) | seed | Collapsible section |
| Negative Prompt (Input, optional) | negative_prompt | Collapsible section |

---

## 9. Startup Commands

```bash
cd /Users/lcy/video/agnes-video-generator
source .venv/bin/activate
pip install -r requirements.txt   # install edge_tts, srt on first setup
python server.py
# Open http://localhost:8765
```

---

## 10. Phase Status (Historical Log)

| Phase | Status | Batch | Completion Date |
|------|------|------|---------|
| PRD (Requirements) | ✅ Completed | — | 2025-06-14 |
| Design & Decomposition | ✅ Completed | — | 2025-06-14 |
| Plan Document | ✅ Completed | — | 2025-06-14 |
| **Batch A: Infrastructure** | ✅ **Completed** | T01 (5 files) | 2026-06-14 |
| **Batch B: Components & Pipelines** | ✅ **Completed** | T02+T03 (14 files) | 2026-06-14 |
| **Batch C: Server & Frontend** | ✅ **Completed** | T04+T05 (3 files) | 2026-06-14 |
| QA Final Signoff | ✅ **Passed** | — | 2026-06-14 |

---

*Document Version: v3.3 | Status: 📦 Archived | v2.0 development fully completed*
